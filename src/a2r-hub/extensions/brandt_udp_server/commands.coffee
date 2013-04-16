a2rHub = require "../../"
utils = require "./utils"

# Commands class to handle FUDI messages.
class Commands extends a2rHub.BaseObject
  constructor: (client)->
    super(client)
    @nodeBySym    = {}
    @symByAddress = {}
    @logger       = @parent.logger
    @session      = @parent.session
    @jamService   = @parent.context.get("jamService")

  dispose: ->
    # dispose jam if jam is owned by the client
    if @jam and @jam.owner is @session
      @jam.dispose()
    # else dispose nodes which are created by the client
    else
      for sym, node of @nodeBySym
        if node.owner is @session
          node.dispose()
        else
          node.removeListener("dispose", @onNodeDispose)
    super

  # Dispatcher method, handles a list of parsed fudi messages.
  handleFUDI: (messages)->
    for message in messages
      sym = message[0]
      if typeof @[sym] is "function"
        @[sym].apply(@, message[1..-1])
      # TODO: else look for node by sym and set values on node

  # Transforms an OSC message to FUDI and send it to the client
  handleOSC: (message)->
    sym = @symByAddress[message.address]

    return false unless sym

    fudi = [sym]
    fudi.push.apply(fudi, message.arguments)
    @parent.sendFUDI(fudi)

  # Handle node dispose event
  onNodeDispose: (node)=>
    sym = @symByAddress[node.address]
    delete @nodeBySym[sym] if sym
    delete @symByAddress[node.address]
  
  # Create or join a jam
  patch: (name)->
    # get jam by name if @jam is undefined
    @jam ||= @jamService.getJam(name)

    if @jam
      # leave jam
      @jam.leave(@session)

      # dispose jam if jam is created by the client
      if @jam.owner is @session
        @jam.dispose()
        @jam = null
      else if @jam.name isnt name
        @jam = @jamService.getJam(name)

    # create jam if not exist
    @jam ||= @jamService.createJam(@session, name)
    # (re-)join jam
    @jam.join(@session)

  # Create a new OSC node
  add: (sym, typeTag)->
    return unless @jam

    address = utils.symToAddress(sym)

    return unless address
    return if @nodeBySym[sym]

    if (node = @jam.getNode(address))
      @nodeBySym[sym] = node
      @symByAddress[node.address] = sym
      node.on("dispose", @onNodeDispose)
      return

    # create node
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
    @symByAddress[node.address] = sym

    # configure node chain (session lock of 500ms and set values)
    node.chain().lock(500).set()

    @logger.info("#{@parent.constructor.name} `#{@parent.address}` node `#{address}` added")

    # register node dispose handler
    node.on("dispose", @onNodeDispose)

  # Remove a bunch of nodes.
  remove: (sym)->
    regex = new RegExp("^#{sym}_\\S+$")
    for symbol, node of @nodeBySym when regex.test(symbol)
      @logger.info("BrandtUdpClient `#{@address}` node `#{node.address}` removed")
      node.dispose()

  # Set the UDP inport
  inport: (inport)-> @parent.setOutport(inport) if @parent.setOutport

  # Set an stream address on the jam session
  stream: (address)->
    return false unless @jam
    @jam.stream = address

module.exports = Commands
