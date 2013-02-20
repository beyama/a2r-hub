should = require "should"
_      = require "underscore"
EventEmitter = require("events").EventEmitter

hub = require "../../"
osc = hub.Hub.osc

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

  describe ".sendOSC", ->

    it "should pass OSC buffer to send if called with OSC message", ->
      c = undefined

      client = new MockClient(context: context)
      client.send = (buffer, offset, length, callback)->
        msg = osc.fromBuffer(buffer)
        msg.address.should.be.equal "/a2r"
        offset.should.be.equal 0
        length.should.be.equal buffer.length
        should.ok callback is c

      msg = new osc.Message("/a2r", 1)
      # without callback
      client.sendOSC(msg)

      # with callback
      c = ->
      client.sendOSC(msg, c)

    it "should pass OSC buffer to send if called with OSC bundle", ->
      c = undefined

      client = new MockClient(context: context)
      client.send = (buffer, offset, length, callback)->
        bundle = osc.fromBuffer(buffer)
        bundle.elements.should.have.length 1
        offset.should.be.equal 0
        length.should.be.equal buffer.length
        should.ok callback is c

      bundle = new osc.Bundle().add("/a2r", 1)
      # without callback
      client.sendOSC(bundle)

      # with callback
      c = ->
      client.sendOSC(bundle, c)

    it "should create an OSC message if called with an address and OSC arguments", ->
      c = undefined

      client = new MockClient(context: context)
      client.send = (buffer, offset, length, callback)->
        msg = osc.fromBuffer(buffer)
        msg.address.should.be.equal "/a2r"
        msg.arguments[0].should.be.equal 1
        offset.should.be.equal 0
        length.should.be.equal buffer.length
        should.ok callback is c

      # without callback
      client.sendOSC("/a2r", 1)

      # with callback
      c = ->
      client.sendOSC("/a2r", 1, c)
