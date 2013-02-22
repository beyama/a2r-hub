BaseObject = require "./base_object"

# Base class of all RPC error classes.
class RPCError extends Error
  constructor: (message, code=-32603, data)->
    super
    @message = message || "Internal error"
    @code = code
    @data = data

# Error class thrown by JSON parser errors.
class ParseError extends RPCError
  constructor: (data)->
    super("Parse error", -32700, data)

# Error class thrown on request timeouts.
# Data should be the timeout time.
class TimeoutError extends RPCError
  constructor: (data)->
    super("Request timeout", 1, data)

class InvalidRequestError extends RPCError
  constructor: (data)->
    super("Invalid Request", -32600, data)

# Thrown if a requested method isn't found.
class MethodNotFoundError extends RPCError
  constructor: (data)->
    super("Method not found", -32601, data)

# Should be thrown by RPC methods called with
# invalid arguments.
class InvalidParamsError extends RPCError
  constructor: (data)->
    super("Invalid params", -32602, data)

class RPCClient extends BaseObject
  constructor: (rpc, connection)->
    unless rpc instanceof JSONRPC
      throw new Error("First argument must be an instance of a2rHub.JSONRPC")

    @connection = connection
    @hub        = @connection.hub
    @context    = @connection.context
    @logger     = @connection.logger
    @requests   = {}
    @requestId  = 1

    super(rpc)

  parse: (json)->
    try
      JSON.parse(json)
    catch e
      throw new ParseError

  handleResponse: (message)->
    try
      if (id = message.id) && (handler = @requests[id])
        delete @requests[id]

        if message.error
          handler(message)
        else
          handler(null, message)
      else
        if message.error
          @emit("error", message)
        else
          @emit("result", message)
    catch e
      @emit("error", e)

  handleError: (response, error)->
    response ||= jsonrpc: "2.0", id: null

    if error instanceof RPCError
      response.error = { code: error.code, message: error.message }
      response.error.data = error.data if error.data?
    else if error instanceof Error
      response.error = { code: -32603, message: error.message }
    else
      response.error = { code: -32603, message: error }

    @connection.sendJSON(response)

  handle: (json)->
    response = null

    try
      # parse JSON; this will throw a ParseError if something goes wrong
      message = @parse(json)

      # if response message
      if message.result || message.error
        return @handleResponse(message)
      # else request message
      else
        response = jsonrpc: "2.0", id: message.id

        # get method; this will throw a MethodNotFoundError if method isn't found
        method = @parent.getMethod(message.method)

        # don't call the callback twice
        called = false

        # RPC method callback
        callback = (error, result)=>
          return if called

          called = true

          if error
            @handleError(response, error)
          else
            response.result = result
            @connection.sendJSON(response)

        params = message.params

        # call the RPC method and pass the callback in
        if Array.isArray(params) and method.length > 2
          params.push(callback)
          method.apply(@, params)
        else
          if method.length > 1
            method.call(@, params, callback)
          else
            method.call(@, callback)
    # catch ParseError, MethodNotFoundError or errors thrown by handleResponse
    catch e
      return @handleError(response, e)

  # call a remote method
  call: (method, params, timeout, callback)->
    # generate a new request id
    id = @requestId++

    if typeof timeout is "function"
      callback = timeout
      timeout  = null

    # register timeout handler
    if timeout
      timeout = Number(timeout)

      if timeout is NaN or timeout < 1
        throw new RangeError("Timeout must be a non-negativ integer greater than 0")

      setTimeout =>
        if (handler = @requests[id])
          delete @requests[id]

          handler(new TimeoutError(timeout))
      , timeout
          

    # create a default callback that emits results or errors on this
    callback ||= (error, result)=>
      if error
        @emit("error", error)
      else
        @emit("result", result)

    # register callback for this request
    @requests[id] = callback

    # send request message
    request = { jsonrpc: "2.0", id: id, method: method, params: params }
    @connection.sendJSON(request)

# JSON RPC handler class
class JSONRPC extends BaseObject
  @RPCClient = RPCClient

  @RPCError   = RPCError
  @ParseError = ParseError
  @InvalidRequestError = InvalidRequestError
  @MethodNotFoundError = MethodNotFoundError
  @InvalidParamsError  = InvalidParamsError
  @TimeoutError        = TimeoutError

  constructor: ->
    super()
    @methods = {}

  createClient: (connection)-> new RPCClient(@, connection)

  # Expose a method or an object
  # of methods.
  #
  # if the first argument is a string
  # and the second is an object then each
  # method of the object will be registered
  # prefixed with string plus a dot.
  #
  # e.g.:
  # rpc.expose "name", (arg)-> ...
  # rpc.expose "moduleName", fn1: ->, ...
  # rpc.expose fn1: ->, ...
  expose: (mod, obj)->
    if typeof mod is "object"
      obj = mod
      mod = ""
    else if typeof obj is "function"
      @methods[mod] = obj
      return
    else
      mod += "."

    for name, method of obj when typeof method is "function"
      @methods["#{mod}#{name}"] = method

    return

  # Get a exposed method by name.
  #
  # This method will throw an `MethodNotFoundError` if the
  # method isn't found.
  getMethod: (name)->
    @methods[name] || throw new MethodNotFoundError(name)

module.exports = JSONRPC
