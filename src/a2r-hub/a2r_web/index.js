var Hub = require("../hub");
var osc = Hub.osc;
var WebSocket = (global.WebSocket || global.MozWebSocket);

var ws = new WebSocket("ws://192.168.1.100:8080");

ws.binaryType = "arraybuffer"

ws.onopen = function() {
  console.log("We are ready")
};

ws.onmessage = function(msg) {
  console.log("Whats up?");
  console.log(osc.fromBuffer(msg.data));
};
