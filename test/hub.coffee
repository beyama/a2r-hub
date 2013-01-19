should = require "should"
osc    = require "a2r-osc"
Hub    = require("../").Hub

describe "Hub", ->
  hub = null

  beforeEach -> hub = new Hub

  describe ".createNode", ->
    it "should create an instance of Hub.Node", ->
      hub.createNode("/a2r/hub").should.be.instanceof Hub.Node

  describe ".createSession", ->
    
    it "should create a new Hub.Session with hub as parent and emit `session`", ->
      arg1 = null

      hub.on "session", (s)-> arg1 = s

      session = hub.createSession()
      session.should.be.instanceof Hub.Session
      session.parent.should.be.equal hub
      session.should.be.equal arg1

  describe ".addChild", ->

    it "should register session if child is an instance of Hub.Session", ->
      session = hub.createSession()
      hub.sessions.indexOf(session).should.be.equal 0
      hub.sessionById[session.id].should.be.equal session

  describe ".removeChild", ->

    it "should unregister session if child is an instance of Hub.Session", ->
      session = hub.createSession()
      session.dispose()
      hub.sessions.indexOf(session).should.be.equal -1
      should.not.exist hub.sessionById[session.id]

  describe ".dispose", ->

    it "should close all sessions", ->
      for i in [0..9]
        hub.createSession()

      called = 0
      
      hub.on "session:dispose", -> called++

      hub.on "dispose", -> called++

      hub.dispose()
      called.should.be.equal 11

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
  
    describe ".dispose", ->
  
      it "should emit 'session:dispose' on @hub", ->
        called = 0

        session.on "dispose", -> called++

        hub.on "session:dispose", (session)->
          session.should.be.instanceof Hub.Session
          called++
  
        session.dispose()
        called.should.be.equal 2
  
      it "should dispose each node", ->
        node1 = session.createNode("/1")
        node2 = session.createNode("/2")
  
        session.dispose()
        node1.disposed.should.be.true
        node2.disposed.should.be.true
