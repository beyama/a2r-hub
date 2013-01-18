EventEmitter = require("events").EventEmitter

a2rHub = require "../../"
should = require "should"
_      = require "underscore"

Client = a2rHub.net.Client
Server = a2rHub.net.Server
ConnectionService = a2rHub.net.ConnectionService

class ClientMock extends Client
  constructor: (options)->
    options.type = "udp"
    super

  initAsClient: ->

  open: (callback)-> callback()

class ServerMock extends Server
  constructor: (options)->
    options.type = "udp"
    @socket = new EventEmitter
    @initSocket(@socket)
    super

  listen: -> @socket.emit("listening")

  close: ->
    if @listening
      @socket.emit("close")
    super

describe "a2rHub.net.ConnectionService", ->
  service = null
  context = null
  hub     = null

  beforeEach (done)->
    context = a2rHub.applicationContext()

    hub = context.get("hub")
    
    context.resolve "connectionService", (error, connections)->
      return done(error) if error
      service = connections
      done()

  afterEach -> context.shutdown()

  describe "registerClientHandler", ->

    it "should register a client handler for a protocol", ->
      service.registerClientHandler("mock:", ClientMock)
      service.clientHandler["mock:"].should.be.equal ClientMock

    it "should throw an error if no protocol is specified", ->
      (-> service.registerClientHandler(null, ClientMock)).should.throw()

  describe "unregisterClientHandler", ->

    it "should unregister a client handler for a protocol", ->
      service.registerClientHandler("mock:", ClientMock)
      service.unregisterClientHandler("mock:").should.be.true
      should.not.exist service.clientHandler["mock:"]

  describe "registerServerHandler", ->

    it "should register a server handler for a protocol", ->
      service.registerServerHandler("mock:", ServerMock)
      service.serverHandler["mock:"].should.be.equal ServerMock

    it "should throw an error if no protocol is specified", ->
      (-> service.registerServerHandler(null, ServerMock)).should.throw()

  describe "unregisterServerHandler", ->

    it "should unregister a server handler for a protocol", ->
      service.registerServerHandler("mock:", ServerMock)
      service.unregisterServerHandler("mock:").should.be.true
      should.not.exist service.serverHandler["mock:"]

  describe "createClient", ->

    beforeEach ->
      service.registerClientHandler("mock:", ClientMock)

    it "should create client by address", ->
      client = service.createClient("mock://127.0.0.1:8000")
      client.should.be.instanceof ClientMock
      client.ip.should.be.equal "127.0.0.1"
      client.port.should.be.equal 8000

    it "should create client by options", ->
      client = service.createClient(protocol: "mock:", ip: "127.0.0.1", port: 8000)
      client.should.be.instanceof ClientMock
      client.ip.should.be.equal "127.0.0.1"
      client.port.should.be.equal 8000

    it "should create client and call client.open if callback is specified", (done)->
      service.createClient "mock://127.0.0.1:8000", (err, client)->
        return done(err) if err

        client.should.be.instanceof ClientMock
        done()

  describe "createServer", ->

    beforeEach ->
      service.registerServerHandler("mock:", ServerMock)

    it "should create server by address", ->
      server = service.createServer("mock://127.0.0.1:8000")
      server.should.be.instanceof ServerMock
      server.ip.should.be.equal "127.0.0.1"
      server.port.should.be.equal 8000

    it "should create server by options", ->
      server = service.createServer(protocol: "mock:", ip: "127.0.0.1", port: 8000)
      server.should.be.instanceof ServerMock
      server.ip.should.be.equal "127.0.0.1"
      server.port.should.be.equal 8000

    it "should create server and call server.start if callback is specified", (done)->
      service.createServer "mock://127.0.0.1:8000", (err, server)->
        return done(err) if err

        server.should.be.instanceof ServerMock
        done()

  describe ".dispose", ->
    beforeEach ->
      service.registerServerHandler("mock:", ServerMock)
      service.registerClientHandler("mock:", ClientMock)

    it "should stop each server", (done)->
      service.createServer "mock://127.0.0.1:8000", (err, server)->
        return done(err) if err

        server.on("close", done)
        service.dispose(->)

    it "should stop each client", (done)->
      service.createClient "mock://127.0.0.1:8000", (err, client)->
        return done(err) if err

        service.registerConnection(client)

        client.on("close", done)
        service.dispose(->)

  describe "registry methods", ->
    connection = null

    beforeEach ->
      service.registerClientHandler("mock:", ClientMock)
      connection = service.createClient("mock://127.0.0.1:8000")

    describe "registerConnection", ->

      it "should register connection", ->
        service.registerConnection(connection)
        service.getConnection(connection.address).should.be.equal connection

      it "should emit `connection` on hub", (done)->
        hub.on "connection", (con)->
          con.should.be.equal connection
          done()

        service.registerConnection(connection)

      it "should throw an error if connection isn't an instance of hub.net.Connection", ->
        (-> service.registerConnection({}) ).should.throw()

      it "should throw an error if connection with same address already exist", ->
        service.registerConnection(connection)
        (-> service.registerConnection(connection) ).should.throw()

      it "should unregister connection on connection `close` event", ->
        service.registerConnection(connection)
        connection.close()
        should.not.exist service.getConnection(connection.address)

    describe "unregisterConnection", ->

      beforeEach ->
        service.registerConnection(connection)

      it "should register connection", ->
        service.unregisterConnection(connection).should.be.true
        should.not.exist service.getConnection(connection.address)

      it "should emit `connection:unregistered` on hub", (done)->
        hub.on "connection:unregistered", (con)->
          con.should.be.equal connection
          done()

        service.unregisterConnection(connection)

      it "should throw an error if connection isn't an instance of hub.net.Connection", ->
        (-> service.unregisterConnection({}) ).should.throw()

    describe "hasConnection", ->

      it "should return true if connection with address exists", ->
        service.registerConnection(connection)
        service.hasConnection(connection.address).should.be.true

      it "should return false if connection with address doesn't exist", ->
        service.hasConnection(connection.address).should.be.false

    describe "getConnection", ->

      it "should return connection for address", ->
        service.registerConnection(connection)
        service.getConnection(connection.address).should.be.equal connection
