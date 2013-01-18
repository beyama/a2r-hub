Client = require "./client"
net    = require "net"
assert = require "assert"
_      = require "underscore"

DEFAULT_OPTIONS =
  type: "tcp"
  protocol: "tcp:"

class TcpClient extends Client

  constructor: (options)->
    options = _.extend({}, options, DEFAULT_OPTIONS)
    super(options)

  # connect socket events with client handlers
  initSocket: ->
    @socket.on("error", @onSocketError.bind(@))
    @socket.on("close", @onSocketClose.bind(@))

  # initialize this client as server client
  initAsServerClient: ->
    @socket = @options.socket
    assert.ok(@socket, "Option `socket` must be given")
    @initSocket()
    @connected = true

  initAsClient: ->

  # close the socket
  _closeSocket: -> @socket.end()

  # close the connection
  close: ->
    @_closeSocket()
    super

  # open the connection
  open: (callback)->
    return callback() if @connected

    fn = (error)=>
      @socket.removeListener("connect", fn)
      @socket.removeListener("error", fn)

      unless error
        @connected = true
        @initSocket()
        @emit("connect")

      callback(error)

    @socket = net.createConnection
      port: @port
      host: @ip
      localAddress: @options.localAddress

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
  onSocketClose: -> @close()

module.exports = TcpClient
