net = require "net"
_   = require "underscore"

Server    = require "./server"
TcpClient = require "./tcp_client"

class TcpServer extends Server
  @clientClass    = TcpClient
  @defaultOptions = { type: "tcp", protocol: "tcp:" }

  constructor: (options)->
    super(options)

    @socket = @createServer()
    @initSocket(@socket)

  listen: -> @socket.listen(@port, @ip)

  createServer: -> net.createServer(@onSocketConnection.bind(@))

  close: ->
    return if @closed
    
    super
    @socket.close() if @listening

  createClient: (socket)->
    clientClass = @constructor.clientClass

    # create client session
    session = @hub.createSession()
    # create new client
    options =
      ip: socket.remoteAddress
      port: socket.remotePort
      server: @
      socket: socket
      context: @context
      session: session

    try
      client = new clientClass(options)
      @logger.info("#{@constructor.name}: New connection from `#{client.address}`")
      @registerClient(client)
    catch e
      @logger.error("#{@constructor.name}: Couldn't create client connection for `#{socket.remoteAddress}:#{socket.remotePort}`")
      @logger.error(e.stack)
      client.close() if client
      session.dispose()
      return

    client

  onSocketConnection: (socket)-> @createClient(socket)

module.exports = TcpServer
