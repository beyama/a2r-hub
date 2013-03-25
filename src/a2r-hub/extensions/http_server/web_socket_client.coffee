hub = require "../../"
osc = require "a2r-osc"

WebSocket = require "ws"

SEND_BINARY_OPTIONS = binary: true, mask: false
SEND_TEXT_OPTION = binary: false, mask: false

class WebSocketClient extends hub.net.TcpClient
  @defaultOptions = { type: "tcp", protocol: "ws:" }

  constructor: (options)->
    super(options)
    rpc = @context.get("jsonRPC")
    @rpcClient = rpc.createClient(@)
    @rpcClient.on("error", (e)=> @emit("error", e))

  _initSocket: ->
    super
    @socket.on("message", @onSocketMessage.bind(@))

  # close the socket
  _closeSocket: -> @close()

  close: (code, data)->
    return if @disposed or not @connected

    @socket.close(code, data)
    @connected = false

  # open the connection
  open: (callback)->
    return callback() if @connected

    fn = (error)=>
      @socket.removeListener("open", fn)
      @socket.removeListener("error", fn)

      unless error and @connected
        @connected = true
        @_initSocket()
        @emit("connect")

      callback(error)

    @socket ||= new WebSocket(@address)
    @socket.on("open", fn)
    @socket.on("error", fn)

  # call a remote method via JSON-RPC
  jsonRPC: -> @rpcClient.call.apply(@rpcClient, arguments)

  # send an object as JSON
  sendJSON: (json)-> @send(JSON.stringify(json))

  send: (buffer, offset, length, callback)->
    if typeof buffer is "string"
      @socket.send(buffer, SEND_TEXT_OPTION, callback)
    else
      if offset isnt 0 or length isnt buffer.length
        buf = new Buffer(length)
        buffer.copy(buf, 0, offset, (offset + length))
        @socket.send(buf, SEND_BINARY_OPTIONS, callback)
      else
        @socket.send(buffer, SEND_BINARY_OPTIONS, callback)

  onSocketMessage: (message, flags)->
    try
      if flags.binary
        message = osc.fromBuffer(message)
        @emit("osc", message)
        @sendToHub(message)
      else
        process.nextTick => @rpcClient.handle(message)
    catch e
      @emit("error", e)

module.exports = WebSocketClient
