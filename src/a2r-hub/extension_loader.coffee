Summer = require "summer"
async  = require "async"

class ExtensionLoader
  Summer.autowire @, config: "config"

  setApplicationContext: (context)->
    @context = context
    @hub     = @context.get("hub")
    @logger  = @context.get("logger")
    @extensions = null

  init: (callback)->
    ids = []
    if @config.extensions
      for name, config of @config.extensions
        if config.loadpath
          try
            extension = require(config.loadpath)
            if extension
              if typeof extension isnt 'function'
                @logger.error "ExtensionLoader: loadpath `#{config.loadpath}` doesn't contain a extension"
                extension = null
          catch e
            @logger.error "ExtensionLoader: couldn't load extension `#{name}` from path `#{config.loadpath}`"
        else
          try
            extension = require("./extensions/#{name}_extension")
          catch e
            @logger.error "ExtensionLoader: couldn't load extension with name `#{name}`"
            @logger.error e.stack

        if extension
          ids.push(extension.name)
          @context.register(extension.name, class: extension, init: "init")

      if ids.length
        @context.resolve ids, (err, extensions)=>
          return callback(err) if err

          @extensions = extensions

          series = []
          for id, instance of @extensions
            do (id, instance)=>
              # extension starter
              series.push (callback)=>
                try
                  @hub.emit("extension:start", id, instance)
                  instance.start (e)=>
                    if e
                      @hub.emit("extension:error", id, instance, e)
                      @logger.error "ExtensionLoader: couldn't start extension `#{id}` - #{e.message}"
                      @logger.error e.stack
                      return callback()
                    @hub.emit("extension:started", id, instance)
                    @hub.emit("extension", instance)
                    callback()
                catch e
                  @hub.emit("extension:error", id, instance, e)
                  @logger.error "ExtensionLoader: couldn't start extension `#{id}` - #{e.message}"
                  @logger.error e.stack
                  callback()

          async.series series, (err)=>
            return callback(err) if err

            @hub.emit("extensions", @extensions)
            callback()
      else
        callback()

  # Iterator for async.forEachSeries in dispose
  _stopExtension: (id, callback)=>
    extension = @extensions[id]
    return callback() unless extension

    delete @extensions[id]

    @hub.emit("extension:stop", id, extension)
    extension.stop (error)=>
      if error
        @logger.error "ExtensionLoader: error stopping extension `#{id}` - #{err.message}"
        @logger.debug(error.stack)
        @hub.emit("extension:error", id, extension, err)
      else
        @logger.info "ExtensionLoader: extension `#{id}` stopped"
        @hub.emit("extension:stopped", id, extension)
      # we don't tell async about an error
      callback()

  # Shutdown this service and stop each extension.
  dispose: (callback)->
    return callback() unless @extensions

    # We stop the extensions in reverse order
    ids = Object.keys(@extensions)
    ids.reverse()
    async.forEachSeries ids, @_stopExtension, (err)=>
      return callback(err) if err

      @hub.emit("extensions:stoped")
      callback()
 

module.exports = ExtensionLoader
