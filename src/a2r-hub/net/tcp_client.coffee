Client = require "./client"
net    = require "net"
assert = require "assert"
_      = require "underscore"

class TcpClient extends Client
  @defaultOptions = { type: "tcp", protocol: "tcp:" }

  constructor: (options)->
    super(options)
    @on("dispose", => @_closeSocket())

  # connect socket events with client handlers
  _initSocket: ->
    @socket.on("error", @onSocketError.bind(@))
    @socket.on("close", @onSocketClose.bind(@))

  _createClientSocket: -> net.createConnection(@)

  # initialize this client as server client
  initAsServerClient: ->
    @socket = @options.socket
    assert.ok(@socket, "Option `socket` must be given")
    @_initSocket()
    @connected = true
    super

  initAsClient: -> super

  # close the socket
  _closeSocket: -> @socket.end()

  # open the connection
  open: (callback)->
    return callback() if @connected

    fn = (error)=>
      @socket.removeListener("connect", fn)
      @socket.removeListener("error", fn)

      unless error and @connected
        @connected = true
        @_initSocket()
        @emit("connect")

      callback(error)

    @socket ||= @_createClientSocket()
    @socket.on("connect", fn)
    @socket.on("error", fn)

  # Send data
  send: (buffer, offset=0, length, callback)->
    if offset isnt 0 or length isnt buffer.length
      buf = new Buffer(length)
      buffer.copy(buf, 0, offset, (offset + length))
      @socket.write(buf, callback)
    else
      @socket.write(buffer, callback)

  # Delegate to @socket.write
  write: -> @socket.write.apply(@socket, arguments)

  # handle socket `error` event
  onSocketError: (error)-> @emit("error", error)

  # handle socket `close` event
  onSocketClose: -> @dispose()

module.exports = TcpClient
