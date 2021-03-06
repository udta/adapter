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
var deprecationWarnings_ = true;

/**
 * Extract browser version out of the provided user agent string.
 *
 * @param {!string} uastring userAgent string.
 * @param {!string} expr Regular expression used as match criteria.
 * @param {!number} pos position in the version string to be returned.
 * @return {!number} browser version.
 */
function extractVersion(uastring, expr, pos) {
  var match = uastring.match(expr);
  return match && match.length >= pos && parseInt(match[pos], 10);
}

// Utility methods.
module.exports = {
  extractVersion: extractVersion,
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  /**
   * Disable or enable deprecation warnings
   * @param {!boolean} bool set to true to disable warnings.
   */
  disableWarnings: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    deprecationWarnings_ = !bool;
    return 'adapter.js deprecation warnings ' + (bool ? 'disabled' : 'enabled');
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
   * Shows a deprecation warning suggesting the modern and spec-compatible API.
   */
  deprecated: function(oldMethod, newMethod) {
    if (!deprecationWarnings_) {
      return;
    }
    console.warn(oldMethod + ' is deprecated, please use ' + newMethod +
        ' instead.');
  },

  /**
   * Browser detector.
   *
   * @return {object} result containing browser and version
   *     properties.
   */
  detectBrowser: function(window) {
      var navigator = window && window.navigator;

      // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;
    result.UIVersion = null;

    // Fail early if it's not a browser
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a browser.';
      return result;
    }

    // Edge.
     if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
      result.browser = 'edge';
      result.version = extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);
      result.UIVersion = navigator.userAgent.match(/Edge\/([\d.]+)/)[1]; //Edge/16.17017
    
    } // IE
    else if ( !navigator.mediaDevices && ( !!window.ActiveXObject 
                                         || 'ActiveXObject' in window  ||
                                         navigator.userAgent.match(/MSIE (\d+)/) 
                                         || navigator.userAgent.match(/rv:(\d+)/) ) ) {
      result.browser = 'ie';
      if ( navigator.userAgent.match(/MSIE (\d+)/) ) {
        result.version = extractVersion(navigator.userAgent, /MSIE (\d+).(\d+)/, 1);
        result.UIVersion = navigator.userAgent.match(/MSIE ([\d.]+)/)[1]; //MSIE 10.6

      } else if ( navigator.userAgent.match(/rv:(\d+)/) ) {
          /*For IE 11*/
          result.version = extractVersion(navigator.userAgent, /rv:(\d+).(\d+)/, 1);
          result.UIVersion = navigator.userAgent.match(/rv:([\d.]+)/)[1]; //rv:11.0
      }

      // Firefox.
    } else if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = extractVersion(navigator.userAgent,
          /Firefox\/(\d+)\./, 1);
      result.UIVersion = navigator.userAgent.match(/Firefox\/([\d.]+)/)[1]; //Firefox/56.0

    // all webkit-based browsers
    } else if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
      // Chrome, Chromium, Webview, Opera, Vivaldi all use the chrome shim for now
      var isOpera = navigator.userAgent.match(/(OPR|Opera).([\d.]+)/) ? true : false;
        //var isVivaldi = navigator.userAgent.match(/(Vivaldi).([\d.]+)/) ? true : false;
        if (isOpera) {
          result.browser = 'opera';
          result.version = extractVersion(navigator.userAgent,
              /O(PR|pera)\/(\d+)\./, 2);
          result.UIVersion = navigator.userAgent.match(/O(PR|pera)\/([\d.]+)/)[2]; //OPR/48.0.2685.39
      }/* else if (isVivaldi) {
          result.browser = 'vivaldi';
          result.version = extractVersion(navigator.userAgent,
                                            /(Vivaldi)\/(\d+)\./, 2);
          result.UIVersion = navigator.userAgent.match(/Vivaldi\/([\d.]+)/)[1]; //Vivaldi/1.93.955.38
     }*/ else {
          result.browser = 'chrome';
          result.version = extractVersion(navigator.userAgent,
              /Chrom(e|ium)\/(\d+)\./, 2);
          result.UIVersion = navigator.userAgent.match(/Chrom(e|ium)\/([\d.]+)/)[2]; //Chrome/61.0.3163.100 
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
          result.version = extractVersion(navigator.userAgent,
            /AppleWebKit\/(\d+)\./, 1);
          result.UIVersion = navigator.userAgent.match(/Version\/([\d.]+)/)[1]; //Version/11.0.1

        } else { // unknown webkit-based browser.
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
