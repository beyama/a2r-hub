EventEmitter = require("events").EventEmitter
hub    = require "../../"
should = require "should"
_      = require "underscore"

Server = hub.net.Server
Client = hub.net.Client

class MockClient extends Client
  constructor: (options={})->
    options = _.extend({ ip: "127.0.0.1", port: 8001, type: "udp", protocol: "udp"}, options)
    super(options)

class MockServer extends Server
  constructor: (options)->
    options = _.extend(options, { ip: "127.0.0.1", port: 8000, type: "udp", protocol: "udp:"})
    super(options)
    @socket = new EventEmitter
    @initSocket(@socket)

  listen: -> @socket.emit("listening")

describe "hub.net.Server", ->
  context = null
  server  = null
  client  = null
  connections = null

  beforeEach (done)->
    context = hub.applicationContext()

    context.resolve "connectionService", (err, service)->
      return done(err) if err
      server = new MockServer(context: context)
      client = new MockClient(context: context, server: server)
      connections = service
      done()

  afterEach -> context.shutdown()

  describe "constructor", ->

    it "should set property `connections` to `connectionService` from context", ->
      server = new MockServer(context: context)
      server.connections.should.be.equal context.get("connectionService")

  describe "initSocket", ->

    socket = null

    beforeEach ->

    it "should connect socket `error` event with `Server::onSocketError`", (done)->
      error = new Error("Boom")
      server.on "error", (e)->
        e.should.be.equal error
        done()

      server.socket.emit("error", error)

    it "should connect socket `listening` event with `Server::onSocketListening`", (done)->
      server.on "listening", ->
        server.listening.should.be.true
        server.connections.getConnection(server.address).should.be.equal server
        done()

      server.start ->

    it "should connect socket `close` event with `Server::onSocketClose`", (done)->
      server.on "dispose", ->
        server.listening.should.be.false
        should.not.exist server.connections.getConnection(server.address)
        done()

      server.start ->
        server.socket.emit("close")

  describe "addChild", ->

    it "should register a client", (done)->
      server.on "client", (c)->
        c.should.be.an.instanceof MockClient
        server.clients.should.have.length 2
        done()

      new MockClient(port: 8002, context: context, server: server)

  describe "removeChild", ->

    it "should unregister a client", ->
      server.clients.should.include client
      client.dispose()
      server.clients.should.not.include client
      should.not.exist server.getClient(client.address)
      should.not.exist connections.getConnection(client.address)

  describe "start", ->

    beforeEach ->
      server.listen = ->

    it "should call the callback if the server starts listening", (done)->
      server.start(done)
      server.socket.emit("listening")

    it "should call the callback with an error if the server emits `error` during start", (done)->
      error = new Error("Boom")

      server.start (e)->
        e.should.be.equal error
        done()

      server.socket.emit("error", error)

  describe "stop", ->

    it "should call the callback immediately if the server isn't listening", (done)->
      should.not.exist server.listening
      server.stop(done)

    it "should call the callback if the socket emits `close`", (done)->
      server.stop(done)
      server.socket.emit("close")

    it "should call the callback with an error if the socket emits `error` during stop", (done)->
      error = new Error("Boom")
      server.dispose = -> @socket.emit("error", error)

      server.start (e)->
        return done(e) if e

        server.stop (e)->
          e.should.be.equal error
          done()
