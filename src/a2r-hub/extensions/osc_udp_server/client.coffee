osc = require "a2r-osc"
hub = require "../../"

class OscUdpClient extends hub.net.UdpClient
  @defaultOptions = { type: "udp", protocol: "udp+osc:" }

  constructor: (options)->
    super(options)
    @on("message", @onMessage.bind(@))

  onMessage: (data)->
    try
      # parse message
      message = osc.fromBuffer(data)
      # set sender to session
      message.from = @session
      @emit("osc", message)
      # send message
      @hub.send(message)
    catch e
      @emit("error", e)

module.exports = OscUdpClient
