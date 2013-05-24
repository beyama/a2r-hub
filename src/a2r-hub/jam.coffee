BaseObject = require "./base_object"
address    = require "./address"
Hub        = require "./hub"
Layout     = require "./layout"
osc        = Hub.osc

class Jam extends BaseObject
  constructor: (session, name, title, description)->
    if not address.isValidToken(name)
      throw new Error("Invalid Jam name `#{name}`")

    super(session)

    @owner       = session
    @createdAt   = new Date
    @hub         = @owner.hub
    @name        = name
    @title       = title
    @description = description
    @context     = @hub.context
    @logger      = @context.get("logger")
    @root        = @owner.createNode("/#{@name}")
    @nodes       = {}
    @layouts     = []

    @participants = []

  join: (session)->
    unless session instanceof Hub.Session
      throw new Error("session must be an instance of Hub.Session")

    if (added = (@participants.indexOf(session) is -1))
      @participants.push(session)

    bundle = new osc.Bundle

    for a, n of @nodes when n.values?
      bundle.add(a, n.values)

    if bundle.elements.length
      session.sendOSC(bundle)

    added

  leave: (session)->
    unless session instanceof Hub.Session
      throw new Error("session must be an instance of Hub.Session")

    index = @participants.indexOf(session)
    @participants.splice(index, 1) if index > -1

  onNodeValuesChanged: (node, oldValues, newValues, session)=>
    # FIXME: The signature of this message will not use integer
    # for numbers, even if the descriptor of this node says integers.
    message = new osc.Message(node.address, newValues)

    for s in @participants when s isnt session
      s.sendOSC(message)

  createNode: (session, address, options)->
    if typeof session is "string"
      options = address
      address = session
      session = @owner

    address = "/#{@name}#{address}"
    @logger.info("Jam `#{@name}` create node `#{address}`")

    node = session.createNode(address, options)
    node.on("changed", @onNodeValuesChanged)
    node.on("dispose", @onNodeDispose)

    @nodes[address] = node
    node

  onNodeDispose: (node)=> delete @nodes[node.address]

  getNode: (address)-> @nodes["/#{@name}#{address}"]

  createLayout: (options)->
    layout = new Layout(options)
    @layouts.push(layout)
    layout

  dispose: ->
    @root.dispose()
    super

module.exports = Jam
