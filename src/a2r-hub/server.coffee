Summer = require "summer"

Hub = require "./hub"
Jam = require "./jam"

class MimaJam extends Jam
  constructor: ->
    super

    @masterChannel = @hub.createNode("/master/channel")
    @masterChannel.set(@session, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50])
    @masterChannel.chain().lock(500).set()
    @masterChannel.on("changed", @onNodeValuesChanged)

    @mimaSpinner = @hub.createNode("/mima/spinner")

    # auto add clients to this jam
    @hub.on "client", (c)=>
      @join(c.session)
      # remove client from jam on client dispose
      c.on "dispose", => @leave(c.session)

      # FIXME: setTimeout here is a workaround,
      # it seems that the WS connection isn't ready
      # for sending OSC messages at this point so we wait 100ms.
      setTimeout =>
        c.sendOSC("/master/channel", @masterChannel.values)
      , 100

    @hub.on "extensions", =>
      @hub.context.resolve "connectionService", (err, service)=>

        service.createClient "udp+brandt://127.0.0.1:3002", (err, pd)=>

          # connect nodes on message event with pd
          @masterChannel.on "message", (msg)->
            pd.sendFUDI("master_channel", "iiiiiiiiii", msg.arguments)

          @mimaSpinner.on "message", (msg)->
            pd.sendFUDI("mima_spinner", "f", msg.arguments)

class Server
  Summer.autowire @, config: "config", pidFileWriter: "pidFileWriter"

  # called by summer
  setApplicationContext: (context)->
    @context = context
    @logger  = @context.get("logger")
    @hub     = @context.get("hub")

    # TODO: make jam creation dynamic
    @createMimaJam()

  # start server
  start: (callback)->
    # resolve extension loader
    @context.resolve("extensionLoader", callback)

  # stop server
  stop: -> @hub.emit("stop")

  # TODO: make jam creation dynamic
  createMimaJam: ->
    @mimaSession = @hub.createSession()
    @mimaJam = new MimaJam(@mimaSession, "mima")

module.exports = Server
