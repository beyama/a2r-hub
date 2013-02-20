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
  initAsServerClient: -> @server._clientInitialized(@)

  # Initialize as client connection
  initAsClient: ->

  # Abstract method to send data to the client
  send: (buffer, offset, length, callback)->
    throw new Error("Abstract method Client::send called")

  sendOSC: (address, typeTag, args, callback)->
    if address instanceof osc.Message or address instanceof osc.Bundle
      message = address
      callback = typeTag
    else
      if typeof args is "function"
        callback = args
        args = undefined
      message = new osc.Message(address, typeTag, args)
    buffer = message.toBuffer()
    @send(buffer, 0, buffer.length, callback)

  open: (callback)->
    throw new Error("Abstract method Client::open called")

module.exports = Client
