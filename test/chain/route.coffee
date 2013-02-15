should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::route", ->
  hub   = null
  node  = null
  chain = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    chain = node.chain()

  argumentsExpected = (values, done)->
    hub.createNode("/destination").on "message", (msg)->
      msg.address.should.be.equal "/destination"

      msg.arguments.should.have.length values.length

      for v, i in values
        msg.arguments[i].should.be.equal v
      done()

  it "should resolve source argument by index", (done)->
    node.args [{ type: "i" }, { type: "f" }]
    
    argumentsExpected([5], done)
    
    chain.route(address: "/destination", args: { index: 1 })

    node.emit("message", new osc.Message("/test", [1, 5]))

  it "should resolve source argument by name", (done)->
    node.arg 0, name: "x", type: "i"

    argumentsExpected([5], done)

    chain.route(address: "/destination", args: { index: "x" })

    node.emit("message", new osc.Message("/test", [5]))

  it "should scale values if min and max are provided", (done)->
    node.arg 0, min: 0, max: 127

    argumentsExpected([1], done)

    chain.route(address: "/destination", args: { index: 0, min: 0, max: 1 })

    node.emit("message", new osc.Message("/test", [127]))

  it "should resolve variable", (done)->
    vars = { foo: "bar" }

    node.vars = vars

    argumentsExpected([vars.foo], done)

    chain.route(address: "/destination", args: { var: "foo" })

    node.emit("message", new osc.Message("/test", osc.Impulse))

  it "should resolve and scale variable", (done)->
    vars = { foo: 0.5 }

    node.vars = vars

    argumentsExpected([6], done)

    chain.route(address: "/destination", args: { var: "foo", varMin: 0, varMax: 1, min: 0, max: 12 })

    node.emit("message", new osc.Message("/test", osc.Impulse))

  it "should set string and number constants", (done)->
    node.arg 0, type: "i"

    argumentsExpected(["foo", 12.5, 5], done)

    chain.route(address: "/destination", args: ["foo", 12.5, { index: 0 }])

    node.emit("message", new osc.Message("/test", [5]))
