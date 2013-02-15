osc = require "a2r-osc"
assert = require "assert"

Chain = require "../chain"

scale = require("./scale")

# extend Chain-class with route method
Chain::route = (options)->

  # destination address
  destination = options.address || @node.address

  # argument mapping rules
  args = options.args || options.arguments

  assert(typeof args is "object", "Option `arguments` must be given")

  args = [args] unless Array.isArray(args)

  # destination hub
  hub = options.hub || @node.root

  # vars
  vars = options.vars || @node.vars

  if destination is @node.address and hub is @node.root
    throw new Error("Route to source not allowed")

  # normalize argumens
  args = for arg in args
    o = {}

    if typeof arg is "object"
      # argument takes value from source arguments
      if arg.index?
        _arg = @node.arg(arg.index)
        assert(_arg, "No argument descriptor found for `#{arg.index}`")
        o.argument = _arg
      # argument takes value from variables
      else if arg.var
        o.var = arg.var
      # argument is a fixed value
      else if arg.value
        o.value = arg.value
      # invalid
      else
        throw new Error("Invalid route argument - #{arg}")
      
      o.type    = arg.type if arg.type
      o.cut     = arg.cut if arg.cut
      o.default = arg.default if arg.default

      # check both min and max must be given
      if (arg.min? and not arg.max?) or (arg.max? and not arg.min?)
        throw new Error("Invalid route argument min and max must be given - #{arg}")

      # copy min and max
      if arg.min?
        o.outMin = arg.min
        o.outMax = arg.max

        # check that varMin and varMax are given if this is a variable
        if arg.var
          varMin = arg.varMin
          varMax = arg.varMax

          if (not varMin? or not varMax?)
            throw new Error("Invalid route argument both varMin and varMax must be given for scaling - #{arg}")

          assert(varMin < varMax, "Variable min value must be lower than variable max value")

          o.inMin = varMin
          o.inMax = varMax
        else
          o.inMin = _arg.min
          o.inMax = _arg.max

        o.scale = scale(o.inMin, o.inMax, o.outMin, o.outMax, o.cut)
    else
      o.value = arg
    o

  # Add the route step to chain
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
        value = vars?[arg.var]
        type  = arg.type

      # don't process with undefined values
      return next(null, message) if value is undefined

      if arg.scale
        value = arg.scale(value)
        return next(null, message) if value is undefined

      if type
        values[i] = { type: type, value: value }
      else
        values[i] = value

    msg = new osc.Message(destination, values)
    hub.send(msg)
    next(null, message)
