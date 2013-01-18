osc = require "a2r-osc"

Connection = require("./connection")

# Abstract client connection class
class Client extends Connection
  @defaultOptions = {}

  constructor: (options)->
    super(options)

    if @options.server
      @server = @options.server
      @initAsServerClient()
    else
      @initAsClient()

  # Initialize this client as a client belonging
  # to a server.
  initAsServerClient: ->
    throw new Error("Abstract method Client::initAsServerClient called")

  # Initialize as client connection
  initAsClient: ->
    throw new Error("Abstract method Client::initAsClient called")

  # Abstract method to send data to the client
  send: (buffer, offset, length, callback)->
    throw new Error("Abstract method Client::send called")

  sendOSC: (address, typeTag, args)->
    if address instanceof osc.Message or address instanceof osc.Bundle
      message = address
    else
      message = new osc.Message(address, typeTag, args)
    buffer = message.toBuffer()
    @send(buffer, 0, buffer.length)


  open: (callback)->
    throw new Error("Abstract method Client::open called")

module.exports = Client
