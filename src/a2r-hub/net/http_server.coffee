http = require "http"
TcpServer = require "./tcp_server"

class HttpServer extends TcpServer

  createServer: ->
    http.createServer()

module.exports = HttpServer
