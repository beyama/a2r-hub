EventEmitter = require("events").EventEmitter
Connection   = require "./connection"
Server       = require "./server"

assert = require "assert"
async  = require "async"
url    = require "url"
_      = require "underscore"

class ConnectionService
  constructor: ->
    @connections = {}
    @serverHandler = {}
    @clientHandler = {}

  setApplicationContext: (context)->
    @context = context
    @hub     = @context.get("hub")
    @logger  = @context.get("logger")

  # Register a client handler class for a protocol
  registerClientHandler: (protocol, handler)->
    assert.ok(protocol, "Argument protocol must be given")
    assert.ok(typeof handler is 'function', "Client handler must be a function")

    if @clientHandler[protocol]
      @logger.warn("Client handler for protocol `#{protocol}` is already registered")

    @clientHandler[protocol] = handler

  # Unregister a client handler class
  unregisterClientHandler: (protocol)->
    if @clientHandler[protocol]
      delete @clientHandler[protocol]
      return true
    # else
    false

  # Register a server handler class for a protocol
  registerServerHandler: (protocol, handler)->
    assert.ok(protocol, "Argument protocol must be given")
    assert.ok(typeof handler is 'function', "Server handler must be a function")

    if @serverHandler[protocol]
      @logger.warn("Server handler for protocol `#{protocol}` is already registered")
    @serverHandler[protocol] = handler

  # Unregister a server handler class
  unregisterServerHandler: (protocol)->
    if @serverHandler[protocol]
      delete @serverHandler[protocol]
      return true
    # else
    false

  createClient: (address, options, callback)->
    if typeof address is 'object'
      callback = options
      options  = address
      address  = null
      options  = _.extend({}, options, { context: @context })
    else
      if typeof options is 'function'
        callback = options
        options  = null

      options ||= {}
      options = _.extend(url.parse(address), options, { context: @context })

    options.ip ||= options.hostname

    assert.ok(options.protocol, "Option `protocol` must be given")

    unless (clientHandler = @clientHandler[options.protocol])
      throw new Error("No client handler for protocol `#{options.protocol}` found")

    client = new clientHandler(options)

    # open connection
    if callback
      client.open (err)->
        return callback(err) if err
        callback(null, client)

    client

  createServer: (address, options, callback)->
    if typeof address is 'object'
      callback = options
      options  = address
      address  = null
      options  = _.extend({}, options, { context: @context })
    else
      if typeof options is 'function'
        callback = options
        options  = null

      options ||= {}
      options = _.extend(url.parse(address), options, { context: @context })

    options.ip ||= options.hostname

    assert.ok(options.protocol, "Option `protocol` must be given")

    unless (serverHandler = @serverHandler[options.protocol])
      throw new Error("No server handler for protocol `#{options.protocol}` found")

    server = new serverHandler(options)

    # start the server
    if callback
      server.start (err)->
        return callback(err) if err
        callback(null, server)

    server

  # Register a connection object.
  registerConnection: (con)->
    assert.ok(con instanceof Connection, "Argument must be an instance of `Connection`")
    assert.ok(@connections[con.address] is undefined, "Connection `#{con.address}` already exist")

    # unregister connection on dispose
    con.on("dispose", => @unregisterConnection(con))
    # register connection
    @connections[con.address] = con

    @hub.emit("connection", con)
    type = if con instanceof Server then "server" else "client"
    @hub.emit(type, con)
    con

  # Unregister a connection object
  unregisterConnection: (con)->
    assert.ok(con instanceof Connection, "Argument must be an instance of `Connection`")

    if @connections[con.address]
      delete @connections[con.address]
      @hub.emit("connection:unregistered", con)
      type = if con instanceof Server then "server" else "client"
      @hub.emit("#{type}:unregistered", con)
      return true
    # else
    return false

  getConnection: (address)-> @connections[address]

  hasConnection: (address)-> !!@getConnection(address)

  # close all server and client connections
  dispose: (callback)->
    callback ||= ->
    servers = []

    for addr, connection of @connections when connection instanceof Server
      servers.push(connection)

    # stop each server
    async.forEach servers, ((s, fn)-> s.stop(fn)), (error)=>
      return callback(error) if error

      # dispose all remaining connections
      for addr, connection of @connections when not (connection instanceof Server)
        connection.dispose()
      callback()

module.exports = ConnectionService
