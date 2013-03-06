BaseObject = require "./base_object"
address    = require "./address"
Hub        = require "./hub"
osc        = Hub.osc

class Jam extends BaseObject
  constructor: (session, name)->
    if not address.isValidToken(name)
      throw new Error("Invalid Jam name `#{name}`")

    super(session)

    @owner     = session
    @createdAt = new Date
    @hub       = @owner.hub
    @name      = name
    @context   = @hub.context
    @logger    = @context.get("logger")

    @participants = []

  join: (session)->
    unless session instanceof Hub.Session
      throw new Error("session must be an instance of Hub.Session")

    if @participants.indexOf(session) is -1
      @participants.push(session)

  leave: (session)->
    unless session instanceof Hub.Session
      throw new Error("session must be an instance of Hub.Session")

    index = @participants.indexOf(session)
    @participants.splice(index, 1) if index > -1

  onNodeValuesChanged: (node, oldValues, newValues, session)=>
    # FIXME: The signature of this message will not use integer
    # for numbers, even if the descriptor of this node says integer.
    message = new osc.Message(node.address, newValues)

    for s in @participants when s isnt session
      console.log "send changes to #{session.id}"
      s.sendOSC(message)

  createNode: (session, address, options)->
    if typeof session is "string"
      options = address
      address = session
      session = @owner

    address = "/#{@name}#{address}"
    @logger.info("Jam `#{@name}` create node `#{address}`")
    session.createNode(address, options)

module.exports = Jam
