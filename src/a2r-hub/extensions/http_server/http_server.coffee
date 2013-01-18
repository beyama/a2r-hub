hub = require "../../"
cookieParser = require "cookie"
cookieSignature = require "cookie-signature"

WebSocketServer = require("ws").Server
WebSocketClient = require("./web_socket_client")

class HttpServer extends hub.net.HttpServer
  @defaultOptions = { type: "tcp", protocol: "http:", port: 8080 }

  constructor: (options)->
    super(options)

  initSocket: ->
    super
    @express = @context.get("express")
    # set express request callback
    @socket.on("request", @express)
    @wss = new WebSocketServer(server: @socket)
    @wss.on("connection", @onWebSocketConnection.bind(@))

  close: ->
    return if @closed
    @wss.close()
    super

  onWebSocketConnection: (socket)->
    _socket = socket._socket
    @logger.info("WebSocket client connected from '#{_socket.remoteAddress}:#{_socket.remotePort}'")
    @authorizeWebSocket socket, (message, accept)=>
      if accept
        session = @hub.createSession()
        client = new WebSocketClient(@, socket, session)
        try
          @registerClient(client)
          @logger.info("WebSocket client connection established #{client.id}")
        catch e
          @logger.error("HttpServer: Error registering client")
          @logger.error(e.stack)
          session.close()
      else
        socket.close(403, message)

  authorizeWebSocket: (socket, accept)->
    cookie = socket.upgradeReq.headers.cookie

    # check if there's a cookie header
    if cookie
        # if there is, parse the cookie
        cookie = cookieParser.parse(cookie)
        # note that you will need to use the same key to grad the
        # session id, as you specified in the Express setup.
        sessionID = cookie['express.sid']
        # unsign session id
        if sessionID.indexOf("s:") is 0
          # TODO: get secret from express
          sessionID = cookieSignature.unsign(sessionID[2..-1], "secret")

        # (literally) get the session data from the session store
        sessionStore = @express.set("session store")
        sessionStore.get sessionID, (err, session)->
          if err or not session
            # if we cannot grab a session, turn down the connection
            accept('Error', false)
          else
            # save the session data and accept the connection
            socket.session = session
            accept(null, true)
    else
       # if there isn't, turn down the connection with a message
       # and leave the function.
       accept('No cookie transmitted.', false)

module.exports = HttpServer
