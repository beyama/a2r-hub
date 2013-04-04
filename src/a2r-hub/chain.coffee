assert = require "assert"

BaseObject = require "./base_object"

Hub = require "./hub"

Hub.Node.mixin(chain: -> new Chain(@))

class Chain extends BaseObject
  constructor: (parent)->
    if parent instanceof Hub.Node
      @node = parent

      @callback = (message)=>
        @runSteps message, (err)=>
          @node.emit("error", err, @) if err
 
      @node.on("message", @callback)
    else if parent instanceof Chain
      @node   = parent.node
      @_chain = parent

      @callback = (message, next)=>
        @runSteps(message.clone())
        next(null, message)

      @_chain.step(@callback)
    else
      throw new Error("Parent of chain must either a Hub.Node or Hub.Chain")

    super(parent)

    @parent.chains ||= []
    @parent.chains.push(@)

    @_steps = []

  dispose: ->
    # remove step from parent if parent is a chain
    if @_chain
      index = @_chain._steps.indexOf(@callback)
      @_chain._steps.splice(index, 1) if index > -1
    # remove message callback from node
    else
      @node.removeListener("message", @callback)

    # remove this from parents chain list
    index = @parent.chains?.indexOf(@)
    @parent.chains.splice(index, 1) if index? > -1
    super

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

  # Run all steps in series and call callback with resulting
  # message or error object.
  runSteps: (message, callback)->
    l = @_steps.length

    return callback?(null, message) unless l

    i = 0
    closed = false

    # next handler
    _next = (error, msg)=>
      return if closed

      if error
        closed = true
        return callback?(error, msg)

      if i < l
        try
          @_steps[i++].call(@, msg, _next)
        catch e
          _next(e)
      else
        closed = true
        callback?(null, msg)

    # call first step
    _next(null, message)


module.exports = Chain

# load Chain extensions
require "./chain/"
