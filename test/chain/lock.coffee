should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::lock", ->
  hub      = null
  session1 = null
  session2 = null
  node     = null
  chain    = null

  beforeEach ->
    hub      = new Hub
    session1 = hub.createSession()
    session2 = hub.createSession()
    node     = hub.createNode("/test")
    chain    = node.chain()

  it "should emit `locked` once the chain is locked", ->
    chain.lock(10).set()

    called = 0

    node.on "locked", (n, s)->
      n.should.be.equal node
      s.should.be.equal session1
      called++

    message = new osc.Message("/test", 98)
    message.from = session1

    hub.send(message)

    called.should.be.equal 1
    node.values[0].should.be.equal 98

    message = new osc.Message("/test", 99)
    message.from = session1

    hub.send(message)

    called.should.be.equal 1
    node.values[0].should.be.equal 99

    message = new osc.Message("/test", 100)
    message.from = session2

    hub.send(message)

    called.should.be.equal 1
    node.values[0].should.be.equal 99

  it "should unlock the chain and emit unlocked", (done)->
    chain.lock(10).set()

    node.once "unlocked", ->
      message = new osc.Message("/test", 100)
      message.from = session2

      hub.send(message)
      node.values[0].should.be.equal 100
      done()

    message = new osc.Message("/test", 98)
    message.from = session1

    hub.send(message)

    node.values[0].should.be.equal 98
