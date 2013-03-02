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
      # emit `osc`
      @emit("osc", message)
      # send message
      @sendToHub(message)
    catch e
      @emit("error", e)

module.exports = OscUdpClient
