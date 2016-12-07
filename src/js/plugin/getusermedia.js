/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;

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
module.exports = function() {
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
        cc.optional = cc.optional || [];
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
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  var shimConstraints_ = function(constraints, func) {
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && constraints.audio) {
      constraints.audio = constraintsToPlugin_(constraints.audio);
    }
    if (constraints && typeof constraints.video === 'object') {
      // Shim facingMode for mobile, where it defaults to "user".
      var face = constraints.video.facingMode;
      face = face && ((typeof face === 'object') ? face : {ideal: face});

      if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                    face.ideal === 'user' || face.ideal === 'environment')) &&
          !(navigator.mediaDevices.getSupportedConstraints &&
            navigator.mediaDevices.getSupportedConstraints().facingMode)) {
        delete constraints.video.facingMode;
        if (face.exact === 'environment' || face.ideal === 'environment') {
          // Look for "back" in label, or use last cam (typically back cam).
          return navigator.mediaDevices.enumerateDevices()
          .then(function(devices) {
            devices = devices.filter(function(d) {
              return d.kind === 'videoinput';
            });
            var back = devices.find(function(d) {
              return d.label.toLowerCase().indexOf('back') !== -1;
            }) || (devices.length && devices[devices.length - 1]);
            if (back) {
              constraints.video.deviceId = face.exact ? {exact: back.deviceId} :
                                                        {ideal: back.deviceId};
            }
            constraints.video = constraintsToPlugin_(constraints.video);
            logging('plugin: ' + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToPlugin_(constraints.video);
    }
    logging('pulgin: ' + JSON.stringify(constraints));
    return func(constraints);
  };

  var shimError_ = function(e) {
    return {
      name: {
        PermissionDeniedError: 'NotAllowedError',
        ConstraintNotSatisfiedError: 'OverconstrainedError'
      }[e.name] || e.name,
      message: e.message,
      constraint: e.constraintName,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
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
