Summer = require "summer"
_      = require "underscore"
_s     = require "underscore.string"
async  = require "async"
assert = require "assert"

hub    = require "../"

class ServerExtension extends hub.Extension
  Summer.autowire @, connections: "connectionService"

  init: ->
    @protocol = @constructor.protocol
    assert.ok(@protocol, "#{@extensionName}: class property `protocol` must be set")

    @serverClass = @constructor.serverClass
    assert.ok(typeof @serverClass is 'function', "#{@extensionName}: class property `serverClass` must be set")

    @clientClass = @constructor.clientClass

    if @clientClass
      assert.ok(typeof @clientClass is 'function', "#{@extensionName}: class property `clientClass` must be a function")

    # get hosts-config key
    @configKey = @constructor.configKey || _s.underscored(@extensionName)

    @server = []

  start: (callback)->
    series = []

    @connections.registerServerHandler(@protocol, @serverClass)

    if @clientClass
      @connections.registerClientHandler(@protocol, @clientClass)

    if typeof @config.hosts is 'object'
      for host, config of @config.hosts when (config = config?[@configKey])
        do (host, config)=>
          config = {} if typeof config isnt 'object'

          series.push (callback)=>
            try
              # create a session for the server
              session = @hub.createSession(type: "server")

              context = new Summer(@context, "server")

              options =
                ip: host
                protocol: @protocol
                context: context
                session: session

              options = _.extend(options, config)

              @connections.createServer options, (error, server)=>
                if error
                  session.dispose()
                  @logger.error("#{@extensionName}: Host `#{host}` could not be started - #{error.message}")
                  @logger.debug(error.stack)
                else
                  @server.push(server)

                  # add close handler
                  server.on "close", =>
                    index = @server.indexOf(server)
                    @server.splice(index, 1) if index > -1
                    session.dispose()
                    context.shutdown()

                callback()
            catch error
              session.dispose()
              context.shutdown()
              @logger.error("#{@extensionName}: Host `#{host}` could not be started - #{error.message}")
              @logger.debug(error.stack)
              callback()

    # start each server
    async.series(series, callback)

  stop: (callback)->
    # Call stop on each server
    async.forEach(@server[..], ((s, c)-> s.stop(c)), callback)

module.exports = ServerExtension
