Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::scale", ->
  hub   = null
  node  = null
  chain = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  it "should scale a message argument", (done)->
    chain
      .scale(1, 0, 127, 0.0, 1.0)
      .step (message)->
        message.arguments[1].should.be.equal 1
        done()

    node.emit("message", new osc.Message("/test", [1, 127]))


  it "should get input minimum and maximum from node", ->
    node.arg(0, min: 0, max: 127)
    chain
      .scale(0, 0.0, 1.0)
      .step (message)->
        message.arguments[0].should.be.equal 1
        done()

  describe "with cap true", ->

    it "should stop processing if input value is out of range", (done)->
      chain
        .scale(0, 0, 127, 0.0, 1.0, true)
        .step(done) # should not be called

      node.emit("message", new osc.Message("/test", [128]))
      done()

  describe "with named index", ->

    it "should get input minimum and maximum from node", ->
      node.arg(0, name: "x", min: 0, max: 127)
      chain
        .scale("x", 0.0, 1.0)
        .step (message)->
          message.arguments[0].should.be.equal 1
          done()

