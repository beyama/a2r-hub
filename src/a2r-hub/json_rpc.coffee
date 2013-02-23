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

  # Parse JSON data and check format
  parse: (json)->
    if typeof json is "string"
      try
        json = JSON.parse(json)
      catch e
        throw new ParseError("Invalid JSON data")

    # jsonrpc version must be given and must be "2.0"
    if json.jsonrpc isnt "2.0"
      throw new ParseError("Field 'jsonrpc' must be '2.0'")

    result = json.result?
    error  = json.error?

    # either result or error but not both
    if result and error
      throw new ParseError("Either 'result' or 'error' must be given (but not both)")

    # result object
    if result or error
      # id must be given at least with a value of null
      if json.id is undefined
        throw new ParseError("Result must contain an ID")
      # error code must be given if error is present
      if error and not json.error.code?
        throw new ParseError("Error must contain an error code")
    # request object
    else if json.method
      # method must be a string
      if typeof json.method isnt "string"
        throw new ParseError("Method must be a string")
    # neither result nor request
    else
      throw new ParseError("JSON object is neither a request nor a result")

    json

  handleResponse: (message)->
    try
      if (id = message.id)? && (handler = @requests[id])
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

  # Handle an error.
  #
  # Build an error response object and send it back.
  handleError: (response, error)->
    response ||= jsonrpc: "2.0", id: null

    if error instanceof RPCError
      response.error = { code: error.code, message: error.message }
      response.error.data = error.data if error.data?
    else if error instanceof Error
      response.error = { code: -32603, message: error.message }
    else
      response.error = { code: -32603, message: String(error) }

    @connection.sendJSON(response)

  # Handle a message.
  handle: (json)->
    response = null

    # if true no response is send back
    isNotification = false

    try
      # parse JSON; this will throw a ParseError if something goes wrong
      message = @parse(json)

      # if response message
      if message.result? || message.error?
        return @handleResponse(message)
      # else request message
      else
        # no response if id is undefined or null
        isNotification = not message.id?

        unless isNotification
          response = jsonrpc: "2.0", id: message.id

        # get method; this will throw a MethodNotFoundError if method isn't found
        method = @parent.getMethod(message.method)

        # don't call the callback twice
        called = false

        # RPC method callback
        callback = (error, result)=>
          return if called

          called = true

          unless isNotification
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
      # ignore the error if this message is a notification
      return if isNotification
      # else
      return @handleError(response, e)

  # Call a remote method.
  #
  # e.g:
  # call(method, parmas, [timeout], [callback])
  #
  # Arguments:
  # * method: The remote method name.
  # * params: A value, an object of values or an array of values.
  # * timeout: Timeout in ms.
  # * callback: A callback function with signature 'void fn(error, result)'.
  #
  # if only method and params is given
  # then this will send a notification without waiting
  # for an response.
  #
  # If called with timeout but without callback then
  # the result or error will be emitted on this.
  #
  # if callback given then the callback will be called with
  # an error as first argument or the result as second argument.
  call: (method, params, timeout, callback)->
    id = null

    # set params to null if undefined
    if params is undefined
      params = null
    # wrap params in an array if params isn't a type of object
    else if params isnt null and typeof params isnt "object"
      params = [params]

    # not timeout given but a callback
    if typeof timeout is "function"
      callback = timeout
      timeout  = null

    # set default timeout of 10sek
    if callback and not timeout
      timeout = 10000

    # create a default callback that emits results or errors on this
    if timeout and not callback
      callback = (error, result)=>
        if error
          @emit("error", error)
        else
          @emit("result", result)

    if callback
      # generate a new request id
      id = @requestId++

      # register timeout handler
      timeout = Number(timeout)

      if timeout is NaN or timeout < 1
        throw new RangeError("Timeout must be a non-negativ integer greater than 0")

      setTimeout =>
        if (handler = @requests[id])
          delete @requests[id]

          handler(new TimeoutError(timeout))
      , timeout

      # register callback for this request
      @requests[id] = callback

    # send request message
    request = { jsonrpc: "2.0", method: method, params: params }
    request.id = id if id isnt null
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
  # method of the object will be exposed
  # prefixed with the string plus a dot.
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
