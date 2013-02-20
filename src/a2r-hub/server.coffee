Summer = require "summer"

Hub = require "./hub"

class Server
  Summer.autowire @, config: "config", pidFileWriter: "pidFileWriter"

  # called by summer
  setApplicationContext: (context)->
    @context = context
    @logger  = @context.get("logger")
    @hub     = @context.get("hub")

  # start server
  start: (callback)->
    # resolve extension loader
    @context.resolve("extensionLoader", callback)

  # stop server
  stop: -> @hub.emit("stop")

module.exports = Server
