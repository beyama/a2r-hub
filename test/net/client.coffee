should = require "should"
_      = require "underscore"
EventEmitter = require("events").EventEmitter

hub    = require "../../"

class MockClient extends hub.net.Client
  constructor: (options={})->
    options = _.extend(options, { ip: "127.0.0.1", port: 8000, type: "udp", protocol: "udp"})
    super(options)

  initAsServerClient: ->
    @_initAsServerClient = true
    super

  initAsClient: ->
    @_initAsClient = true
    super

class MockServer extends hub.net.Server
  constructor: (options)->
    options = _.extend(options, { ip: "127.0.0.1", port: 8000, type: "udp", protocol: "udp:"})
    super(options)
    @socket = new EventEmitter
    @initSocket(@socket)

  listen: -> @socket.emit("listening")

describe "hub.net.Client", ->

  context = null

  beforeEach (done)->
    context = hub.applicationContext()

    context.resolve "connectionService", (err)-> done(err)

  afterEach -> context.shutdown()

  describe "constructor", ->

    it "should call initAsClient if no server is given", ->
      client = new MockClient(context: context)
      client._initAsClient.should.be.true
      should.not.exist client._initAsServerClient

    it "should call initAsServer if a server is given", ->
      server = new MockServer(context: context)
      client = new MockClient(context: context, server: server)
      client._initAsServerClient.should.be.true
      client.server.should.be.equal server
      should.not.exist client._initAsClient
