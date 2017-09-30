/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

var utils = require('./utils');
// Shimming starts here.
module.exports = function(dependencies, opts) {
  var window = dependencies && dependencies.window;

  var options = {
    shimChrome: true,
    shimFirefox: true,
    shimEdge: true,
    shimSafari: true,
    shimPlugin: true,
  };

  for (var key in opts) {
    if (hasOwnProperty.call(opts, key)) {
      options[key] = opts[key];
    }
  }

  // Utils.
  var logging = utils.log;
  var browserDetails = utils.detectBrowser(window);

  // Export to the adapter global object visible in the browser.
  var adapter = {
    browserDetails: browserDetails,
    extractVersion: utils.extractVersion,
    disableLog: utils.disableLog,
    disableWarnings: utils.disableWarnings
  };

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
  var commonShim = require('./common_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'chrome':
    case 'opera':
    case 'vivaldi':
      if (!chromeShim || !chromeShim.shimPeerConnection ||
          !options.shimChrome) {
        logging('Chrome shim is not included in this adapter release.');
        return adapter;
      }
      logging('adapter.js shimming ' + browserDetails.browser );
      // Export to the adapter global object visible in the browser.
      adapter.browserShim = chromeShim;
      commonShim.shimCreateObjectURL(window);

      chromeShim.shimGetUserMedia(window);
      chromeShim.shimMediaStream(window);
      chromeShim.shimSourceObject(window);
      chromeShim.shimPeerConnection(window);
      chromeShim.shimOnTrack(window);
      chromeShim.shimAddTrackRemoveTrack(window);
      chromeShim.shimGetSendersWithDtmf(window);
      chromeShim.shimAttachMediaStream(window);


      commonShim.shimRTCIceCandidate(window);

      adapter.browserDetails.isSupportWebRTC = true;
      adapter.browserDetails.isSupportORTC = false;
      adapter.browserDetails.isWebRTCPluginInstalled = false;
      adapter.browserDetails.WebRTCPluginVersion = undefined;
      break;
    case 'firefox':
      if (!firefoxShim || !firefoxShim.shimPeerConnection ||
          !options.shimFirefox) {
        logging('Firefox shim is not included in this adapter release.');
        return adapter;
      }
      logging('adapter.js shimming firefox.');
      // Export to the adapter global object visible in the browser.
      adapter.browserShim = firefoxShim;
      commonShim.shimCreateObjectURL(window);

      firefoxShim.shimGetUserMedia(window);
      firefoxShim.shimSourceObject(window);
      firefoxShim.shimPeerConnection(window);
      firefoxShim.shimOnTrack(window);
      firefoxShim.shimAttachMediaStream(window);

      commonShim.shimRTCIceCandidate(window);
      adapter.browserDetails.isSupportWebRTC = true;
      adapter.browserDetails.isSupportORTC = false;
      adapter.browserDetails.isWebRTCPluginInstalled = false;
      adapter.browserDetails.WebRTCPluginVersion = undefined;
      break;
    case 'edge':
      if (!edgeShim || !edgeShim.shimPeerConnection || !options.shimEdge) {
        logging('MS edge shim is not included in this adapter release.');
        return adapter;
      }
      logging('adapter.js shimming edge.');
      // Export to the adapter global object visible in the browser.
      adapter.browserShim = edgeShim;
      commonShim.shimCreateObjectURL(window);

      edgeShim.shimGetUserMedia(window);
      edgeShim.shimPeerConnection(window);
      edgeShim.shimReplaceTrack(window);
      edgeShim.shimAttachMediaStream(window);

      if (adapter.browserDetails.version >= 15009) {
        //New Edge support WebRTC
        adapter.browserDetails.isSupportWebRTC = true;
      } else {
        adapter.browserDetails.isSupportWebRTC = false;
      }
      adapter.browserDetails.isSupportORTC = true;
      adapter.browserDetails.isWebRTCPluginInstalled = false;
      adapter.browserDetails.WebRTCPluginVersion = undefined;

      // the edge shim implements the full RTCIceCandidate object.
      break;
    case 'safari':

      if (/*false &&*/ navigator.mediaDevices.getUserMedia) {
          if (!safariShim || !options.shimSafari) {
            logging('Safari shim is not included in this adapter release.');
            return adapter;
          }

          adapter.browserDetails.isSupportWebRTC = true;
          adapter.browserDetails.isSupportORTC = false;
          adapter.browserDetails.isWebRTCPluginInstalled = false;
          adapter.browserDetails.WebRTCPluginVersion = undefined;

          logging('adapter.js shimming safari which is support WebRTC.');
          // Export to the adapter global object visible in the browser.
          adapter.browserShim = safariShim;
          commonShim.shimCreateObjectURL(window);

          safariShim.shimRTCIceServerUrls(window);
          safariShim.shimCallbacksAPI(window);
          safariShim.shimLocalStreamsAPI(window);
          safariShim.shimRemoteStreamsAPI(window);
          safariShim.shimTrackEventTransceiver(window);
          safariShim.shimGetUserMedia(window);
          safariShim.shimCreateOfferLegacy(window);
          safariShim.shimAttachMediaStream(window);

          commonShim.shimRTCIceCandidate(window);
      } else {
          if (!pluginShim || !options.shimPlugin) {
              logging('Safari Plugin shim is not included in this adapter release.');
              return adapter;
          }

          // init  You need to call loadPlugin() first of all....
          adapter.browserDetails.isSupportWebRTC = false;
          adapter.browserDetails.isSupportORTC = false;
          adapter.browserDetails.isWebRTCPluginInstalled = undefined; //Means the plugin installation is not start yet.
          adapter.browserDetails.WebRTCPluginVersion = undefined;
          // Export to the adapter global object visible in the browser.
          adapter.browserShim = pluginShim;
          commonShim.shimCreateObjectURL(window); 

          //pluginShim.loadPlugin();
          //set function handlers
          pluginShim.shimGetUserMedia(window);
          pluginShim.shimPeerConnection(window);
          pluginShim.shimRTCIceCandidate(window);
          pluginShim.shimRTCSessionDescription(window);
          pluginShim.shimOnTrack(window);

          pluginShim.shimAttachMediaStream(window);
          window.loadWindows = pluginShim.loadWindows;
          window.loadScreens = pluginShim.loadScreens; 

          logging('adapter.js shimming safari with plugin'); 
      }
      break;
    case 'ie':
          if (!pluginShim || !options.shimPlugin) {
              logging('IE Plugin shim is not included in this adapter release.');
              return adapter;
          }

          logging('adapter.js shimming IE!');

          // init  You need to call loadPlugin() first of all....
          adapter.browserDetails.isSupportWebRTC = false;
          adapter.browserDetails.isSupportORTC = false;
          adapter.browserDetails.isWebRTCPluginInstalled = undefined; //Means the plugin installation is not start yet.
          adapter.browserDetails.WebRTCPluginVersion = undefined;
          // Export to the adapter global object visible in the browser.
          adapter.browserShim = pluginShim;
          //pluginShim.loadPlugin();

          //set function handlers
          pluginShim.shimGetUserMedia(window);
          pluginShim.shimPeerConnection(window);
          pluginShim.shimRTCIceCandidate(window);
          pluginShim.shimRTCSessionDescription(window);
          pluginShim.shimOnTrack(window);

          pluginShim.shimAttachMediaStream(window);
          window.loadWindows = pluginShim.loadWindows;
          //window.loadScreens = pluginShim.loadScreens; //Haven't support

          break; 
    default:
      logging('Unsupported browser!');
      break;
  }

  //Lock all details
  Object.freeze(adapter.browserDetails.browser)
  Object.freeze(adapter.browserDetails.version)
  Object.freeze(adapter.browserDetails)

  return adapter;
};
