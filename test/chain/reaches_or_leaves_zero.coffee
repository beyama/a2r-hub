should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::reachesOrLeavesZero", ->
  hub   = null
  node  = null
  chain = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  it "should only call next handler if value reaches or leaves zero", ->
    called = 0

    lastValue = 0

    chain.reachesOrLeavesZero().step (msg)->
      currentValue = msg.arguments[0]
      should.ok (lastValue is 0 and currentValue isnt 0) or (lastValue isnt 0 and currentValue is 0)
      called++

    for i in [-9..9]
      chain.handle new osc.Message("/test", i % 3)
      lastValue = i % 3

    called.should.be.equal 12

  it "should allow to specify an argument to watch", ->
    called = 0

    lastValue = 0

    chain.reachesOrLeavesZero(1).step (msg)->
      currentValue = msg.arguments[1]
      should.ok (lastValue is 0 and currentValue isnt 0) or (lastValue isnt 0 and currentValue is 0)
      called++

    for i in [-9..9]
      chain.handle new osc.Message("/test", [43, i % 3])
      lastValue = i % 3

    called.should.be.equal 12
