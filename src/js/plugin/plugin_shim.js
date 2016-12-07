
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
var browserDetails = require('../utils.js').browserDetails;
var _promise = require('../es6-promise.min.js').Promise;

var getUserMediaDelayed;
var getSourcesDelayed;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
var loadCount = 10;

var getPlugin = function () {
    return document.getElementById('IPVTPluginId');
};
var extractPluginObj = function (elt) {
    return elt.isWebRtcPlugin ? elt : elt.pluginObj;
};
// http://www.w3.org/TR/mediacapture-streams/#idl-def-MediaStreamTrack
var installPlugin = function() {
        if (document.getElementById("IPVTPluginId")) {
           if (document.getElementById("IPVTPluginId").versionName != undefined) {
                logging('Allready installed the plugin!! Plugin version is '+document.getElementById("IPVTPluginId").versionName);
            return { installed: true, version: document.getElementById("IPVTPluginId").versionName };
           } else {
                logging('Waitting for the Plugin installation done');
                return { installed: undefined, version: undefined };
        }
        }
        
        logging('installPlugin() called');
        var isInternetExplorer = !!((Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(window, "ActiveXObject")) || ("ActiveXObject" in window));
        var isSafari = !!navigator.userAgent.indexOf('Safari');

        var pluginObj = document.createElement('object');
        if (isInternetExplorer) {
            //Added promises support 
            Promise = _promise;

            pluginObj.setAttribute('classid', 'CLSID:C14F046D-EC06-4A58-8594-008226370B22');
            isInternetExplorer = true;
        } else {
            pluginObj.setAttribute('type', 'application/ipvt-plugin');
        }
        pluginObj.setAttribute('id', 'IPVTPluginId');
        document.body.appendChild(pluginObj);
        pluginObj.setAttribute('width', '0');
        pluginObj.setAttribute('height', '0');

        if (pluginObj.isWebRtcPlugin || (typeof navigator.plugins !== "undefined" && (!!navigator.plugins["IPVideoTalk Plug-in for IE"] || navigator.plugins["IPVideoTalk Plug-in for Safari"]))) {
           // console.log("Plugin version: " + pluginObj.versionName + ", adapter version: 1.3.1");
            //logging("Plugin version: " + pluginObj.versionName + ", adapter version: 1.0.4");
            logging("adapter version: 2.0.3.1, Start to load the Plugin!!");
            if (isInternetExplorer) {
                //console.log("This appears to be Internet Explorer");
                logging("This appears to be Internet Explorer");
                webrtcDetectedBrowser = "Internet Explorer";
            }
            else if (isSafari) {
                //console.log("This appears to be Safari");
                logging("This appears to be Safari");
                webrtcDetectedBrowser = "Safari";
            }
            else; // any other NAPAPI-capable browser comes here
        }
        else {
            //console.log("Browser does not appear to be WebRTC-capable");
            logging("Browser does not appear to be WebRTC-capable");
            //Removed the element, if the plugin installing failed
            document.body.removeChild(pluginObj);
        }

        //For telling the result of plugin installing  
        if ( pluginObj.versionName == undefined ) {
            logging("Plugin installing is not finished");

            return { installed: undefined, version: undefined };
        } 
        logging("Plugin installation is successful !! version is "+pluginObj.versionName);
        //Set Log severity as Info
        pluginObj.logSeverity = "info";

        return { installed: true, version: pluginObj.versionName };

};



var pluginShim = {
   shimCreateIceServer: function (url, username, password) {
        var url_parts = url.split(':');
        if (url_parts[0].indexOf('stun') === 0) {
            return { 'url': url };
        } else if (url_parts[0].indexOf('turn') === 0) {
            return {
                'url': url,
                'credential': password,
                'username': username
            };
        }
        return null;
    },
    attachEventListener: function (elt, type, listener, useCapture) {
        var _pluginObj = extractPluginObj(elt);
        if (_pluginObj) {
            _pluginObj.bindEventListener(type, listener, useCapture);
        }
        else {
            if (typeof elt.addEventListener !== "undefined") {
                elt.addEventListener(type, listener, useCapture);
            }
            else if (typeof elt.addEvent !== "undefined") {
                elt.addEventListener("on" + type, listener, useCapture);
            }
        }
    },
    checkPlugin: function() {
        if (browserDetails.browser == "safari") {
           if ( navigator.plugins["IPVideoTalk Plug-in for Safari"] != undefined) {
        	  var version = undefined;
        	  var v1 = navigator.plugins["IPVideoTalk Plug-in for Safari"];
              if (v1 && v1 != ""){
            	  var v2 = v1.description;
            	  if (v2 && v2 != ""){
            		  version = v2.match(/[.0-9]+/);
            		  if (version && version.length > 0){
            			  version = version[0];
            		  }
            	  }
              }
              if (version == undefined) {
                version = "1.0.1.3";
              }
              browserDetails.WebRTCPluginVersion = version;
              browserDetails.isWebRTCPluginInstalled = true;
              browserDetails.isSupportWebRTC = true;
           }

        } else if (browserDetails.browser == "ie") {
            //It said IE11 support navigator.plugins...  just said...
            var result = installPlugin();
            browserDetails.isWebRTCPluginInstalled = result.installed;//installing is undefined
            if (result.installed == true) {
                browserDetails.WebRTCPluginVersion = result.version;
                browserDetails.isSupportWebRTC = true;
            } else if (result.installed == false) {
                /*Install Plugin failed !!!*/
                browserDetails.WebRTCPluginVersion = null;
                browserDetails.isSupportWebRTC = false;
                browserDetails.isWebRTCPluginInstalled = false;
            }
        }
        logging("checkPlugin >>> Installed: "+browserDetails.isWebRTCPluginInstalled+"   version: "+browserDetails.WebRTCPluginVersion);
        
        
      	return {"isWebRTCPluginInstalled":browserDetails.isWebRTCPluginInstalled,"WebRTCPluginVersion":browserDetails.WebRTCPluginVersion};
        
    },
    loadPlugin:  function(callback) {
        logging("loadPlugin !!!!!!!");
        if (browserDetails.WebRTCPluginVersion != undefined) {
            if (callback){//it's mean already installed
            	callback();
            }
        } else {
            loadCount--;
            var result = installPlugin();

            browserDetails.isWebRTCPluginInstalled = result.installed;//installing is undefined
            if (result.installed == true) {
                browserDetails.WebRTCPluginVersion = result.version;
                browserDetails.isSupportWebRTC = true;
                if (callback){
                	callback();
                }
            } else if (loadCount <= 0) {
                /*Install Plugin failed !!!*/
                browserDetails.WebRTCPluginVersion = null;
                browserDetails.isSupportWebRTC = false;
                browserDetails.isWebRTCPluginInstalled = false;
                if (callback){
                	callback("not found plugin");
                }
            }else{//if not get result in this loop, will try later
            	setTimeout(function(){pluginShim.loadPlugin(callback);}, 300);
            }
        }
    },

    attachMediaStream: function(element, stream) {
        logging("Plugin: Attaching media stream");
        if (stream==null) {
          logging("stream is null");
        }
        if (!element) {
            return null;
        }
        if (element.isWebRtcPlugin) {
            element.src = stream;
            return element;
        }
        else if (element.nodeName.toLowerCase() === 'video') {
            if (!element.pluginObj && stream) {
                logging("Plugin: Create plugin Object");

                var _pluginObj = document.createElement('object');
                var _isIE = (Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(window, "ActiveXObject")) || ("ActiveXObject" in window);
                if (_isIE) {
                    // windowless
                    var windowlessParam = document.createElement("param");
                    windowlessParam.setAttribute('name', 'windowless');
                    windowlessParam.setAttribute('value', true);
                    _pluginObj.appendChild(windowlessParam);
                    _pluginObj.setAttribute('classid', 'CLSID:C14F046D-EC06-4A58-8594-008226370B22');
                } else {
                    _pluginObj.setAttribute('type', 'application/ipvt-plugin');
                }
                element.pluginObj = _pluginObj;

                _pluginObj.setAttribute('className', element.className);
                _pluginObj.setAttribute('innerHTML', element.innerHTML);
          
                var width = element.getAttribute("width");
                var height = element.getAttribute("height");
                var bounds = element.getBoundingClientRect();
                var zindex = element.getAttribute("zindex");
                if (!width) width = bounds.right - bounds.left;
                if (!height) height = bounds.bottom - bounds.top;
                if (!zindex) {
                   _pluginObj.setAttribute('zindex', 1);
                   element.setAttribute('zindex', 0);
                } else {
                   _pluginObj.setAttribute('zindex', zindex+1);

                }

                if ("getComputedStyle" in window) {
                    var computedStyle = window.getComputedStyle(element, null);
                    if (!width && computedStyle.width != 'auto' && computedStyle.width != '0px') {
                        width = computedStyle.width;
                    }
                    if (!height && computedStyle.height != 'auto' && computedStyle.height != '0px') {
                        height = computedStyle.height;
                    }
                }
                if (width) _pluginObj.setAttribute('width', width);
                else _pluginObj.setAttribute('autowidth', true);
                if (height) _pluginObj.setAttribute('height', height);
                else _pluginObj.setAttribute('autoheight', true);

                //For resizing the plugin video object with id
                if (element.id) {
                    _pluginObj.id = element.id;
                    //element.id = null;
                }

                document.body.appendChild(_pluginObj);
                if (element.parentNode) {
                    //element.parentNode.replaceChild(_pluginObj, element); // replace (and remove) element
                    // add element again to be sure any query() will succeed
                    //document.body.appendChild(element);
                    element.parentNode.insertBefore(_pluginObj, element);
                    element.style.display = "none";
                    //element.style.visibility = "hidden";
                    //_pluginObj.style.visibility = "hidden";
                }
            }

             if (element.pluginObj) {

                element.pluginObj.addEventListener('play', function(objvid) {
                    if (element.pluginObj) {
                        if (element.pluginObj.getAttribute("autowidth") && objvid.videoWidth) {
                            element.pluginObj.setAttribute('width', objvid.videoWidth);
                        }
                        if (element.pluginObj.getAttribute("autoheight") && objvid.videoHeight) {
                            element.pluginObj.setAttribute('height', objvid.videoHeight);
                        }
                    }
                });

                // TODO: For adjust the video size synced with the original video element (rzhang)

                 element.pluginObj.src = stream;
                 //after setting src, hide video
                 //if(adapter.browserDetails.browser == 'ie'){
                 //    element.pluginObj.style.display = "none";
                 //}
                logging("Plugin: Attaching media stream DONE !!!");
            }

            return element.pluginObj;
        }
        else if (element.nodeName.toLowerCase() === 'audio') {
            return element;
        }
    },

    drawImage: function (context, video, x, y, width, height) {
        var pluginObj = extractPluginObj(video);
        if (pluginObj && pluginObj.isWebRtcPlugin && pluginObj.videoWidth > 0 && pluginObj.videoHeight > 0) {
            if (typeof pluginObj.getScreenShot !== "undefined") {
                var bmpBase64 = pluginObj.getScreenShot();
                if (bmpBase64) {
                    var image = new Image();
                    image.onload = function () {
                        context.drawImage(image, 0, 0, width, height);
                    };
                    image.src = "data:image/png;base64," + bmpBase64;
                }
            }
            else {
                var imageData = context.createImageData(pluginObj.videoWidth, pluginObj.videoHeight);
                if (imageData) {
                    pluginObj.fillImageData(imageData);
                    context.putImageData(imageData, x, y/*, width, height*/);
                }
            }
        }
    },

    // http://www.w3.org/TR/webrtc/#interface-definition
    // http://www.w3.org/TR/webrtc/#rtcpeerconnection-interface-extensions-2
    shimRTCPeerConnection: function (configuration, constraints) {
        return getPlugin().createPeerConnection(configuration, constraints);
    },

    // http://www.w3.org/TR/webrtc/#rtcicecandidate-type
    shimRTCIceCandidate: function (RTCIceCandidateInit) {
        return getPlugin().createIceCandidate(RTCIceCandidateInit);
    },

    // http://www.w3.org/TR/webrtc/#session-description-model
    shimRTCSessionDescription: function (RTCSessionDescriptionInit) {
        return getPlugin().createSessionDescription(RTCSessionDescriptionInit);
    },

  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() { return this._ontrack; },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing stream.
            // but stream.onaddtrack is implemented so we use that
            e.stream.addEventListener('addtrack', function(te) {
              var event = new Event('track');
              event.track = te.track;
              event.receiver = {track: te.track};
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or removed.
            // Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimLoadWindows: function() {
        if (getPlugin()) {
            if (typeof getPlugin().getWindowList !== 'undefined') {
                var windowArray = [];
                var windowsStr = getPlugin().getWindowList();
                var windowList = windowsStr.split(/xxz;;;xxz/);
                for (var i = 0; i < windowList.length; ++i) {
                    var windowValues = windowList[i].split(/xxy;;;xxy/);
                    var option = { windowId: "", windowName: "", previewImg64: null };
                    option.windowId = windowValues[0];
                    option.windowName = windowValues[1];
                    option.previewImg64 = windowValues[2]; // Preview encoded as bas64
                    if ( option.windowId != "" ) {
                        windowArray[i] = option;
                    }
                }
                return windowArray;
            }
            else {
                logging("Plugin with support for getWindowList not installed");
            }
        }
   },
  //For Safari only
  shimLoadScreens: function() {
        if (getPlugin()) {
            if (typeof getPlugin().getScreenList !== 'undefined') {
                var screenArray = [];
                var screenStr = getPlugin().getScreenList();
                var screenList = screenStr.split(/xxz;;;xxz/);
                for (var i = 0; i < screenList.length; ++i) {
                    var screenValues = screenList[i].split(/xxy;;;xxy/);
                    var option = { screenId: "", screenName: "", previewImg64: null };
                    option.screenId = screenValues[0];
                    option.screenName = screenValues[1];
                    option.previewImg64 = screenValues[2]; // Preview encoded as bas64
                    if ( option.screenId != "" ) {
                        screenArray[i] = option;
                    }
                }
                return screenArray;
            }
            else {
                logging("Plugin with support for getScreenList not installed");
            }
        }
   }


};

// Expose public methods.
module.exports = {
  shimOnTrack: pluginShim.shimOnTrack,
  shimSourceObject: pluginShim.shimSourceObject,
  shimPeerConnection: pluginShim.shimRTCPeerConnection,
  shimGetUserMedia: require('./getusermedia'),
  attachMediaStream: pluginShim.attachMediaStream,
  shimRTCIceCandidate: pluginShim.shimRTCIceCandidate,
  shimRTCSessionDescription: pluginShim.shimRTCSessionDescription,
  //shimInstallPlugin: pluginShim.installPlugin,
  shimAttachEventListener: pluginShim.attachEventListener,
  loadWindows: pluginShim.shimLoadWindows,
  loadScreens: pluginShim.shimLoadScreens,
  checkPlugin: pluginShim.checkPlugin,
  loadPlugin: pluginShim.loadPlugin
 //reattachMediaStream: pluginShim.reattachMediaStream
};
