should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::crosses", ->
  hub   = null
  node  = null
  chain = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  it "should allow to specify the argument by name", ->
    node.set(null, [0, 0])

    node.args [
      { type: "float" },
      { type: "float", name: "foo" },
    ]

    called = 0
    chain
      .crosses("foo", 0.5, "up")
      .step (msg)->
        msg.arguments[1].should.be.equal 0.6
        called++

    node.emit("message", new osc.Message("/test", [1, 0.6]))
    called.should.be.equal 1

  describe "with direction up", ->

    it "should only pass message to next function in chain if the value crosses 0.5 upwards", ->
      called = 0
      chain
        .crosses(0, 0.5, "up")
        .step (msg)->
          msg.arguments[0].should.be.equal 0.6
          called++

      for i in [0..9]
        node.emit("message", new osc.Message("/test", [i/10]))
      for i in [9..0]
        node.emit("message", new osc.Message("/test", [i/10]))

      called.should.be.equal 1

  describe "with direction down", ->

    it "should only pass message to next function in chain if the value crosses 0.5 downwards", ->
      called = 0
      chain
        .crosses(0, 0.5, "down")
        .step (msg)->
          msg.arguments[0].should.be.equal 0.4
          called++

      for i in [0..9]
        node.emit("message", new osc.Message("/test", [i/10]))
      for i in [9..0]
        node.emit("message", new osc.Message("/test", [i/10]))

      called.should.be.equal 1

  describe "with direction any", ->

    it "should pass message to next function in chain if the value crosses 0.5 up- or downwards", ->
      called = 0
      chain
        .crosses(0, 0.5)
        .step (msg)->
          if called is 0
            msg.arguments[0].should.be.equal 0.6
          else
            msg.arguments[0].should.be.equal 0.4
          called++

      for i in [0..9]
        node.emit("message", new osc.Message("/test", [i/10]))
      for i in [9..0]
        node.emit("message", new osc.Message("/test", [i/10]))

      called.should.be.equal 2
