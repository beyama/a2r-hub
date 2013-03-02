should = require "should"

Hub = require("../../").Hub
osc = Hub.osc

describe "a2rHub.Chain::set", ->
  hub     = null
  session = null
  node    = null
  chain   = null

  beforeEach ->
    hub     = new Hub
    session = hub.createSession()
    node    = hub.createNode("/test")
    chain   = node.chain()

  it "should set message arguments as current values of the node", ->
    chain.set()

    message = new osc.Message("/test", 98)
    message.from = session

    hub.send(message)

    node.values.should.equal message.arguments

  it "should copy the arguments array if copy is set to true", ->
    chain.set(true)

    message = new osc.Message("/test", 98)
    message.from = session

    hub.send(message)

    node.values.should.not.equal message.arguments
    node.values.should.have.length 1
    node.values[0].should.be.equal 98
