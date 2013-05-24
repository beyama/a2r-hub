assert = require "assert"

Chain = require "../chain"

# Adds a filter to chain that only triggers the next
# handler if the value goes from positive to 0.
#
# Arguments:
# * index: The index of the argument that should be watched (default: 0)
Chain::fromPositiveToZero = (index=0)->
  if typeof index is "string"
    arg = @node.arg(index)
    assert(arg, "Can't find argument by name `#{index}`")
    index = arg.index

  lastValue = null
  currentValue = null

  @step (message, next)->
    currentValue = message.arguments[index]

    return unless currentValue?

    if lastValue?
      if lastValue > 0 and currentValue is 0
        next(null, message)
    lastValue = currentValue

