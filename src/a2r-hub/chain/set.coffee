Chain = require "../chain"

# Set arguments of message as current values of the node.
#
# Arguments:
# * copy: If true then this step will copy the arguments of the message (default: false)
#
# You should enabale copying if you have other steps in the chain
# which alter the content of message arguments.
Chain::set = (copy=false)->
  @step (message, next)->
    values = if copy then message.arguments[0..-1] else message.arguments
    @node.set(message.from, values)
    next(null, message)
