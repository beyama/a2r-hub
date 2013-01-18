should = require "should"

hub = require("../")

Hub = hub.Hub
NodeDescriptor = hub.NodeDescriptor

describe "a2rHub.NodeDescriptor", ->
  hub = null
  desc = null

  beforeEach ->
    hub = new Hub
    node = hub.createNode("/test")
    desc = new NodeDescriptor(node)

  describe ".description", ->

    it "should set and get description", ->
      desc.desc("Filter ADSR")
      desc.desc().should.be.equal "Filter ADSR"

  describe ".argument", ->

    it "should set an argument description", ->
      desc.arg(0, type: "i")
      desc.arg(0).type.should.be.equal "i"

    it "should get an argument by name", ->
      desc.arg(0, name: "x", type: "i")
      desc.arg("x").should.be.equal desc.arg(0)

    it "should throw an error if argument index is a negativ value", ->
      (-> desc.arg(-4, type: "i") ).should.throw()

    it "should throw an error if argument is already defined", ->
      desc.arg(0, type: "i")
      (-> desc.arg(0, type: "i") ).should.throw()

    it "should throw an error if argument name is already defined", ->
      desc.arg(0, name: "x", type: "i")
      (-> desc.arg(1, name: "x", type: "i") ).should.throw()

    it "should throw an error if option min isn't less than option max", ->
      (-> desc.arg(0, type: "i", min: 12, max: 1) ).should.throw()

    it "should set index on descriptor", ->
      desc.arg(0, type: "i")
      desc.arg(0).index.should.be.equal 0

    it "should copy options", ->
      options = { type: "i" }
      desc.arg(0, options)
      desc.arg(0).should.not.equal options
      should.not.exist options.index

  describe ".arguments", ->

    it "should call NodeDescriptor::argument with each argument descriptor", ->
      desc.args [
        { type: "i" },
        { type: "f" }
      ]
      desc.arg(0).type.should.be.equal "i"
      desc.arg(1).type.should.be.equal "f"

describe "Hub.Node mixin", ->
  hub = null

  beforeEach -> hub = new Hub

  it "should allow to describe the node", ->
    args = [
      { name: "attack", type: "i" }
      { name: "decay", type: "i" }
      { name: "sustain", type: "i" }
      { name: "release", type: "i" }
    ]

    node = hub.createNode "/test",
      desc: "Filter ADSR",
      args: args

    node._descriptor.should.be.an.instanceof NodeDescriptor

    node.desc().should.be.equal "Filter ADSR"

    for arg, i in args
      node.arg(i).name.should.be.equal args[i].name
