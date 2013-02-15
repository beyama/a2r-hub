should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::fromPositiveToZero", ->
  hub   = null
  node  = null
  chain = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  it "should only call next handler if value goes from positve to zero", ->
    called = 0

    lastValue = 0

    chain.fromPositiveToZero().step (msg)->
      should.ok lastValue > 0
      msg.arguments[0].should.be.equal 0
      called++

    for i in [0..9]
      chain.handle new osc.Message("/test", i % 3)
      lastValue = i % 3

    called.should.be.equal 3

  it "should allow to specify an argument to watch", ->
    called = 0

    lastValue = 0

    chain.fromPositiveToZero(1).step (msg)->
      should.ok lastValue > 0
      msg.arguments[1].should.be.equal 0
      called++

    for i in [0..9]
      chain.handle new osc.Message("/test", [12, i % 3])
      lastValue = i % 3

    called.should.be.equal 3
