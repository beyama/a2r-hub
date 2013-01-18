should = require "should"
osc    = require "a2r-osc"
Hub    = require("../").Hub

describe "Hub", ->
  hub = null

  beforeEach -> hub = new Hub

  describe ".createNode", ->
    it "should create an instance of Hub.Node", ->
      hub.createNode("/a2r/hub").should.be.instanceof Hub.Node

  describe ".registerSession", ->

    it "should register a session in session registry", ->
      session = new Hub.Session(hub)
      hub.registerSession(session)
      hub.sessionById[session.id].should.be.equal session
      hub.sessions.should.have.length 1
      hub.sessions.indexOf(session).should.be.equal 0

    it "should throw an error if session already exist", ->
      session = hub.createSession()
      (-> hub.registerSession(session) ).should.throw()

  describe ".unregisterSession", ->
    
    it "should remove a session from session registry", ->
      hub.createSession()
      session = hub.createSession()

      hub.unregisterSession(session).should.be.true
      hub.sessions.should.have.length 1
      hub.sessions.indexOf(session).should.be.equal -1

    it "should return false if session isn't registered", ->
      session = new Hub.Session(hub)
      hub.unregisterSession(session).should.be.false

  describe ".createSession", ->
    
    it "should initialize and register a session and emit 'session' with session as argument", ->
      arg1 = null

      hub.on "session", (s)->
        arg1 = s

      session = hub.createSession()
      session.should.be.instanceof Hub.Session
      session.hub.should.be.equal hub
      session.should.be.equal arg1

  describe ".shutdown", ->

    it "should emit 'shutdown' and close all sessions", ->
      session = hub.createSession()
      called = 0
      
      hub.on "session:close", (s)->
        session.should.be.equal s
        called++

      hub.on "shutdown", ->
        called++

      hub.shutdown()
      called.should.be.equal 2

    it "should remove all listeners", ->
      hub.on "error", ->
      hub.listeners("error").should.have.length 1
      hub.shutdown()
      hub.listeners("error").should.have.length 0

  describe ".send", ->
    session = null

    beforeEach ->
      session = hub.createSession()

      for i in [0..9]
        session.createNode("/foo/#{i}")

    it "should return undefined if no node is found", ->
      message = new osc.Message("/foo/bar", osc.Impulse)
      should.not.exist hub.send(message)

    it "should emit `message` on node and return node if node is found", (done)->
      message = new osc.Message("/foo/1", osc.Impulse)

      node = hub.getNodeByAddress(message.address)
      node.on "message", (msg)->
        msg.should.be.equal message
        done()

      hub.send(message).should.be.equal node

    it "should emit `message` on each node and return node list if address is a pattern", ->
      count = 0
      message = new osc.Message("/foo/[0-9]", osc.Impulse)

      fn = (msg)->
        msg.should.be.equal message
        count++

      node.on("message", fn) for node in hub.nodes

      hub.send(message).should.have.length 10
      count.should.be.equal 10

  describe ".Session", ->
    session = null
  
    beforeEach -> session = hub.createSession()
  
    describe ".close", ->
  
      it "should emit 'close' on `this` and 'channel:close' with session as first argument on @hub", ->
        called = 0

        session.on "close", -> called++
        hub.on "session:close", (session)->
          session.should.be.instanceof Hub.Session
          called++
  
        session.close()
        called.should.be.equal 2
  
      it "should dispose each node", ->
        node1 = session.createNode("/1")
        node2 = session.createNode("/2")
  
        session.close()
        node1.disposed.should.be.true
        node2.disposed.should.be.true
  
      it "should remove all listeners", ->
        session.on "error", ->
        session.close()
        session.listeners("error").should.have.length 0
