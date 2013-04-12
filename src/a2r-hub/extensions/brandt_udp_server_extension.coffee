hub = require "../"

Summer = require "summer"

class BrandtUdpServerExtension extends hub.net.ServerExtension
  Summer.autowire(@, jamService: "jamService")

  @protocol  = "udp+brandt:"
  @configKey = "brandt_udp"
  @serverClass = require "./brandt_udp_server/server"
  @clientClass = require "./brandt_udp_server/client"

module.exports = BrandtUdpServerExtension
