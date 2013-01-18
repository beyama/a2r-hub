hub = require "../../"

parseFUDI = hub.fudi.parseFUDI
generateFUDI = hub.fudi.generateFUDI

utils = require "./utils"

class BrandtUdpClient extends hub.net.UdpClient
  constructor: (options)->
    super(options)

  initAsServerClient: ->
    super
    @nodeBySym = {}
    @on("message", @onMessage.bind(@))

  sendFUDI: (sym, typeTag, args)->
    fudi = generateFUDI(sym, typeTag, args)
    buffer = new Buffer(fudi, "ascii")
    @send(buffer, 0, buffer.length)

  add: (sym, typeTag)->
    address = utils.symToAddress(sym)

    return false unless address
    return false if @nodeBySym[address]

    try
      @nodeBySym[sym] = node = @session.createNode(address)
      @logger.info("BrandtUdpClient `#{@id}` node `#{address}` added")
    catch e
      return false

    node.data = fudiTypeTag: typeTag

    # register message handler
    node.on "message", (message)=>
      @sendFUDI(sym, typeTag, message.arguments)

    # register node dispose handler
    node.on "dispose", -> delete @nodeBySym[sym]

  remove: (sym)->
    regex = new RegExp("^#{sym}_\\S+$")
    for symbol, node of @nodeBySym when regex.test(symbol)
      @logger.info("BrandtUdpClient `#{@id}` node `#{node.address}` removed")
      node.dispose()

  inport: (inport)-> @setOutport(inport)

  stream: (address)-> @session.data.audioStream = address

  # handle message from PD
  onMessage: (data)->
    messages = parseFUDI(data)
    
    for message in messages
      switch message[0]
        when "add"    then @add(message[1], message[2])
        when "rm"     then @remove(message[1])
        when "inport" then @inport(message[1])
        when "stream" then @stream(message[1])

module.exports = BrandtUdpClient
