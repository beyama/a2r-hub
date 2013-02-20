hub = require "../../"
osc = require "a2r-osc"

SEND_BINARY_OPTIONS = binary: true, mask: false
SEND_TEXT_OPTION = binary: true, mask: false

class WebSocketClient extends hub.net.Client
  @defaultOptions = { type: "tcp", protocol: "ws:" }

  constructor: (options)->
    super(options)

  initAsServerClient: ->
    @socket = @options.socket
    @socket.on("error", @onSocketError.bind(@))
    @socket.on("close", @onSocketClose.bind(@))
    @socket.on("message", @onSocketMessage.bind(@))

    setTimeout =>
      @sendOSC("/hello", osc.Impulse)

    super()

  initAsClient: ->

  send: (buffer, offset, length, callback)->
    if typeof buffer is "string"
      @socket.send(buffer, SEND_TEXT_OPTION, callback)
    else
      if offset isnt 0 or length isnt buffer.length
        buf = new Buffer(length)
        buffer.copy(buf, 0, offset, (offset + length))
        @socket.send(buf, SEND_BINARY_OPTIONS, callback)
      else
        @socket.send(buffer, SEND_BINARY_OPTIONS, callback)

  onSocketError: (error)-> @emit("error", error)

  onSocketClose: -> @dispose()

  onSocketMessage: (message, flags)->
    try
      if flags.binary
        message = osc.fromBuffer(message)
        @logger.info("Got OSC message #{message.address} #{message.arguments}")
        @hub.send(message)
      else
        @logger.info("Got text message from `#{@address}` - #{message}")
    catch e
      @emit("error", e)

module.exports = WebSocketClient
