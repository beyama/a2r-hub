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

    @on("dispose", => @socket.close() if @listening)

  listen: -> @socket.listen(@port, @ip)

  createServer: -> net.createServer(@onSocketConnection.bind(@))

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
    catch e
      @logger.error("#{@constructor.name}: Couldn't create client connection for `#{socket.remoteAddress}:#{socket.remotePort}`")
      @logger.debug(e.stack)
      client.dispose() if client
      session.dispose()
      return

    client

  onSocketConnection: (socket)-> @createClient(socket)

module.exports = TcpServer
