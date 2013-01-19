Tree       = require "./tree"
BaseObject = require "./base_object"
address    = require "./address"

osc = require "a2r-osc"

class Node extends Tree.Node
  # extend the class with properties
  # of the object
  @extend: (object)->
    for k, v of object
      @[k] = v
    @

  # extend the class prototype with
  # properties of the object
  @mixin: (object)->
    for k, v of object
      @::[k] = v
    @

class Hub extends Tree
  @Node: Node

  # export osc
  @osc: osc

  constructor: ->
    super()
    @sessionById = {}
    @sessions    = []

  # Dispose the hub and close each session.
  dispose: ->
    # dispose each registered session, session.dispose manipulates the underlying
    # @sessions array so we iterate over a copy of @sessions.
    if @sessions
      session.dispose() for session in @sessions[..]
    super()

  # Get session by id
  getSession: (id)-> @sessionById[id]

  addChild: (child)->
    if child instanceof Session
      @sessions.push(child)
      @sessionById[child.id] = child
    super(child)

  removeChild: (child)->
    if child instanceof Session
      index = @sessions.indexOf(child)
      @sessions.splice(index, 1) if index > -1
      delete @sessionById[child.id]
    super(child)

  # Create session and register session in session registry
  createSession: (data)->
    session = new Session(@, data)
    @emit("session", session)
    session

  _sendBundle: (bundle)->
    date = new Date

    if bundle.timetag <= date
      for element in bundle.elements
        @send(element)
    else
      timeout = bundle.timetag - date
      setTimeout((=> @_sendBundle(bundle)), timeout)

  # Call send on all channels where channel.address matches message.address
  send: (message)->
    if message instanceof osc.Bundle
      @_sendBundle(message)
    else if message instanceof osc.Message
      if address.isValidPattern(message.address)
        nodes = @getNodesByPattern(message.address)
        if nodes
          for node in nodes
            node.emit("message", message)
            node
      else
        node = @getNodeByAddress(message.address)
        node.emit("message", message) if node
        node

class Session extends BaseObject
  constructor: (hub, data={})->
    @hub       = hub
    @id        = @hub.nextId()
    @createdAt = new Date
    @data      = data
    @nodes     = []
    super(hub)

  dispose: (removeFromParent)->
    @hub.emit("session:dispose", @)

    # dispose each registered node, node.dispose manipulates the underlying
    # @nodes array so we iterate over a copy of @nodes.
    node.dispose() for node in @nodes[..]

    super(removeFromParent)

  onDisposeNode: (node)=>
    index = @nodes.indexOf(node)
    @nodes.splice(index, 1) if index > -1

  # Create a session owned node
  createNode: (address, options)->
    # create node
    node = @hub.createNode(address, options)
    # set node owner to this
    node.owner = @
    # register node
    @nodes.push(node)
    # hanlde node dispose
    node.on("dispose", @onDisposeNode)
    
    @emit("node", node)

    node

Hub.Session = Session
module.exports = Hub
