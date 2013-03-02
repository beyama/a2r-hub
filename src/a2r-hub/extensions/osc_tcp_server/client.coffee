osc  = require "a2r-osc"
slip = require "node-a2r-slip"
hub  = require "../../"

class OscTcpClient extends hub.net.TcpClient
  @defaultOptions = { type: "tcp", protocol: "tcp+osc:" }

  constructor: (options)->
    super(options)

  initSocket: ->
    @_createInStream()
    @_createOutStream()
    super

  # Send an OSC message to the client.
  sendOSC: (address, typeTag, args)->
    if address instanceof osc.Message or address instanceof osc.Bundle
      message = address
    else
      message = new osc.Message(address, typeTag, args)
    @oscPackStream.send(message)

  # Create stream for incoming data.
  #
  # incoming package -> SLIP decoder -> OSC unpack stream
  _createInStream: ->
    # create OSC stream
    @oscUnpackStream = new osc.UnpackStream()
    # call onMessage with incoming OSC messages
    @oscUnpackStream.on("message", @onOscMessage.bind(@))
    # create SLIP decoder to decode incoming data
    @slipDecoder = new slip.SlipDecoder()
    # pipe encoded data to @oscStream
    @slipDecoder.pipe(@oscUnpackStream)
    # pipe @socket to SLIP decoder
    @socket.pipe(@slipDecoder)
  
  # Create stream for outgoing data.
  #
  # message -> OSC pack stream -> SLIP encoder
  _createOutStream: ->
    # create SLIP encoder to encode outgoing data
    @slipEncoder = new slip.SlipEncoder()
    # pipe SLIP encoded data to socket
    @slipEncoder.pipe(@socket)

    # create OSC pack stream
    @oscPackStream = new osc.PackStream()
    # pipe packed data to SLIP endoder
    @oscPackStream.pipe(@slipEncoder)

  onOscMessage: (message)->
    @emit("osc", message)
    @sendToHub(message)

  dispose: ->
    return if @disposed
    @sendOSC(new osc.Message("/a2r/close", osc.Impulse))
    super

module.exports = OscTcpClient
