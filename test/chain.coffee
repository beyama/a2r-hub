should = require "should"


_hub = require("../")
Hub   = _hub.Hub
Chain = _hub.Chain

osc = Hub.osc

describe "a2rHub.Chain", ->
  hub   = null
  node  = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")

  describe "constructor", ->

    it "should register its handle method for parents `message` event if parent is a node", ->
      chain = new Chain(node)
      node.listeners("message").should.include(chain.handle)

    it "should add its handle method to parents steps list if parent is a chain", ->
      rootChain = new Chain(node)
      chain = new Chain(rootChain)
      rootChain._steps.should.include(chain.handle)

    it "should throw an error if parent isn't a Hub.Node or Hub.Chain", ->
      (-> new Chain).should.throw()
      (-> new Chain({})).should.throw()
      (-> new Chain(new _hub.BaseObject)).should.throw()

  describe ".chain", ->

    it "should return a new chain with `this` as parent", ->
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

  describe ".handle", ->
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

      chain.handle(message)
      called.should.be.equal 10

    describe "with callback", ->

      it "should call callback after processing the chain", (done)->
        called = false

        chain = node.chain()

        chain.step (msg, next)->
          called = true
          next(null, msg)

        chain.handle message, (message)->
          called.should.be.true
          done()

      it "should call callback after processing the chain even if a step doesn't call next", (done)->
        chain = node.chain()

        chain.step ->

        chain.handle message, (err, msg)->
          should.not.exist err
          msg.should.be.equal message
          done()

    it "should emit `error` with error object and chain on node if a step throws an error", (done)->
      error = new Error

      node.on "error", (e, c)->
        e.should.be.equal error
        c.should.be.equal chain
        done()

      chain = node.chain().step -> throw error

      chain.handle message

    it "should emit `error` with error object and chain on node if a step calls next with an error", (done)->
      error = new Error

      node.on "error", (e, c)->
        e.should.be.equal error
        c.should.be.equal chain
        done()

      chain = node.chain().step (msg, next)-> next(error)

      chain.handle message

    it "should emit `error` with an error object and chain on node if a step calls a closed next handler ", (done)->

      node.on "error", (e, c)->
        c.should.be.equal chain
        done()

      chain = node.chain().step (msg, next)->
        next(null, msg)
        next(null, msg)

      chain.handle message
