should = require "should"
osc    = require "a2r-osc"
Hub    = require("../").Hub

describe "Hub.NodeObserver", ->
  hub = null

  beforeEach -> hub = new Hub

  describe ".on", ->
    it "should register a listener for a specified node", (done)->
      node = hub.createNode("/a2r/hub")

      hub.nodeObserver.on "/a2r/hub", "message", (message)->
        message.should.be.equal "test"
        done()

      node.emit("message", "test")

  describe ".removeListener", ->
    it "should remove a listener for a specified node", ->
      fn = ->

      addr = "/a2r/hub"
      hub.nodeObserver.on addr, "message", fn
      hub.nodeObserver.listeners(addr, "message").should.include fn
      hub.nodeObserver.removeListener(addr, "message", fn)
      hub.nodeObserver.listeners(addr, "message").should.not.include fn

  describe ".removeAllListeners", ->
    it "should remove all listeners for a specified node", ->
      fn = ->

      addr = "/a2r/hub"
      hub.nodeObserver.on addr, "message", fn
      hub.nodeObserver.removeAllListeners(addr)
      hub.nodeObserver.listeners(addr, "message").should.not.include fn

    it "should remove all listeners for a specified node and event", ->
      fn = ->

      addr = "/a2r/hub"
      hub.nodeObserver.on addr, "message", fn
      hub.nodeObserver.on addr, "changed", fn
      hub.nodeObserver.removeAllListeners(addr, "message")
      hub.nodeObserver.listeners(addr, "message").should.not.include fn
      hub.nodeObserver.listeners(addr, "changed").should.include fn
