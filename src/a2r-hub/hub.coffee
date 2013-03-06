Tree         = require "./tree"
BaseObject   = require "./base_object"
address      = require "./address"
EventEmitter = require("events").EventEmitter

osc = require "a2r-osc"

# This class allows us to register listeners for events on nodes which are not created yet.
# It behaves like a node EventEmitter with the difference that all methods require an OSC address
# as first argument.
#
# e.g.:
# hub.nodeObserver.on "/a2r/node", "changed", (event)-> ...
# hub.nodeObserver.removeListener "/a2r/node", "changed", listener
class NodeObserver
  constructor: ->
    @addresses = {}

  _checkArgs: (addr, event, listener)->
    if not address.isValidAddress(addr) or typeof event isnt "string" or typeof listener isnt "function"
      throw new TypeError("Method `on` must be called with an valid OSC address string, `event` string and `listener` function")

  # Adds a listener to the end of the listeners array for the specified event on the specified node.
  on: (address, event, listener)->
    @_checkArgs(address, event, listener)
    emitter = @addresses[address] ||= new EventEmitter
    emitter.on(event, listener)

  # Adds a one time listener for the event on the specified node.
  once: (address, event, listener)->
    @_checkArgs(address, event, listener)
    emitter = @addresses[address] ||= new EventEmitter
    emitter.once("event", listener)

  # Remove a listener from the listener array for the specified event on the specified node.
  removeListener: (address, event, listener)->
    if (emitter = @addresses[address])
      emitter.removeListener(event, listener)

  # Removes all listeners from a sepecified node, or those of the specified event. 
  removeAllListeners: (address, event)->
    if (emitter = @addresses[address])
      if event
        emitter.removeAllListeners(event)
      else
        emitter.removeAllListeners()

  # Returns an array of listeners for the specified event on the specified node. 
  #
  # Returns undefined if no event is registered for the specified node.
  listeners: (address, event)->
    if (emitter = @addresses[address])
      emitter.listeners(event)

  # Execute each of the listeners in order with the supplied arguments. 
  emit: (address, args)->
    if (emitter = @addresses[address])
      emitter.emit.apply(emitter, args)

class Node extends Tree.Node
  constructor: ->
    super

    # We emit `created` at this point to call all node observer listeners which
    # are registerd for this.address and the `created` event.
    @emit("created", @)

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

  # Set values to current values of this node.
  #
  # This will emit `changed` with signature (node, oldValues, newValues, session).
  #
  # Arguments:
  # * session: The session of the actor who sets the values.
  # * values: An OSC message or an array of values to set.
  set: (session, values)->
    old = @values || []

    if values instanceof osc.Message
      @values = values.arguments
    else if Array.isArray(values)
      @values = values
    else
      throw new TypeError("Invalid value type")

    @emit("changed", @, old, @values, session)

  emit: ->
    @root.nodeObserver.emit(@address, arguments)
    super

# The OSC hub of the server.
class Hub extends Tree
  @Node: Node
  @NodeObserver: NodeObserver

  # export osc
  @osc: osc

  constructor: ->
    super()
    @sessionById  = {}
    @sessions     = []
    @nodeObserver = new NodeObserver

  # Dispose the hub and close each session.
  dispose: ->
    # dispose each registered session, session.dispose manipulates the underlying
    # @sessions array so we iterate over a copy of @sessions.
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

  # Dispose this session.
  #
  # This will emit `session:dispose` on the hub,
  # dispose all registered connections and all
  # nodes created by this session.
  dispose: (removeFromParent)->
    @hub.emit("session:dispose", @)

    # dispose each registered connection, connection.dispose manipulates the underlying
    # @connections array so we iterate over a copy of @connections.
    if @connections
      connection.dispose() for connection in @connections[..]

    # dispose each registered node, node.dispose manipulates the underlying
    # @nodes array so we iterate over a copy of @nodes.
    node.dispose() for node in @nodes[..]

    super(removeFromParent)

  # callback to remove a disposed node from the nodes list.
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

  # Add a connection to the session.
  #
  # Each registered connection will be disposed
  # on session dispose.
  addConnection: (connection)->
    @connections ||= []
    @connections.push(connection)

  # Remove a connection from session.
  removeConnection: (connection)->
    return unless @connections

    index = @connections.indexOf(connection)
    return false if index is -1
    @connections.splice(index, 1)
    true

  # send OSC message to the client
  sendOSC: ->
    return false unless @connections

    for c in @connections when c.sendOSC
      c.sendOSC.apply(c, arguments)
      return true
    false

  # send a JSON-RPC 2 request or notification to the client
  jsonRPC: ->
    return false unless @connections

    for c in @connections when c.jsonRPC
      c.jsonRPC.apply(c, arguments)
      return true
    false

Hub.Session = Session
module.exports = Hub
