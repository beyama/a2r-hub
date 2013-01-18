Summer = require "summer"
_s     = require "underscore.string"

# Base class for all extensions.
#
# Properties:
# context: The application context.
# hub: The root hub of the application
# logger: The application logger.
class Extension
  Summer.autowire @, config: "config"

  # Summer callback
  setApplicationContext: (context)->
    @hub         = context.get("hub")
    @logger      = context.get("logger")
    # create new extension context
    @context     = new Summer(context, "extension")

    # get extension name
    @extensionName = @constructor.extensionName || @constructor.name.replace(/Extension$/, "")

  # called after summer initialized the extension
  init: ->

  # called by the extension loader to start the extension
  start: (callback)-> callback()

  # called by the extension loader to stop the extension
  stop: (callback)-> callback()

module.exports = Extension
