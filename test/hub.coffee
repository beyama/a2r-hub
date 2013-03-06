should = require "should"
osc    = require "a2r-osc"
a2rHub = require "../"
Hub    = a2rHub.Hub

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

  describe ".Node", ->
    describe "constructor", ->
      it "should emit `created`", (done)->
        hub.nodeObserver.on "/a2r/node", "created", (node)->
          node.address.should.be.equal "/a2r/node"
          done()

        hub.createNode("/a2r/node")

    describe ".set", ->
      it "should set values to node and emit changed", (done)->
        session = hub.createSession()
        node = hub.createNode("/test")

        node.on "changed", (n, oldValues, newValues, ses)->
          n.should.be.equal node
          oldValues.should.be.empty
          newValues.should.have.length 1
          newValues[0].should.be.equal 82
          newValues.should.be.equal node.values
          ses.should.be.equal session
          done()

        node.set(session, [82])

  describe ".Session", ->
    session = null
  
    beforeEach -> session = hub.createSession()

    describe ".jsonRPC", ->
      it "should delegate to connection.jsonRPC", ->
        class Client
          jsonRPC: (args...)-> @args = args

        client = new Client
        session.addConnection(client)

        session.jsonRPC 1, 2, 3

        client.args.should.have.length 3
        client.args[2].should.be.equal 3

    describe ".sendOSC", ->
      it "should delegate to connection.sendOSC", ->
        class Client
          sendOSC: (args...)-> @args = args

        client = new Client
        session.addConnection(client)

        session.sendOSC 1, 2, 3

        client.args.should.have.length 3
        client.args[2].should.be.equal 3
  
    describe ".dispose", ->
  
      it "should emit 'session:dispose' on @hub", ->
        called = 0

        session.on "dispose", -> called++

        hub.on "session:dispose", (session)->
          session.should.be.instanceof Hub.Session
          called++
  
        session.dispose()
        called.should.be.equal 2
  
      it "should dispose each connection", ->
        context = a2rHub.applicationContext()

        options =
          ip: "127.0.0.1"
          port: 8000
          protocol: "udp:"
          type: "udp"
          session: session
          context: context

        connection = new a2rHub.net.Connection(null, options)
        session.connections.should.include(connection)

        session.dispose()

        session.connections.should.not.include(connection)
        connection.disposed.should.be.true

        context.shutdown()

      it "should dispose each node", ->
        node1 = session.createNode("/1")
        node2 = session.createNode("/2")
  
        session.dispose()
        node1.disposed.should.be.true
        node2.disposed.should.be.true

