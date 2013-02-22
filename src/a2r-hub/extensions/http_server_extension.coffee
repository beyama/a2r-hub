hub = require "../"
Summer = require "summer"

HttpServer = require "./http_server/http_server"
WebSocketClient = require "./http_server/web_socket_client"

class HttpServerExtension extends hub.net.ServerExtension
  Summer.autowire @, jsonRPC: "jsonRPC"

  @HttpServer = HttpServer
  @WebSocketClient = WebSocketClient

  @protocol    = "http:"
  @configKey   = "http"
  @serverClass = @HttpServer

  start: (callback)->
    @connections.registerClientHandler("ws:", WebSocketClient)
    super(callback)

module.exports = HttpServerExtension
