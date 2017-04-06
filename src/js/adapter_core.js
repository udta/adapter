/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var utils = require('./utils');
  var logging = utils.log;
  var browserDetails = utils.browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = utils.extractVersion;
  module.exports.disableLog = utils.disableLog;

  window.browserDetails = browserDetails;

  // Uncomment the line below if you want logging to occur, including logging
  // for the switch statement below. Can also be turned on in the browser via
  // adapter.disableLog(false), but then logging from the switch statement below
  // will not appear.
  // require('./utils').disableLog(false);

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;
  var safariShim = require('./safari/safari_shim') || null;
  var pluginShim = require('./plugin/plugin_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'chrome':
      if (!chromeShim || !chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimMediaStream();
      utils.shimCreateObjectURL();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      browserDetails.isSupportWebRTC = true;
      browserDetails.isSupportORTC = false;
      browserDetails.isWebRTCPluginInstalled = false;
      browserDetails.WebRTCPluginVersion = undefined;
      window.attachMediaStream = chromeShim.attachMediaStream;

      chromeShim.shimGetSendersWithDtmf();
      break;
    case 'firefox':
      if (!firefoxShim || !firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      utils.shimCreateObjectURL();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      browserDetails.isSupportWebRTC = true;
      browserDetails.isSupportORTC = false;
      browserDetails.isWebRTCPluginInstalled = false;
      browserDetails.WebRTCPluginVersion = undefined;
      window.attachMediaStream = firefoxShim.attachMediaStream;

      break;
    case 'edge':
      if (!edgeShim || !edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimGetUserMedia();
      utils.shimCreateObjectURL();
      if ( browserDetails.version >= 15009 ) {
         //New Edge support WebRTC
         edgeShim.shimPeerConnection();
         edgeShim.shimReplaceTrack();
         browserDetails.isSupportWebRTC = true;
      } else {
         edgeShim.shimPeerConnection();
         edgeShim.shimReplaceTrack();
         browserDetails.isSupportWebRTC = false;
      }
      
      browserDetails.isSupportORTC = true;
      browserDetails.isWebRTCPluginInstalled = false;
      browserDetails.WebRTCPluginVersion = undefined;
      window.attachMediaStream = edgeShim.attachMediaStream;

      break;
    case 'safari':
      if (navigator.webkitGetUserMedia) {
          if (!safariShim) {
            logging('Safari shim is not included in this adapter release.');
            return;
          }

          // Export to the adapter global object visible in the browser.
          module.exports.browserShim = safariShim;
          safariShim.shimOnAddStream();
          safariShim.shimGetUserMedia();
          logging('adapter.js shimming safari.');
      } else {
          if (!pluginShim||!pluginShim.shimPeerConnection) {
              logging('Safari Plugin shim is not included in this adapter release.');
              return;
            }

          // init  You need to call loadPlugin() first of all....
          browserDetails.isSupportWebRTC = false;
          browserDetails.isSupportORTC = false;
          browserDetails.isWebRTCPluginInstalled = undefined; //Means the plugin installation is not start yet.
          browserDetails.WebRTCPluginVersion = undefined;
          // Export to the adapter global object visible in the browser.
          module.exports.browserShim = pluginShim;
          
          //pluginShim.loadPlugin(); 
          //set function handlers
          pluginShim.shimGetUserMedia();
          window.RTCPeerConnection = pluginShim.shimPeerConnection;
          //pluginShim.shimPeerConnection();
          window.RTCIceCandidate = pluginShim.shimRTCIceCandidate;
          window.RTCSessionDescription = pluginShim.shimRTCSessionDescription;
          window.attachMediaStream = pluginShim.attachMediaStream;
          window.loadWindows = pluginShim.loadWindows;
          window.loadScreens = pluginShim.loadScreens;

          //pluginShim.shimOnTrack();
          logging('adapter.js shimming safari with plugin');
      }
      break;
    case 'ie':
      if (!pluginShim||!pluginShim.shimPeerConnection) {
          logging('IE Plugin shim is not included in this adapter release.');
          return;
        }
        

      logging('adapter.js shimming IE!');

      // init  You need to call loadPlugin() first of all....
      browserDetails.isSupportWebRTC = false;
      browserDetails.isSupportORTC = false;
      browserDetails.isWebRTCPluginInstalled = undefined; //Means the plugin installation is not start yet.
      browserDetails.WebRTCPluginVersion = undefined;
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = pluginShim;
      //pluginShim.loadPlugin();
      
      //set function handlers
      pluginShim.shimGetUserMedia();
      window.RTCPeerConnection = pluginShim.shimPeerConnection;
      //pluginShim.shimPeerConnection();
      window.RTCIceCandidate = pluginShim.shimRTCIceCandidate;
      window.RTCSessionDescription = pluginShim.shimRTCSessionDescription;
      window.attachMediaStream = pluginShim.attachMediaStream;
      window.loadWindows = pluginShim.loadWindows;
      //window.loadScreens = pluginShim.loadScreens; //Haven't support

      //pluginShim.shimOnTrack();
      break;
    default:
      logging('Unsupported browser!');
  }
})();
