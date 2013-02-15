assert = require "assert"

Chain = require "../chain"

scale = (inMin, inMax, outMin, outMax, cap=false)->
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

# Scale a message argument
#
# signatures:
# * (index, outMin, outMax, [cap=false])
# * (index, inMin, inMax, outMin, outMax, [cap=false])
Chain::scale = (index, inMin, inMax, outMin, outMax, cap=false)->
  if typeof index is "string"
    arg = @node.argument(index)
    assert(arg, "No argument descriptor found for named argument `#{index}`")
    index = arg.index
  else
    assert(index > -1, "Argument index must be a non negative value")

  # get input min and max from node
  if arguments.length <= 4
    cap    = !!outMin
    outMin = inMin
    outMax = inMax
    arg = @node.argument(index)
    assert(arg, "No argument descriptor found for index `#{index}`")
    inMin = arg.min
    inMax = arg.max

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
  @step (message, next)->
    input = message.arguments[index]
    return next(null, message) unless input?

    # stop processing if input is out of range and cap is true
    if cap and ((input < inMin) or (input > inMax))
      return

    value = ((outDiff * (input - inMin)) / inDiff) + outMin
    message.arguments[index] = value
    next(null, message)

module.exports = scale
