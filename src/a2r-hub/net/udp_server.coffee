dgram = require "dgram"
_     = require "underscore"

Server    = require "./server"
UdpClient = require "./udp_client"

class UdpServer extends Server
  @clientClass    = UdpClient
  @defaultOptions = { type: "udp", protocol: "udp:" }

  constructor: (options)->
    super(options)

    @socket = dgram.createSocket(if @ipVersion is 4 then "udp4" else "udp6")
    @initSocket(@socket)

    @clientsByIPAndPort = {}

  initSocket: (socket)->
    super(socket)
    socket.on("message", @onSocketMessage.bind(@))

  listen: -> @socket.bind(@port, @ip)

  close: ->
    return if @closed
    
    super
    @socket.close() if @listening

  createClient: (rinfo)->
    clientClass = @constructor.clientClass

    # create client session
    session = @hub.createSession()
    # create new client
    options =
      ip: rinfo.address
      port: rinfo.port
      server: @
      context: @context
      session: session

    try
      client = new clientClass(options)
      @logger.info("#{@constructor.name}: New connection from `#{client.address}`")
      @registerClient(client)
    catch e
      @logger.error("#{@constructor.name}: Couldn't create client connection for `#{rinfo.address}:#{rinfo.port}`")
      @logger.error(e.stack)
      client.close() if client
      session.close()
      return

    client

  onSocketMessage: (data, rinfo)->
    key = "#{rinfo.address}:#{rinfo.port}"
    client = @clientsByIPAndPort[key]

    unless client
      client = @createClient(rinfo)
      @clientsByIPAndPort[key] = client
      client.on("close", => delete @clientsByIPAndPort[key])

    client.emit("message", data)

module.exports = UdpServer
