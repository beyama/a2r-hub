assert = require "assert"
osc = require "a2r-osc"
_ = require "underscore"

scale = (inMin, inMax, cap, outMin, outMax)->
  assert(inMin < inMax, "Input minimum must be less than input max")
  assert(outMin < outMax, "Output minimum must be less than output max")

  inDiff  = inMax - inMin
  outDiff = outMax - outMin

  # Thanks to irritate
  # http://stackoverflow.com/questions/5294955/how-to-scale-down-a-range-of-numbers-with-a-known-min-and-max-value
  #
  #            (outMax-outMin)(input - inMin)
  # f(input) = ------------------------------ + outMin
  #                   outMax - outMin
  (input)->
    return unless input?

    if cap and (input < inMin) or (input > inMax)
      return

    ((outDiff * (input - inMin)) / inDiff) + outMin

scaleArgument = (index, inMin, inMax, cap, outMin, outMax)->
  assert(index > -1, "Argument index must be a non negativ value")
  assert(inMin < inMax, "Input minimum must be less than input max")
  assert(outMin < outMax, "Output minimum must be less than output max")

  inDiff  = inMax - inMin
  outDiff = outMax - outMin

  # Thanks to irritate
  # http://stackoverflow.com/questions/5294955/how-to-scale-down-a-range-of-numbers-with-a-known-min-and-max-value
  #
  #            (outMax-outMin)(input - inMin)
  # f(input) = ------------------------------ + outMin
  #                   outMax - outMin
  (message, next)->
    input = message.arguments[index]
    return next() unless input?

    if cap and (input < inMin) or (input > inMax)
      return

    value = ((outDiff * (input - inMin)) / inDiff) + outMin
    message.arguments[index] = value
    next(message)

sessionCloseHandler = (session)->
  if session.data?.messageHandler?.length
    for handler in session.data.messageHandler[..]
      handler.dispose()
    null

lazySetup = (hub)->
  if hub.listener("session:close").indexOf(sessionCloseHandler) < 0
    hub.on("session:close", sessionCloseHandler)

class MessageHanlder
  constructor: (node, options={})->
    assert(typeof options.handler is "function", "Option handler must be given")

    @node    = node
    @options = options
    @hub     = @options.hub || node.root
    @handler = @options.handler.bind(@)

    if @options.session
      lazySetup(@hub)
      @session = @options.session
      @session.data.messageHandler ||= []
      @session.data.messageHandler.push(@)

    @node.on("message", @handler)
    @node.on("dispose", @onDispose)

    @_args      = []
    @_argByName = {}

  onDispose: => @dispose()

  dispose: ->
    # remove from session
    if @session
      handler = @session.data.messageHandler
      index = handler.indexOf(@)
      handler.splice(index, 1) if index > -1

    # unregister message and dispose handler
    @node.removeListener("message", @handler)
    @node.removeListener("dispose", @onDispose)

  arg: (index, desc)->
    # if getter
    unless desc?
      return if typeof index is "string" then @_argByName[index] else @_args[index]

    # else setter
    assert(index > -1, "Argument index must be non negativ value")
    assert(not @_args[index], "Argument is already defined")

    if desc.min and desc.max
      assert(desc.min < desc.max, "Descriptor min must be less than max")

    desc.index = index

    @_args[index] = desc

    if desc.name
      assert(not @_argByName[desc.name], "Argument name is already taken")
      @_argByName[desc.name] = desc
    @

  args: (descs)->
    @arg(i, desc) for desc, i in descs
    @

class TransformationChain
  constructor: (handler)->
    @handler = handler
    @hub     = handler.hub
    @_steps  = []

  step: (fn)-> @_steps.push(fn)

  transform: (message, next)=>
    return if @_steps.length is 0

    i = 0
    _next = (msg)=>
      i++
      if i < @_steps.length
        @_steps[i].call(@, msg, _next)
      else
        next(msg)

    @_steps[0].call(@, message, _next)

class Scaler extends TransformationChain

  scale: (index, cap, outMin, outMax)->
    desc = @handler.arg(index)

    assert(desc, "No descriptor found for argument `#{index}`")

    @step scale(index, desc.min, desc.max, cap, outMin, outMax)
    @


class Router extends TransformationChain

  route: (destination, args)->
    if typeof destination is "object"
      args = destination
      destination = null

    assert(typeof args is "object", "Argument description must be given")

    args = [args] unless Array.isArray(args)

    # normalize argumens
    args = for arg in args
      options = {}

      if typeof arg is "object"
        # argument takes value from source arguments
        if arg.index
          _arg = @handler(arg.index)
          assert(_arg, "No argument descriptor found for `#{arg.index}`")
          options.argument = _arg
        # argument takes value from variables
        else if arg.var
          options.var = arg.var
        # argument is a fixed value
        else if arg.value
          options.value = arg.value
        # invalid
        else
          throw new Error("Invalid route argument - #{arg}")

        # check both min and max must be given
        if (arg.min? and not arg.max?) or (arg.max? and not arg.min?)
          throw new Error("Invalid route argument min and max must be given - #{arg}")

        # copy min and max
        if arg.min?
          options.min = arg.min
          options.max = arg.max

          # check that varMin and varMax are given if this is a variable
          if arg.var
            varMin = arg.varMin
            varMax = arg.varMax

            if (not varMin? or not varMax?
              throw new Error("Invalid route argument both varMin and varMax must be given for scaling - #{arg}")
            assert(varMin < varMin, "Variable min value must be lower than variable max value")

            options.varMin = varMin
            options.varMax = varMax
          # TODO: Add scale method
        
        options.type = arg.type if arg.type
        options.default = arg.default if arg.default
      else
        options.value = arg

    # add message composer step
    @step (message, next)=>
      values = []

      # resolve values
      for arg, i in args
        value = null
        type  = arg.type

        # get value from source arguments
        if arg.argument
          argument = arg.argument
          value = message.arguments[argument.index] ? arg.default
          type  = argument.type ? type
        # set value from options
        else if arg.value
          value = arg.value
          type  = arg.type
        # set value from variable
        else
          value = @vars[arg.var]
          type  = arg.type

        # don't process with undefined values
        return if value is undefined

        value = arg.scale(value) if arg.scale

        if type
          values[i] = { type: type, value: value }
        else
          values[i] = value

      msg = new osc.Message(destination || message.address, values)
      console.log msg

msg = new osc.Message("/wii/accel/x", [0.789799])

t = new MessageTransformer
t
  .rewriteAddress("/foo/bar")
  .scale(0, 0.0, 1.0, true, 0, 127)

t.process(msg)
console.log msg
