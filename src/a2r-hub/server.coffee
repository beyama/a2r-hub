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

    @hub.on "extensions", =>
      @logger.info("Creating WII routes")

      @hub.on "node", (node)=>
        @logger.info("New node created - #{node.address}")
    
      @hub.on "client", (client)=>
        if client.ip is "192.168.1.100" and client.port is 5010
          @logger.info("Wii connected")
          client.sendOSC("/wii/rumble", [0, 1])
          setTimeout ->
            client.sendOSC("/wii/rumble", [0, 0])
          , 500

          # @context.get("connectionService").createClient "udp+osc://127.0.0.1:8001", (e, c)=>
          #   console.log "create wii"
          #   new Wii(@hub, client, c, @logger)

        else if client.ip is "192.168.1.102"
          client.on "osc", (msg)=>
            @logger.info("#{msg.address} #{msg.arguments}")

  # stop server
  stop: -> @hub.emit("stop")

module.exports = Server
