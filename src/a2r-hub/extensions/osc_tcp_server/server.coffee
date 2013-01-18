hub = require "../../"

class OscTcpServer extends hub.net.TcpServer
  @clientClass    = require "./client"
  @defaultOptions = { type: "tcp", protocol: "tcp+osc:", port: 5000 }

module.exports = OscTcpServer
