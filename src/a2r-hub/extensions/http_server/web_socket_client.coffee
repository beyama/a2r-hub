hub = require "../../"
osc = require "a2r-osc"

SEND_OPTIONS = binary: true, mask: false

class WebSocketClient extends hub.net.Client
  constructor: (server, socket, session)->
    # the WebSocket
    @socket = socket
    # the underlying socket
    _socket = @socket._socket
    super(server, _socket.remoteAddress, _socket.remotePort, session)

    @socket.on("error", @onSocketError.bind(@))
    @socket.on("close", @onSocketClose.bind(@))
    @socket.on("message", @onSocketMessage.bind(@))

    setTimeout =>
      msg = new osc.Message("/foo/rocks", osc.Impulse)
      @sendData(msg.toBuffer())

  initAsServerClient: ->

  initAsClient: ->

  sendData: (data)->
    console.log "sendData", data
    @socket.send(data, SEND_OPTIONS)

  onMessage: (message)=>
    @hub.send(message)

  onSocketError: (error)->
    @logger.error("WebSocketClient error #{@id}")
    @logger.error(error.stack)
    @emit("error", error)

  onSocketClose: -> @dispose()

  onSocketMessage: (message)->
    try
      @logger.info("Got message from `#{@id}` - #{message}")
      message = osc.fromBuffer(message)
      @hub.send(message)
    catch e
      @emit("error", e)

module.exports = WebSocketClient
