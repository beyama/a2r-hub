Hub = require "./hub"
ExtensionLoader = require "./extension_loader"
Summer = require "summer"

class Server
  Summer.autowire @, config: "config", pidFileWriter: "pidFileWriter"

  # called by summer
  setApplicationContext: (context)->
    @context = context
    @logger  = @context.get("logger")
    @hub     = @context.get("hub")

  # start server
  start: (callback)->
    # register extension loader
    @context.register("ExtensionLoader", class: ExtensionLoader, init: "init", dispose: "dispose")

    # resolve extension loader
    @context.resolve("ExtensionLoader", callback)

  # stop server
  stop: -> @hub.emit("stop")

module.exports = Server
