hub = require "../../"

WebSocketServer = require("ws").Server
WebSocketClient = require("./web_socket_client")

class HttpServer extends hub.net.HttpServer
  @defaultOptions = { type: "tcp", protocol: "http:", port: 8080 }

  constructor: (options)->
    super(options)

  initSocket: ->
    super
    @connect = @context.get("connect")
    # set connect request callback
    @socket.on("request", @connect)
    @wss = new WebSocketServer(server: @socket)
    @wss.on("connection", @onWebSocketConnection.bind(@))
    @wss.on("error", @onError.bind(@))

  dispose: ->
    return if @disposed
    @wss.close()
    super

  onWebSocketConnection: (socket)->
    _socket = socket._socket

    @logger.info("WebSocket client connected from '#{_socket.remoteAddress}:#{_socket.remotePort}'")

    session = @hub.createSession()

    # create new websocket client
    options =
      ip: _socket.remoteAddress
      port: _socket.remotePort
      server: @
      socket: socket
      context: @context
      session: session

    try
      client = new WebSocketClient(options)
      @logger.info("New WebSocket connection from `#{client.address}`")
    catch e
      @logger.error("HttpServer: Couldn't create WebSocket client connection for `#{_socket.remoteAddress}:#{_socket.remotePort}`")
      @logger.debug(e.stack)
      client.dispose() if client
      session.dispose()
      return
    
    client

module.exports = HttpServer
