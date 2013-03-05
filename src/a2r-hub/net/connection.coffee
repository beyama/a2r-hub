assert = require "assert"
isIP   = require("net").isIP
url    = require "url"
_      = require "underscore"

Hub = require "../hub"
BaseObject = require "../base_object"

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
# Properties:
# * ip: The IP-address of the connection
# * port: The port of the connection
# * ipVersion: The IP version (4 or 6)
# * type: Connection type (udp or tcp)
# * protocol: Protocol
# * hostname: Host name
# * localAddress: Local interface to bind to for network connections.
# * session: The session belonging to this connection
# * context: The application context
# * hub: The application hub
# * logger: The application logger
# * address: The address of this connection
# * options: The options object supplied to the constructor
#
# Class properties:
# * defaultOptions: Default options for the constructor
class Connection extends BaseObject
  constructor: (parent, options)->
    assert.ok(typeof options is 'object', "Options must be given")

    options = _.extend({}, @constructor.defaultOptions, options)

    @ip           = options.ip
    @port         = Number(options.port)
    @ipVersion    = isIP(@ip)
    @type         = options.type
    @protocol     = options.protocol
    @context      = options.context
    @session      = options.session if options.session
    @hostname     = options.hostname if options.hostname
    @localAddress = options.localAddress if options.localAddress
    @options      = options

    assert.ok(@ipVersion, "Option `ip` must be a valid IP-address")
    assert.ok(@port and @port isnt NaN, "Option `port` must be a number")
    assert.ok(@protocol, "Option `protocol` must be given")
    assert.ok(@context, "Option `context` must be given")
    assert.ok(@type is "udp" or @type is "tcp", "Option `type` must be 'udp' or 'tcp'")

    @hub    = @context.get("hub")
    @logger = @context.get("logger")

    if @session
      assert.ok(@session instanceof Hub.Session, "Session must be an instance of Hub.Session")
      @session.addConnection(@)

    @address = url.format
      protocol: @protocol
      slashes:  true
      hostname: @ip
      port:     @port

    @on("error", @onError.bind(@))
    
    super(parent)

  # Dispose the connection.
  dispose: ->
    return if @disposed

    if @session
      @session.removeConnection(@)

    super

  onError: (error)->
    @logger.error(error)
    @logger.debug(error.stack)

module.exports = Connection
