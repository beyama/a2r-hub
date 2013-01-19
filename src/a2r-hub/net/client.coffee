osc = require "a2r-osc"

Connection = require("./connection")

# Abstract client connection class
class Client extends Connection
  @defaultOptions = {}

  constructor: (options)->
    if options.server
      @server = options.server
      super(@server, options)
      @initAsServerClient()
    else
      super(null, options)
      @initAsClient()

  # Initialize this client as a client belonging
  # to a server.
  initAsServerClient: -> @server.emit("client", @)

  # Initialize as client connection
  initAsClient: ->

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
