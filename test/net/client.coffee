hub    = require "../../"
should = require "should"
_      = require "underscore"

Client = hub.net.Client

class MockClient extends Client
  constructor: (options={})->
    options = _.extend(options, { ip: "127.0.0.1", port: 8000, type: "udp", protocol: "udp"})
    super(options)

  initAsServerClient: -> @_initAsServerClient = true

  initAsClient: -> @_initAsClient = true

describe "hub.net.Client", ->

  context = null

  beforeEach -> context = hub.applicationContext()

  afterEach -> context.shutdown()

  describe "constructor", ->

    it "should call initAsClient if no server is given", ->
      client = new MockClient(context: context)
      client._initAsClient.should.be.true
      should.not.exist client._initAsServerClient

    it "should call initAsServer if a server is given", ->
      server = {}
      client = new MockClient(context: context, server: server)
      client._initAsServerClient.should.be.true
      client.server.should.be.equal server
      should.not.exist client._initAsClient
