EventEmitter = require("events").EventEmitter
Tree         = require "./tree"
address      = require "./address"
osc          = require "a2r-osc"

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

  # Shutdown the hub and close each session.
  shutdown: ->
    @emit("shutdown")
    # close each registered session, session.close manipulates the underlying
    # @sessions array so we iterate over a copy of @sessions.
    if @sessions
      session.close() for session in @sessions[..]
    @dispose()
    @removeAllListeners()

  # Get session by id
  getSession: (id)->@sessionById[id]

  # Add a session to session registry
  registerSession: (session)->
    if @sessionById[session.id]
      throw new Error("Session with id `#{id}` already exist")
    @sessionById[session.id] = session
    @sessions.push(session)

  # Remove session from session registry
  unregisterSession: (session)->
    id = if session instanceof Session then session.id else session
    if (session = @sessionById[id])
      delete @sessionById[id]
      index = @sessions.indexOf(session)
      @sessions.splice(index, 1) if index > -1
      return true
    # else
    false

  # Create session and register session in session registry
  createSession: (data)->
    session = new Session(@, data)
    @registerSession(session)
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

class Session extends EventEmitter
  constructor: (hub, data={})->
    @hub       = hub
    @id        = @hub.nextId()
    @createdAt = new Date
    @data      = data
    @nodes     = []

  # Close the session
  close: ->
    # emit 'close' on `this`
    @emit("close")
    # emit 'session:close' on @hub
    @hub.emit("session:close", @)
    # dispose each registered node, node.dispose manipulates the underlying
    # @nodes array so we iterate over a copy of @nodes.
    node.dispose() for node in @nodes[..]
    # remove all listeners from `this`
    @removeAllListeners()

  onDisposeNode: (node)=>
    if node.owner is @
      if (index = @nodes.indexOf(node)) > -1
        @nodes.splice(index, 1)

  # Create a session owned node
  createNode: (address, data)->
    node = @hub.createNode(address)
    node.data = data if typeof data is 'object'
    node.owner = @
    @nodes.push(node)
    node.on("dispose", @onDisposeNode)
    @emit("node", node)
    node

Hub.Session = Session
module.exports = Hub
