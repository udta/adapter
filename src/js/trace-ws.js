var PROTOCOL_VERSION = '1.0';
module.exports = function(wsURL) {
  var buffer = [];
  var confID = !window.sessionStorage.confID ? "UnKnown" : window.sessionStorage.confID;
  var email  = !window.localStorage.email ? "Anonymous@x.com" : window.localStorage.email;
  var id = confID + '__' + email + '__' + Math.random().toString(36).substr(2);

  var connection = new WebSocket(wsURL+'/stats?id='+id, PROTOCOL_VERSION);
  connection.onerror = function(e) {
    console.log('WS ERROR', e);
  };

  
  connection.onclose = function() {
    // reconnect
    var origConnection = connection;
    connection = new WebSocket(wsURL + '/stats?id=' + id, PROTOCOL_VERSION); 
    connection.onerror = origConnection.onerror;
    connection.onclose = origConnection.onclose;
    connection.onopen  = origConnection.onopen;
    origConnection = null; //Delete
  };

  connection.onopen = function() {
    while (buffer.length) {
      connection.send(JSON.stringify(buffer.shift()));
    }
  };

  /*
  connection.onmessage = function(msg) {
    // no messages from the server defined yet.
  };
  */

  function trace() {
    //console.log.apply(console, arguments);
    // TODO: drop getStats when not connected?
    var args = Array.prototype.slice.call(arguments);
    args.push(new Date().getTime());
    if (connection.readyState === 1) {
      connection.send(JSON.stringify(args));
    } else {
      buffer.push(args);
    }
  }
  return trace;
}
