/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var utils = require('../utils.js');
var logging = utils.log;

var getPlugin = function () {
        return document.getElementById('IPVTPluginId');
};
var extractPluginObj = function (elt) {
        return elt.isWebRtcPlugin ? elt : elt.pluginObj;
};
var getSources = function (gotSources) { // not part of the standard (at least, haven't found it)
    if (document.readyState !== "complete") {
        console.log("readyState = " + document.readyState + ", delaying getSources...");
        if (!getSourcesDelayed) {
            getSourcesDelayed = true;
            document.addEventListener( "readystatechange", function () {
                if (getSourcesDelayed && document.readyState == "complete") {
                    getSourcesDelayed = false;
                    getPlugin().getSources(gotSources);
                }
            });
        }
    }
    else {
        getPlugin().getSources(gotSources);
    }
};

// Expose public methods.
module.exports = function(window) {
    var browserDetails = utils.detectBrowser(window);
    var navigator = window && window.navigator;

    var constraintsToPlugin_ = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [ ];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname_('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || [ ]).concat(c.advanced);
    }
    return cc;
  };

  var shimConstraints_ = function(constraints, func) {
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && typeof constraints.audio === 'object') {
            var remap = function(obj, a, b) {
                if (a in obj && !(b in obj)) {
                    obj[b] = obj[a];
                    delete obj[a];
                }
            };
            constraints = JSON.parse(JSON.stringify(constraints));
            remap(constraints.audio, 'autoGainControl', 'googAutoGainControl');
            remap(constraints.audio, 'noiseSuppression', 'googNoiseSuppression');
            constraints.audio = constraintsToPlugin_(constraints.audio);
    }
    if (constraints && typeof constraints.video === 'object') {
      // Shim facingMode for mobile & surface pro.
            var face = constraints.video.facingMode;
      face = face && ((typeof face === 'object') ? face : {ideal: face});
            var getSupportedFacingModeLies = browserDetails.version < 61;

      if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                    face.ideal === 'user' || face.ideal === 'environment')) &&
          !(navigator.mediaDevices.getSupportedConstraints &&
            navigator.mediaDevices.getSupportedConstraints().facingMode &&
                    !getSupportedFacingModeLies)) {
        delete constraints.video.facingMode;
                var matches;
        if (face.exact === 'environment' || face.ideal === 'environment') {
                    matches = [ 'back', 'rear' ];
                } else if (face.exact === 'user' || face.ideal === 'user') {
                    matches = [ 'front' ];
                }
                if (matches) {
          // Look for matches in label, or use last cam for back (typical).
          return navigator.mediaDevices.enumerateDevices()
          .then(function(devices) {
            devices = devices.filter(function(d) {
              return d.kind === 'videoinput';
            });
            var dev = devices.find(function(d) {
                                    return matches.some(function(match) {
              return d.label.toLowerCase().indexOf(match) !== -1;
            });
                                });
                            if (!dev && devices.length && matches.indexOf('back') !== -1) {
                                dev = devices[devices.length - 1]; // more likely the back cam
                            }
                            if (dev) {
              constraints.video.deviceId = face.exact ? {exact: dev.deviceId} :
                                                        {ideal: dev.deviceId};
            }
            constraints.video = constraintsToPlugin_(constraints.video);
            logging('Plugin: ' + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToPlugin_(constraints.video);
    }
    logging('Plugin: ' + JSON.stringify(constraints));
    return func(constraints);
  };

  var shimError_ = function(e) {

      var errObj = {};
      if (e && typeof e === 'string' && e.match(/(access|denied)/g).length >= 2) {
          /*Permission to access camera/microphone denied*/
          errObj.name = 'NotAllowedError';
          errObj.message = e;
          errObj.constraint = null;
      } else {
          errObj.name = 'OverconstrainedError';
          errObj.message = e;
          errObj.constraint = null;
      }

      errObj.toString = function() {
          return this.name + (this.message && ': ') + this.message;
      }
      
      return errObj;
  };

  var getUserMedia_ = function (constraints, onSuccess, onError) {
        if (document.readyState !== "complete") {
            logging("readyState = " + document.readyState + ", delaying getUserMedia...");
            if ( !getUserMediaDelayed ) {
                getUserMediaDelayed = true;
                this.shimAttachEventListener(document, "readystatechange", function () {
                    if (getUserMediaDelayed && document.readyState == "complete") {
                        getUserMediaDelayed = false;
                        shimConstraints_(constraints, function(c) {
                           getPlugin().getUserMedia(c, onSuccess, function(e) {
                               onError(shimError_(e));
                           });
                        });
                    }
                });
            }
        } else {
            shimConstraints_(constraints, function(c) {
                getPlugin().getUserMedia(c, onSuccess, function(e) {
                    onError(shimError_(e));
                });
            });
       }
  };

  navigator.getUserMedia = getUserMedia_;

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      navigator.getUserMedia(constraints, resolve, reject);
    });
  };

  //For export the mediaDevices
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = { getUserMedia: function(constraints) {
      return getUserMediaPromise_(constraints);
    },
      enumerateDevices: function() {
          return new Promise(function(resolve) {
                  var kinds = { audio: 'audioinput', video: 'videoinput' };
                  return getSources(function(devices) {
                          resolve(devices.map(function(device) {
                                  return { label: device.label,
                                         kind: kinds[device.kind],
                                         deviceId: device.id,
                                         groupId: '' };
                              }));
                            });
                      });
              },
            getSupportedConstraints: function() {
                return { //Todo: RZHANG check if the plugin is support all?
                       deviceId: true, echoCancellation: true, facingMode: true,
                       frameRate: true, height: true, width: true
                };
      } };
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      logging('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      logging('Dummy mediaDevices.removeEventListener called.');
    };
  }
};
