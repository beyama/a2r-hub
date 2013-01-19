_ = require "underscore"

Connection = require "./connection"
Client     = require "./client"

# Base class of all A2R Hub network server,
# extends a2rHub.net.Connection.
#
# Events:
# * close: emitted when the socket emits `close`
# * error: emitted when the socket emits `error`
# * listening: emitted when the socket emits `listening`
# * client: emitted when a new client is connected
#
# Properties:
# * connections: An instance of the a2rHub.net.ConnectionService.
# * clients: A list of registered clients.
class Server extends Connection
  constructor: (options)->
    super(null, options)

    @connections = @context.get("connectionService")

    @clients = []
    @clientByAddress = {}

  # This must be called with the server socket after the server is created.
  initSocket: (socket)->
    socket.on("error", @onSocketError.bind(@))
    socket.on("close", @onSocketClose.bind(@))
    socket.on("listening", @onSocketListening.bind(@))

  # Get server client by address.
  getClient: (address)-> @clientByAddress[address]

  # Start the server.
  start: (callback)->
    if @connections.hasConnection(@address)
      return callback(new Error("#{@constructor.name}: Connection `#{@address}` already exist"))

    fn = (err)=>
      @removeListener("listening", fn)
      @removeListener("error", fn)
      callback(err)

    @on("listening", fn)
    @on("error", fn)

    @listen()

  # Stop the server.
  stop: (callback)->
    callback ||= ->
    return callback() if @disposed

    if @listening
      fn = (err)=>
        @removeListener("close", fn)
        @removeListener("error", fn)
        callback(err)

      @on("close", fn)
      @on("error", fn)
      @dispose()
    else
      @dispose()
      callback()

  listen: ->
    throw new Error("Abstract method `Server::listen` called")

  addChild: (child)->
    # Register a client and emit `client` event.
    if child instanceof Client
      # register client connection
      @connections.registerConnection(child)
      @clients.push(child)
      @clientByAddress[child.address] = child
    super(child)

  removeChild: (child)->
    # Unregister client.
    if child instanceof Client
      @connections.unregisterConnection(child)
      delete @clientByAddress[child.address]
      index = @clients.indexOf(child)
      @clients.splice(index, 1) if index > -1
    super(child)

  # Callback to call if the server/socket is listening.
  onSocketListening: ->
    @listening = true
    @logger.info("#{@constructor.name}: Listening on '#{@ip}:#{@port}'")
    @connections.registerConnection(@)
    @emit("listening")

  # Callback to call if the server/socket is closed.
  onSocketClose: ->
    @listening = false
    @connections.unregisterConnection(@)
    @logger.info("#{@constructor.name}: Server closed on '#{@ip}:#{@port}'")
    @emit("close")
    @dispose()

  onSocketError: (error)->
    @emit("error", error)

module.exports = Server
