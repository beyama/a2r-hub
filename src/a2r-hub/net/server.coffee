_ = require "underscore"

Connection = require("./connection")

# Base class of all A2R Hub network server,
# extends a2rHub.net.Connection.
#
# Events:
# * client: Emitted on registering a new client connection with the client
#   as first argument.
#
# Properties:
# * connections: An instance of the a2rHub.net.ConnectionService.
# * clients: A list of registered clients.
# * closed: Is true if this server is closed.
class Server extends Connection
  constructor: (options)->
    super(options)

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
    return callback() if @closed

    if @listening
      fn = (err)=>
        @removeListener("close", fn)
        @removeListener("error", fn)
        callback(err)

      @on("close", fn)
      @on("error", fn)
      @close()
    else
      @close()
      callback()

  listen: ->
    throw new Error("Abstract method `Server::listen` called")

  # Register a client. This will emit "client" with client
  # as first argument.
  registerClient: (client)->
    # register client connection
    @connections.registerConnection(client)
    @clientByAddress[client.address] = client
    @clients.push(client)
    # unregister client on close
    client.once "close", => @unregisterClient(client)
    # emit "client"
    @emit "client", client

  # Unregister client.
  # This will be automatically called by client.close().
  unregisterClient: (client)->
    @connections.unregisterConnection(client)
    delete @clientByAddress[client.address]
    index = @clients.indexOf(client)
    @clients.splice(index, 1) if index > -1

  # Close the server connection.
  #
  # This will close all registered clients.
  #
  # Overwrite this to close your underlying server/socket.
  close: ->
    return if @closed
    
    super

    for client in @clients[..]
      client.close()

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
    @close()

  onSocketError: (error)->
    @emit("error", error)

module.exports = Server
