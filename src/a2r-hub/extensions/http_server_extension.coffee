hub = require "../"
Summer = require "summer"

class HttpServerExtension extends hub.net.ServerExtension
  Summer.autowire @, express: "express"

  @protocol    = "http:"
  @configKey   = "http"
  @serverClass = require "./http_server/http_server"

module.exports = HttpServerExtension
