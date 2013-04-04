should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::decreases", ->
  hub   = null
  node  = null
  chain = null

  send = (msg)-> node.emit("message", msg)

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  it "should only call next handler if value decreases", ->
    called = 0

    lastValue = 0

    chain.decreases().step (msg)->
      should.ok msg.arguments[0] < lastValue
      called++

    for i in [0..9]
      send new osc.Message("/test", i % 3)
      lastValue = i % 3

    called.should.be.equal 3

  it "should allow to specify an argument to watch", ->
    called = 0

    lastValue = 0

    chain.decreases(1).step (msg)->
      should.ok msg.arguments[1] < lastValue
      called++

    for i in [0..9]
      send new osc.Message("/test", [5, i % 3])
      lastValue = i % 3

    called.should.be.equal 3
