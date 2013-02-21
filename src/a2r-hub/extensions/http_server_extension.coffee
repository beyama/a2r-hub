hub = require "../"
Summer = require "summer"

class HttpServerExtension extends hub.net.ServerExtension
  @protocol    = "http:"
  @configKey   = "http"
  @serverClass = require "./http_server/http_server"

module.exports = HttpServerExtension
