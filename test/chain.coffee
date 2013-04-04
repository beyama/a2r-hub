should = require "should"


a2rHub = require("../")
Hub   = a2rHub.Hub
Chain = a2rHub.Chain

osc = Hub.osc

describe "a2rHub.Chain", ->
  hub   = null
  node  = null

  send = (msg)-> node.emit("message", msg)

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")

  describe "constructor", ->

    it "should add itself to parents chain list", ->
      chain = new Chain(node)
      node.chains.should.have.length 1
      node.chains.should.include chain

      childChain = new Chain(chain)
      chain.chains.should.have.length 1
      chain.chains.should.include childChain

    it "should register an event handler for parents `message` event if parent is a node", ->
      chain = new Chain(node)
      should.exist chain.callback
      node.listeners("message").should.include chain.callback

    it "should add callback method to parents steps list if parent is a chain", ->
      rootChain = new Chain(node)
      chain = new Chain(rootChain)
      should.exist chain.callback
      rootChain._steps.should.include chain.callback

    it "should throw an error if parent isn't a Hub.Node or Hub.Chain", ->
      (-> new Chain).should.throw()
      (-> new Chain({})).should.throw()
      (-> new Chain(new a2rHub.BaseObject)).should.throw()

  describe "message callback on parent node", ->

    it "should emit `error` with error object and chain on node if a step throws an error", (done)->
      error = new Error

      chain = node.chain().step -> throw error

      node.on "error", (e, c)->
        e.should.be.equal error
        c.should.be.equal chain
        done()

      send new osc.Message("/test", osc.Impulse)

  describe "step callback on parent chain", ->

    it "should call next without waiting for finished steps", (done)->
      called = false

      chain = node.chain()

      chain.chain().step (msg, next)->
        process.nextTick ->
          called = true
          next(msg)

      chain.step (msg, next)->
        called.should.be.false
        done()

      send new osc.Message("/test", osc.Impulse)

    it "should clone the message before processing", (done)->
      chain = node.chain()
      called = false

      chain.chain().step (msg, next)->
        called = true
        msg.arguments[0] = 2
        next(null, msg)

      chain.step (msg, next)->
        called.should.be.true
        msg.arguments[0].should.be.equal 1
        done()

      send new osc.Message("/test", 1)

  describe ".dispose", ->
    chain = null

    beforeEach -> chain = new Chain(node)

    it "should remove event handler from parent node", ->
      chain.dispose()
      node.listeners("message").should.not.include chain.callback

    it "should remove step from parent chain", ->
      child = new Chain(chain)
      child.dispose()
      chain._steps.should.not.include child.callback

    it "should remove itself from parents chain-list", ->
      chain.dispose()
      node.chains.should.not.include(chain)

  describe ".chain", ->

    it "should return a new chain with root chain as parent", ->
      rootChain = new Chain(node)
      chain = rootChain.chain()
      chain.parent.should.be.equal rootChain

  describe ".end", ->

    it "should return parent chain", ->
      rootChain = new Chain(node)
      chain = rootChain.chain()
      chain.end().should.be.equal(rootChain)
      chain.chain().end().should.be.equal chain

  describe ".step", ->

    it "should add a function to the steps list and return itself", ->
      chain = new Chain(node)

      fn = ->

      chain.step(fn).should.be.equal chain
      chain._steps.should.include fn

    it "should throw an error if argument isn't a function", ->
      (-> new Chain(node).step({})).should.throw()

  describe ".runSteps", ->
    message = null

    beforeEach ->
      message = new osc.Message("/test", osc.Impulse)

    it "should call each step in series", ->
      called = 0

      chain = node.chain()

      for i in [0..9]
        do (i)->
          chain.step (msg, next)->
            called.should.be.equal i
            called++
            next(null, msg)

      chain.runSteps(message)
      called.should.be.equal 10

    describe "with callback", ->

      it "should call callback after processing the chain", (done)->
        called = false

        chain = node.chain()

        chain.step (msg, next)->
          process.nextTick ->
            called = true
            next(null, msg)

        chain.runSteps message, (err, msg)->
          should.not.exist err
          msg.should.be.equal message
          called.should.be.true
          done()

      it "should call callback with an error object if a step calls next with an error", (done)->
        error = new Error

        chain = node.chain().step (msg, next)-> next(error)

        chain.runSteps message, (e)->
          e.should.be.equal error
          done()
