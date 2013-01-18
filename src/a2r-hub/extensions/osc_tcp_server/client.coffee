osc  = require "a2r-osc"
slip = require "node-a2r-slip"
hub  = require "../../"

class OscTcpClient extends hub.net.TcpClient
  constructor: (options)->
    super(options)

  initSocket: ->
    super
    @_createInStream()
    @_createOutStream()

  # Send an OSC message to the client.
  sendOSC: (message)->
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

  onOscMessage: (message)-> @hub.send(message)

  close: ->
    @sendOSC(new osc.Message("/a2r/close", osc.Impulse))
    super

module.exports = OscTcpClient
