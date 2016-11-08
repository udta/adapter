/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logDisabled_ = false;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log.apply(console, arguments);
      }
    }
  },

  /**
   * Extract browser version out of the provided user agent string.
   *
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   *
   * @return {object} result containing browser and version
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;

    // Fail early if it's not a browser
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a browser.';
      return result;
    }

    // Edge.
     if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);
    
    } // IE
    else if ( !navigator.mediaDevices && ( !!window.ActiveXObject 
                                         || 'ActiveXObject' in window  ||
                                         navigator.userAgent.match(/MSIE (\d+)/) 
                                         || navigator.userAgent.match(/rv:(\d+)/) ) ) {
      result.browser = 'ie';
      result.version = this.extractVersion(navigator.userAgent,
          /MSIE (\d+).(\d+)/, 1);

      /*For IE 11*/
      if (navigator.userAgent.match(/rv:(\d+)/)) {
          result.version = this.extractVersion(navigator.userAgent, /rv:(\d+).(\d+)/, 1);
      }

      // Firefox.
    } else if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/([0-9]+)\./, 1);

    // all webkit-based browsers
    } else if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
      // Chrome, Chromium, Webview, Opera, all use the chrome shim for now
      var isOpera = navigator.userAgent.match(/(OPR|Opera).([\d.]+)/) ? true : false;
      if (isOpera) {
          result.browser = 'opera';
          result.version = this.extractVersion(navigator.userAgent,
              /O(PR|pera)\/([0-9]+)\./, 2);
      } else {
          result.browser = 'chrome';
          result.version = this.extractVersion(navigator.userAgent,
              /Chrom(e|ium)\/([0-9]+)\./, 2);
      }

    // Safari or unknown webkit-based
    // for the time being Safari has support for MediaStreams but not webRTC
    //Safari without webRTC and with partly webRTC support
    } else if ( (!navigator.webkitGetUserMedia && navigator.userAgent.match(/AppleWebKit\/([0-9]+)\./) ) 
         || (navigator.webkitGetUserMedia && !navigator.webkitRTCPeerConnection) ) {
        // Safari UA substrings of interest for reference:
        // - webkit version:           AppleWebKit/602.1.25 (also used in Op,Cr)
        // - safari UI version:        Version/9.0.3 (unique to Safari)
        // - safari UI webkit version: Safari/601.4.4 (also used in Op,Cr)
        //
        // if the webkit version and safari UI webkit versions are equals,
        // ... this is a stable version.
        //
        // only the internal webkit version is important today to know if
        // media streams are supported
        //
        if (navigator.userAgent.match(/Version\/(\d+).(\d+)/)) {
          result.browser = 'safari';
          result.version = this.extractVersion(navigator.userAgent,
            /AppleWebKit\/([0-9]+)\./, 1);

        // unknown webkit-based browser
        } else {
          result.browser = 'Unsupported webkit-based browser ' +
              'with GUM support but no WebRTC support.';
          return result;
        }
    // Default fallthrough: not supported.
    } else {
      result.browser = 'Not a supported browser.';
      return result;
    }

    return result;
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion
};
