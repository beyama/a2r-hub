hub    = require "../../"
should = require "should"
_      = require "underscore"

Connection = hub.net.Connection

VALID_OPTIONS =
  ip: "127.0.0.1"
  port: 8000
  protocol: "udp:"
  type: "udp"

describe "hub.net.Connection", ->
  context = null
  connection = null
  options    = null
  session    = null

  beforeEach ->
    context = hub.applicationContext()
    session = context.get("hub").createSession()
    options = _.extend(context: context, session: session, VALID_OPTIONS)

  afterEach -> context.shutdown()

  describe "constructor", ->

    describe "with valid options", ->

      beforeEach ->
        connection = new Connection(options)

      it "should set ip", ->
        connection.ip.should.be.equal options.ip

      it "should set ipVersion", ->
        connection.ipVersion.should.be.equal 4

      it "should set port", ->
        connection.port.should.be.equal options.port

      it "should set type", ->
        connection.type.should.be.equal options.type

      it "should set protocol", ->
        connection.protocol.should.be.equal options.protocol

      it "should set context", ->
        connection.context.should.be.equal options.context

      it "should cast option `port` to number", ->
        options.port = "8000"
        connection = new Connection(options)
        connection.port.should.be.equal 8000

      it "should set property `hub` and `logger` from context", ->
        connection.hub.should.be.equal context.get("hub")
        connection.logger.should.be.equal context.get("logger")

      it "should set address", ->
        connection.address.should.be.equal "udp://127.0.0.1:8000"

      describe "with session", ->
        it "should set session if supplied", ->
          connection.session.should.be.equal session

        it "should register connection on session", ->
          session.connections.should.include connection

        it "should register `onSessionClose` event handler on session `close` event", (done)->
          session.listeners("close").should.include connection.onSessionClose

          session.on "close", ->
            connection.closed.should.be.true
            done()
          session.close()

    describe "with invalid options", ->
      it "should throw an error", ->
        for option in ["ip", "port", "type", "protocol", "context"]
          delete options[option]

          (-> new Connection(options)).should.throw()

      it "should throw an error if session isn't an instance of Hub.Session", ->
          options.session = {}
          (-> new Connection(options)).should.throw()

  describe "close", ->
    beforeEach -> connection = new Connection(options)

    it "should emit `close`", (done)->
      connection.on("close", done)
      connection.close()

    it "should remove all listeners", ->
      connection.on("foo", ->)
      connection.close()
      connection.listeners("foo").should.have.length 0

    it "should remove connection from session on connection close", ->
      connection.close()
      session.connections.should.not.include connection
