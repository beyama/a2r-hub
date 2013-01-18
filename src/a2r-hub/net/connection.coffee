EventEmitter = require("events").EventEmitter
assert = require "assert"
isIP   = require("net").isIP
url    = require "url"
_      = require "underscore"

Hub = require("../hub")

# Base class of all A2R Hub network connections.
#
# constructor:
# * options:
# ** ip: The IP-address of this connection
# ** port: The port number of this connection
# ** type: Protocol (udp or tcp)
# ** protocol: The protocol of this connection (e.g. "wss:", "udp+osc:", ...)
# ** session: The session belonging to the connection (optional)
#
# Events:
# * close: Emitted if the connection gets closed.
#
# Properties:
# * ip: The IP-address of the connection
# * port: The port of the connection
# * ipVersion: The IP version (4 or 6)
# * type: Connection type (udp or tcp)
# * protocol: Protocol
# * session: The session belonging to this connection
# * context: The application context
# * hub: The application hub
# * logger: The application logger
# * address: The address of this connection
# * options: The options object supplied to the constructor
#
# Class properties:
# * defaultOptions: Default options for the constructor
class Connection extends EventEmitter
  constructor: (options)->
    assert.ok(typeof options is 'object', "Options must be given")

    options = _.extend({}, options, @constructor.defaultOptions)

    @ip        = options.ip
    @port      = Number(options.port)
    @ipVersion = isIP(@ip)
    @type      = options.type
    @protocol  = options.protocol
    @context   = options.context
    @session   = options.session if options.session
    @hostname  = options.hostname if options.hostname
    @options   = options

    assert.ok(@ipVersion, "Option `ip` must be a valid IP-address")
    assert.ok(@port and @port isnt NaN, "Option `port` must be a number")
    assert.ok(@protocol, "Option `protocol` must be given")
    assert.ok(@context, "Option `context` must be given")
    assert.ok(@type is "udp" or @type is "tcp", "Option `type` must be 'udp' or 'tcp'")

    @hub    = @context.get("hub")
    @logger = @context.get("logger")

    if @session
      assert.ok(@session instanceof Hub.Session, "Session must be an instance of Hub.Session")

      # register this connection on the session
      @session.connections ||= []
      @session.connections.push(@)

      # close this connection on session 'close'
      @session.on("close", @onSessionClose)

    @address = url.format
      protocol: @protocol
      slashes:  true
      hostname: @ip
      port:     @port

  onSessionClose: => @close()

  close: ->
    return if @closed

    if @session
      # remove this connection from the session
      index = @session.connections.indexOf(@)
      @session.connections.splice(index, 1) if index > -1
      @session.removeListener("close", @onSessionClose)

    @closed = true
    @emit("close")
    @removeAllListeners()


module.exports = Connection
