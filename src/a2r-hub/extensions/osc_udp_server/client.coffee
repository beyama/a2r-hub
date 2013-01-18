osc = require "a2r-osc"
hub = require "../../"

class OscUdpClient extends hub.net.UdpClient
  constructor: (server, ip, port, session)->
    super(server, ip, port, session)
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
