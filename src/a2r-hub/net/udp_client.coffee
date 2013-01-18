assert = require "assert"
dgram  = require "dgram"
_      = require "underscore"

Client = require "./client"

class UdpClient extends Client
  @defaultOptions = { type: "udp", protocol: "udp:" }

  constructor: (options)->
    super(options)

  initAsServerClient: ->
    @socket = @server.socket

  initAsClient: ->
    @socket = dgram.createSocket(if @ipVersion is 4 then "udp4" else "udp6")

  open: (callback)-> callback()

  send: (buffer, offset, length, callback)->
    if @outport
      @socket.send(buffer, offset, length, @outport, @ip, callback)
    else
      @socket.send(buffer, offset, length, @port, @ip, callback)

  setOutport: (port)->
    port = Number(port)
    assert.ok(port isnt NaN, "Port must be a number")
    @outport = port

  close: ->
    @socket.close() unless @server
    super

module.exports = UdpClient
