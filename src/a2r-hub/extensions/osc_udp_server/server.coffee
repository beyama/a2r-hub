hub = require "../../"

class OscUdpServer extends hub.net.UdpServer
  @clientClass    = require "./client"
  @defaultOptions = { type: "udp", protocol: "udp+osc:", port: 5001 }

module.exports = OscUdpServer
