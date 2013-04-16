hub = require "../../"

parseFUDI = hub.fudi.parseFUDI
generateFUDI = hub.fudi.generateFUDI

Commands = require "./commands"

class BrandtUdpClient extends hub.net.UdpClient
  @defaultOptions = { type: "udp", protocol: "udp+brandt:" }

  constructor: (options)->
    super(options)
    @commands = new Commands(@)
    @on("message", @onMessage.bind(@))

  initAsClient: ->
    super
    # delegate socket message event to client message event
    @socket.on("message", (message)=> @emit("message", message))

  sendOSC: (message)->
    if message.elements?
      for m in message.elements
        @sendOSC(m)
    else
      @commands.handleOSC(message)

  sendFUDI: (values)->
    fudi = generateFUDI(values)
    buffer = new Buffer(fudi, "ascii")
    @send(buffer, 0, buffer.length)

  # handle message from PD
  onMessage: (data)->
    messages = parseFUDI(data)
    @commands.handleFUDI(messages)

module.exports = BrandtUdpClient
