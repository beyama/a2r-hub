hub = require "../../"

parseFUDI = hub.fudi.parseFUDI
generateFUDI = hub.fudi.generateFUDI

Commands = require "./commands"

class BrandtUdpClient extends hub.net.UdpClient
  @defaultOptions = { type: "udp", protocol: "udp+brandt:" }

  constructor: (options)->
    super(options)
    @commands = new Commands(@)

  initAsServerClient: ->
    super
    @on("message", @onMessage.bind(@))

  sendFUDI: (values)->
    fudi = generateFUDI(values)
    buffer = new Buffer(fudi, "ascii")
    @send(buffer, 0, buffer.length)

  # handle message from PD
  onMessage: (data)->
    messages = parseFUDI(data)
    @commands.handleFUDI(messages)

module.exports = BrandtUdpClient
