Chain = require "../chain"

# Locks a chain exclusively for a certain time for a session
# which had last access to the unlocked chain.
# 
# Arguments:
# * time: Time in ms to lock this chain for a session (default: 500ms)
#
# The time argument is the interval to check if the user had access to this
# chain since the last check and if not to release the lock. So the maximum
# time a chain could stay locked is (time * 2) - 1ms .
Chain::lock = (time=500)->
  # session which holds the lock
  lockedBy   = null
  intervalId = null
  accessed   = false

  @step (message, next)->
    # we don't forward anonymous messages
    if message.from?
      # channel is unlocked
      if lockedBy is null

        intervalId = setInterval =>
          if accessed
            accessed = false
          else
            clearInterval(intervalId)
            accessed = false
            session  = lockedBy
            lockedBy = null
            @node.emit("unlocked", @node, session)
        , time
        
        lockedBy = message.from
        @node.emit("locked", @node, message.from)

        next(null, message)

      # channel is locked by message sender
      else if lockedBy is message.from
        accessed = true
        next(null, message)
