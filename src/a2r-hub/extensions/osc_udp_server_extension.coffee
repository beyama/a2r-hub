hub = require "../"

class OscUdpServerExtension extends hub.net.ServerExtension
  @protocol  = "udp+osc:"
  @configKey = "osc_udp"
  @clientClass = require "./osc_udp_server/client"
  @serverClass = require "./osc_udp_server/server"

module.exports = OscUdpServerExtension
