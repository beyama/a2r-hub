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
    @on("dispose", => @socket.close() if @listening)

  initSocket: (socket)->
    super(socket)
    socket.on("message", @onSocketMessage.bind(@))

  listen: -> @socket.bind(@port, @ip)

  addChild: (child)->
    if child instanceof UdpServer
      @clientsByIPAndPort["#{child.ip}:#{child.port}"] = child
    super

  removeChild: (child)->
    if child instanceof UdpServer
      delete @clientsByIPAndPort["#{child.ip}:#{child.port}"]
    super

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
    catch e
      @logger.error("#{@constructor.name}: Couldn't create client connection for `#{rinfo.address}:#{rinfo.port}`")
      @logger.debug(e.stack)
      client.dispose() if client
      session.dispose()
      return

    client

  onSocketMessage: (data, rinfo)->
    client = @clientsByIPAndPort["#{rinfo.address}:#{rinfo.port}"]
    client = @createClient(rinfo) unless client
    client.emit("message", data)

module.exports = UdpServer
