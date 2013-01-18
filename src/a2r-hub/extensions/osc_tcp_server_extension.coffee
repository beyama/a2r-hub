hub = require "../"

class OscTcpServerExtension extends hub.net.ServerExtension
  @protocol  = "tcp+osc:"
  @configKey = "osc_tcp"
  @clientClass = require "./osc_tcp_server/client"
  @serverClass = require "./osc_tcp_server/server"

module.exports = OscTcpServerExtension
