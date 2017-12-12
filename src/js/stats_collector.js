'use strict';

var utils = require('./utils.js');
var logging = utils.log;
var statDisabled_ = window.localStorage.statsSending == "true" ? false : true;
var trace = require('./trace-ws.js')(window.localStorage.statsServer ? window.localStorage.statsServer : 'wss://stats.ipvideotalk.com')

// transforms a maplike to an object. Mostly for getStats +
// JSON.parse(JSON.stringify())
function map2obj(m) {
    if (!m.entries) {
        return m;
    }
    var o = { };
    m.forEach(function(v, k) {
            o[k] = v;
        });
    return o;
}

// apply a delta compression to the stats report. Reduces size by ~90%.
// To reduce further, report keys could be compressed.
function deltaCompression(oldStats, newStats) {
    newStats = JSON.parse(JSON.stringify(newStats));
    Object.keys(newStats).forEach(function(id) {
            if (!oldStats[id]) {
                return;
            }
            var report = newStats[id];
            Object.keys(report).forEach(function(name) {
                    if (report[name] === oldStats[id][name]) {
                        delete newStats[id][name];
                    }
                    delete report.timestamp;
                    if (Object.keys(report).length === 0) {
                        delete newStats[id];
                    }
                });
        });
    // TODO: moving the timestamp to the top-level is not compression but...
    newStats.timestamp = new Date();
    return newStats;
}

function mangleChromeStats(pc, response) {
    var standardReport = { };
    var reports = response.result();
    reports.forEach(function(report) {
            var standardStats = {
                id: report.id,
                timestamp: report.timestamp.getTime(),
                type: report.type,
            };
            report.names().forEach(function(name) {
                    standardStats[name] = report.stat(name);
                });
            // backfill mediaType -- until https://codereview.chromium.org/1307633007/ lands.
            if (report.type === 'ssrc' && !standardStats.mediaType && standardStats.googTrackId) {
                // look up track kind in local or remote streams.
                var streams = pc.getRemoteStreams().concat(pc.getLocalStreams());
                for (var i = 0; i < streams.length && !standardStats.mediaType; i++) {
                    var tracks = streams[i].getTracks();
                    for (var j = 0; j < tracks.length; j++) {
                        if (tracks[j].id === standardStats.googTrackId) {
                            standardStats.mediaType = tracks[j].kind;
                            report.mediaType = tracks[j].kind;
                        }
                    }
                }
            }
            standardReport[standardStats.id] = standardStats;
        });
    return standardReport;
}

function dumpStream(stream) {
    return {
           id: stream.id,
           tracks: stream.getTracks().map(function(track) {
                return {
                       id: track.id,                 // unique identifier (GUID) for the track
                       kind: track.kind,             // `audio` or `video`
                       label: track.label,           // identified the track source
                       enabled: track.enabled,       // application can control it
                       muted: track.muted,           // application cannot control it (read-only)
                       readyState: track.readyState, // `live` or `ended`
                };
            }),
    };
}

/*
function filterBoringStats(results) {
  Object.keys(results).forEach(function(id) {
    switch (results[id].type) {
      case 'certificate':
      case 'codec':
        delete results[id];
        break;
      default:
        // noop
    }
  });
  return results;
}

function removeTimestamps(results) {
  // FIXME: does not work in FF since the timestamp can't be deleted.
  Object.keys(results).forEach(function(id) {
    delete results[id].timestamp;
  });
  return results;
}
*/

var stats_collector = {
    initCollector: function(window, bool, server) {
        trace('InitCollector');
        statDisabled_ = bool;

    },

    shimStatPC: function(window) {

        if (statDisabled_) {
            return;
        }
        var browserDetails = utils.detectBrowser(window);

        var origPeerConnection = window.RTCPeerConnection;

        var peerconnection = function(config, constraints) {

            var pc = new origPeerConnection(config, constraints);

            if (!pc.prevStats) {
                //For getStats
                pc.prevStats = { };
            }

            constraints.optional.forEach(function(a) {
                    if (a.pcName) {
                        pc.pcName = a.pcName;
                    }
                });
            var id = pc.pcName;

            if (!config) {
                config = { nullConfig: true };
            }

            config = JSON.parse(JSON.stringify(config)); // deepcopy
            // don't log credentials
            ((config && config.iceServers) || [ ]).forEach(function(server) {
                    delete server.credential;
                });

            config.browserDetails = JSON.parse(JSON.stringify(browserDetails)); // deepcopy


            trace('create', id, config);
            // TODO: do we want to log constraints here? They are chrome-proprietary.
            // http://stackoverflow.com/questions/31003928/what-do-each-of-these-experimental-goog-rtcpeerconnectionconstraints-do
            if (constraints) {
                trace('constraints', id, constraints);
            }

            [ 'createDataChannel', 'close', 'addTrack', 'removeTrack' ].forEach(function(method) {
                    if (origPeerConnection.prototype[method]) {
                        var nativeMethod = pc[method];
                        pc[method] = function() {
                            trace(method, id, arguments);
                            return nativeMethod.apply(pc, arguments);
                        };
                    }
                });

            [ 'addStream', 'removeStream' ].forEach(function(method) {
                    if (origPeerConnection.prototype[method]) {
                        var nativeMethod = pc[method];
                        pc[method] = function(stream) {
                            var streamInfo = stream.getTracks().map(function(t) {
                                    return t.kind + ':' + t.id;
                                });

                            trace(method, id, stream.id + ' ' + streamInfo);
                            return nativeMethod.call(pc, stream);
                        };
                    }
                });

            if (adapter.browserDetails.isWebRTCPluginInstalled === false && adapter.browserDetails.browser === 'safari') {

                [ 'createOffer', 'createAnswer' ].forEach(function(method) {
                        if (origPeerConnection.prototype[method]) {
                            var nativeMethod = pc[method];
                            pc[method] = function() {
                                var args = arguments;
                                var opts;
                                if (arguments.length === 1 && typeof arguments[0] === 'object') {
                                    opts = arguments[0];
                                } else if (arguments.length === 3 && typeof arguments[2] === 'object') {
                                    opts = arguments[2];
                                }
                                trace(method, id, opts);
                                return new Promise(function(resolve, reject) {
                                        nativeMethod.apply(pc, [ opts, ]).then(function(description) {
                                                trace(method + 'OnSuccess', id, description);
                                                resolve(description);
                                                if (args.length > 0 && typeof args[0] === 'function') {
                                                    args[0].apply(null, [ description ]);
                                                }
                                            }).catch(function(err) {
                                                trace(method + 'OnFailure', id, err.toString());
                                                reject(err);
                                                if (args.length > 1 && typeof args[1] === 'function') {
                                                    args[1].apply(null, [ err ]);
                                                }
                                            })
                                    });
                            };
                        }
                    });


            } else {
                /* For All browser without Safari 11 */

                [ 'createOffer', 'createAnswer' ].forEach(function(method) {
                        if (origPeerConnection.prototype[method]) {
                            var nativeMethod = pc[method];
                            pc[method] = function() {
                                var args = arguments;
                                var opts;
                                if (arguments.length === 1 && typeof arguments[0] === 'object') {
                                    opts = arguments[0];
                                } else if (arguments.length === 3 && typeof arguments[2] === 'object') {
                                    opts = arguments[2];
                                }
                                trace(method, id, opts);
                                return new Promise(function(resolve, reject) {
                                        nativeMethod.apply(pc, [
                                                               function(description) {
                                                trace(method + 'OnSuccess', id, description);
                                                resolve(description);
                                                if (args.length > 0 && typeof args[0] === 'function') {
                                                    args[0].apply(null, [ description ]);
                                                }
                                            },
                                                               function(err) {
                                                trace(method + 'OnFailure', id, err.toString());
                                                reject(err);
                                                if (args.length > 1 && typeof args[1] === 'function') {
                                                    args[1].apply(null, [ err ]);
                                                }
                                            },
                                                               opts,
                                                               ]);
                                    });
                            };
                        }
                    });


            }

            [ 'setLocalDescription', 'setRemoteDescription', 'addIceCandidate' ].forEach(function(method) {
                    if (origPeerConnection.prototype[method]) {
                        var nativeMethod = pc[method];
                        pc[method] = function() {
                            var args = arguments;
                            trace(method, id, args[0]);
                            return new Promise(function(resolve, reject) {
                                    nativeMethod.apply(pc, [ args[0],
                                                           function() {
                                            trace(method + 'OnSuccess', id);
                                            resolve();
                                            if (args.length >= 2) {
                                                args[1].apply(null, [ ]);
                                            }
                                        },
                                                           function(err) {
                                            trace(method + 'OnFailure', id, err.toString());
                                            reject(err);
                                            if (args.length >= 3) {
                                                args[2].apply(null, [ err ]);
                                            }
                                        } ]
                                                      );
                                });
                        };
                    }
                });

            pc.addEventListener('icecandidate', function(e) {
                    trace('onicecandidate', id, e.candidate);
                });
            pc.addEventListener('addstream', function(e) {
                    trace('onaddstream', id, e.stream.id + ' ' + e.stream.getTracks().map(function(t) { return t.kind + ':' + t.id; }));
                });
            pc.addEventListener('removestream', function(e) {
                    trace('onremovestream', id, e.stream.id + ' ' + e.stream.getTracks().map(function(t) { return t.kind + ':' + t.id; }));
                });
            pc.addEventListener('signalingstatechange', function() {
                    trace('onsignalingstatechange', id, pc.signalingState);
                });
            pc.addEventListener('iceconnectionstatechange', function() {
                    trace('oniceconnectionstatechange', id, pc.iceConnectionState);
                });
            pc.addEventListener('icegatheringstatechange', function() {
                    trace('onicegatheringstatechange', id, pc.iceGatheringState);
                });
            pc.addEventListener('negotiationneeded', function() {
                    trace('onnegotiationneeded', id);
                });
            pc.addEventListener('datachannel', function(event) {
                    trace('ondatachannel', id, [ event.channel.id, event.channel.label ]);
                });




            var statChromeStats = function(pc, res) {
                var now = mangleChromeStats(pc, res);
                trace('getstats', pc.pcName, deltaCompression(pc.prevStats, now));
                pc.prevStats = JSON.parse(JSON.stringify(now));
            };

            var statFirefoxStats = function(pc, res) {
                var now = map2obj(res);
                trace('getstats', pc.pcName, deltaCompression(pc.prevStats, now));
                pc.prevStats = JSON.parse(JSON.stringify(now));
            };

            var statEdgeStats = function(pc, res) {
                //TODO
                var now = map2obj(res);
                trace('getstats', pc.pcName, deltaCompression(pc.prevStats, now));
                pc.prevStats = JSON.parse(JSON.stringify(now));
            };

            var statSafariStats = function(pc, res) {
                //TODO
                var now = map2obj(res);
                trace('getstats', pc.pcName, deltaCompression(pc.prevStats, now));
                pc.prevStats = JSON.parse(JSON.stringify(now));
            };

            var origGetStats = origPeerConnection.prototype['getStats'];
            pc.getStats = function(selector, successCallback, errorCallback) {
                var pc = this;
                
                return new Promise(function(resolve, reject) {
                    origGetStats.apply(pc, [ selector, function(response) {
                            if (browserDetails.browser === 'chrome' || browserDetails.browser === 'opera') {
                                statChromeStats(pc, response);
                            } else if (browserDetails.browser === 'firefox') {
                                statFirefoxStats(pc, response);
                            } else if (browserDetails.browser === 'edge') {
                                statEdgeStats(pc, response);
                            } else if (browserDetails.isWebRTCPluginInstalled === true) {
                                //For Plugin
                                statChromeStats(pc, response);
                            } else if (browserDetails.browser === 'safari') {
                                statSafariStats(pc, response);
                            } else {
                                console.warn("Unknow browser!");
                            }
                            resolve(response);
                        }, reject ]);
                    }).then(successCallback, errorCallback)
            }

            return pc;
        }

            window.RTCPeerConnection = peerconnection;
    },


    shimStatGUM: function(window) {

        if (statDisabled_) {
            return;
        }
        var browserDetails = utils.detectBrowser(window);

        //Non-promise
        var nonPromiseGetUserMedia = navigator.getUserMedia;
        var nonPromiseGUM = function() {
            trace('getUserMedia', null, arguments[0]);
            var cb = arguments[1];
            var eb = arguments[2];
            nonPromiseGetUserMedia.call(navigator, arguments[0],
                                   function(stream) {
                                       // we log the stream id, track ids and tracks readystate since that is ended GUM fails
                                       // to acquire the cam (in chrome)
                                       trace('getUserMediaOnSuccess', null, dumpStream(stream));
                                       if (cb) {
                                           cb(stream);
                                       }
                                   },
                                   function(err) {
                                       trace('getUserMediaOnFailure', null, err.name);
                                       if (eb) {
                                           eb(err);
                                       }
                                   });
        };
        navigator.getUserMedia = nonPromiseGUM;

        //Promise
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            var promiseGetUserMedia = navigator.mediaDevices.getUserMedia;
            var promiseGUM = function() {
                trace('navigator.mediaDevices.getUserMedia', null, arguments[0]);
                return promiseGetUserMedia.apply(navigator.mediaDevices, arguments)
                       .then(function(stream) {
                        trace('navigator.mediaDevices.getUserMediaOnSuccess', null, dumpStream(stream));
                        return stream;
                    }, function(err) {
                        trace('navigator.mediaDevices.getUserMediaOnFailure', null, err.name);
                        return Promise.reject(err);
                    });
            };
            navigator.mediaDevices.getUserMedia = promiseGUM.bind(navigator.mediaDevices);
        }
    }

};

// Export.
module.exports = {
    initCollector: stats_collector.initCollector,
    shimStatPC: stats_collector.shimStatPC,
    shimStatGUM: stats_collector.shimStatGUM
};
