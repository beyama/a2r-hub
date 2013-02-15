Chain = require "../chain"

# Adds a filter to chain that only triggers the next
# handler if a specified value is crossed.
#
# Arguments:
# * index: The index of the argument that should be watched
# * value: The value which must be crossed
# * direction: The direction in which the value must be crossed (default: 'any')
#
# Directions:
# * up: The argument value crosses the specified value upwards
# * down: The argument value crosses the specified value downwards
# * any: The argument value crosses the specified value in any direction
Chain::crosses = (index, value, direction="any")->
  if typeof index is "string"
    arg = @node.arg(index)
    assert(arg, "Can't find argument by name `#{index}`")
    index = arg.index

  lastValue = null

  # add step chain
  @step switch direction
    when "any"
      (message, next)->
        currentValue = message.arguments[index]

        return unless currentValue?

        if lastValue?
          if ((lastValue <= value) and (currentValue > value)) or ((lastValue >= value) and (currentValue < value))
            next(null, message)
        lastValue = currentValue
    when "up"
      (message, next)->
        currentValue = message.arguments[index]

        return unless currentValue?

        if lastValue?
          if (lastValue <= value) and (currentValue > value)
            next(null, message)
        lastValue = currentValue
    when "down"
      (message, next)->
        currentValue = message.arguments[index]

        return unless currentValue?

        if lastValue?
          if (lastValue >= value) and (currentValue < value)
            next(null, message)
        lastValue = currentValue
    else
      throw new Error("Cross direction must be 'any', 'up' or 'down'")
