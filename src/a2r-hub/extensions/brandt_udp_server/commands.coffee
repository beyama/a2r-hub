a2rHub = require "../../"
utils = require "./utils"

# Commands class to handle FUDI messages.
class Commands extends a2rHub.BaseObject
  constructor: (client)->
    super(client)
    @nodeBySym  = {}
    @logger     = @parent.logger
    @session    = @parent.session
    @jamService = @parent.context.get("jamService")

  dispose: ->
    @jam.dispose() if @jam
    super

  # Dispatcher method, handles a list of parsed fudi messages.
  handleFUDI: (messages)->
    for message in messages
      sym = message[0]
      if typeof @[sym] is "function"
        @[sym].apply(@, message[1..-1])
      # TODO: else look for node by sym and set values on node
  
  # Create a new jam session for patch
  patch: (name)->
    @jam.dispose() if @jam
    @jam = @jamService.createJam(@session, name)

  # Add a new OSC node which transforms a received OSC message
  # to FUDI and sends the FUDI message to PD.
  add: (sym, typeTag)->
    return unless @jam

    address = utils.symToAddress(sym)

    return unless address
    return if @nodeBySym[sym]

    args = []
    if typeTag
      l = typeTag.length
      i = 0
      while i < l
        char = typeTag.charAt(i++)
        switch char
          when "f" then args.push(type: "float", minimum: 0, maximum: 1, step: 0.1)
          when "i" then args.push(type: "integer", minimum: 0, maximum: 127, step: 1)
          when "s" then args.push(type: "string")
          else
            throw new Error("Unsupported type `#{char}`")

    @nodeBySym[sym] = node = @jam.createNode(@session, address, args: args)
    @logger.info("#{@parent.constructor.name} `#{@parent.address}` node `#{address}` added")

    # register message handler
    node.on "message", (message)=>
      values = message.arguments[0..-1]
      values.unshift(sym)
      @parent.sendFUDI(values)

    # register node dispose handler
    node.on "dispose", => delete @nodeBySym[sym]

  # Remove a bunch of nodes.
  remove: (sym)->
    regex = new RegExp("^#{sym}_\\S+$")
    for symbol, node of @nodeBySym when regex.test(symbol)
      @logger.info("BrandtUdpClient `#{@address}` node `#{node.address}` removed")
      node.dispose()

  # Set the UDP inport
  inport: (inport)-> @parent.setOutport(inport) if @parent.setOutport

  # Set an stream address on the jam session
  stream: (address)-> @jam.stream = address

module.exports = Commands
