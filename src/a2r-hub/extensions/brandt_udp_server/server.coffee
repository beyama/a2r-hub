hub = require "../../"

class BrandtUdpServer extends hub.net.UdpServer
  @clientClass    = require "./client"
  @defaultOptions = { type: "udp", protocol: "udp+brandt:", port: 3001 }

module.exports = BrandtUdpServer
