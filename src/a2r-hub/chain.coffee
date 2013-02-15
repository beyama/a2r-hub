assert = require "assert"

BaseObject = require "./base_object"

Hub = require "./hub"

Hub.Node.mixin(chain: -> new Chain(@))

class Chain extends BaseObject
  constructor: (parent)->
    if parent instanceof Hub.Node
      @node = parent
      @node.on("message", @handle)
      @on "dispose", => @node.removeListener("message", @handle)
    else if parent instanceof Chain
      @node   = parent.node
      @_chain = parent
      @_chain.step(@handle)
    else
      throw new Error("Parent of chain must either a Hub.Node or Hub.Chain")
    super(parent)

    @_steps = []

  # Create a sub chain of chain
  chain: -> new Chain(@)

  # Returns the previous chain
  end: -> @_chain

  # Add a step to the chain.
  #
  # Step-function signature must be (message, [next]).
  # `next` must be called with the message object that
  # should be passed to the next step.
  step: (fn)->
    if typeof fn isnt "function"
      throw new Error("A step must be a function")
    @_steps.push(fn)
    @

  # The message handler.
  #
  # This will call each registered step in series with the
  # supplied message.
  #
  # This method is added either to the `message` event
  # if the parent of the chain is a node or to the
  # steps-list if parent is a chain.
  handle: (message, next)=>
    return next?(null, message) if @_steps.length is 0

    i = 0
    closed = false

    # next handler
    _next = (error, msg)=>

      if closed
        @node.emit("error", new Error("Closed channel next handler called"), @)
        return

      if error
        @node.emit("error", error, @)
        closed = true
        return

      if i < @_steps.length
        try
          @_steps[i++].call(@, msg, _next)
        catch e
          _next(e)
      else
        closed = true

    # call first step
    _next(null, message)

    # call next if given
    next?(null, message)

module.exports = Chain

# load Chain extensions
require "./chain/"
