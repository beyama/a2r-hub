should = require "should"

osc    = require "a2r-osc"
a2rHub = require("../")

EventEmitter = require("events").EventEmitter

JSONRPC = a2rHub.JSONRPC

class MockConnection extends EventEmitter
  constructor: (rpc)->
    @client = new JSONRPC.RPCClient(rpc, @)
    @client.on("error", (e)=> @emit("error", e))
    @client.on("result", (e)=> @emit("result", e))

  jsonRPC: -> @client.call.apply(@client, arguments)

  sendJSON: (json)->
    process.nextTick =>
      @client.handle(JSON.stringify(json))

describe "JSONRPC", ->
  client = rpc = null

  beforeEach ->
    rpc = new JSONRPC
    client = new MockConnection(rpc)

  describe ".expose", ->

    it "should expose a method", ->
      func1 = ->
      func2 = ->

      rpc.expose "func1", func1
      rpc.expose "func2", func2

      rpc.methods.func1.should.be.equal func1
      rpc.methods.func2.should.be.equal func2

    it "should expose an object of methods", ->
      func1 = ->
      func2 = ->

      rpc.expose { func1: func1, func2: func2 }

      rpc.methods.func1.should.be.equal func1
      rpc.methods.func2.should.be.equal func2

    it "should expose an object of methods with a prefix", ->
      func1 = ->
      func2 = ->

      rpc.expose "prefix", { func1: func1, func2: func2 }

      rpc.methods["prefix.func1"].should.be.equal func1
      rpc.methods["prefix.func2"].should.be.equal func2

  describe ".getMethod", ->
    it "should return a method by name", ->
      func1 = ->
      func2 = ->

      rpc.expose "prefix", { func1: func1, func2: func2 }
      rpc.expose "func1", func1

      rpc.getMethod("func1").should.be.equal func1
      rpc.getMethod("prefix.func1").should.be.equal func1
      rpc.getMethod("prefix.func2").should.be.equal func2

    it "should throw a JSONRPC.MethodNotFoundError if method isn't found", ->
      (-> rpc.getMethod("method") ).should.throw(JSONRPC.MethodNotFoundError)

  describe "RPCClient", ->

    describe ".call and .handle", ->

      it "should emit `error` with a ParseError if called with invalid data", (done)->
        client.on "error", (error)->
          should.not.exist error.id
          error.error.code.should.be.equal -32700
          error.error.message.should.be.equal "Parse error"
          done()

        client.client.handle("{ boom }")

      it "should emit result on client if no callback is given", (done)->
        client.on "error", done

        rpc.expose "version", (fn)->
          fn(null, "0.0.1")

        client.on "result", (res)->
          res.jsonrpc.should.be.equal "2.0"
          res.result.should.be.equal "0.0.1"
          done()

        client.jsonRPC "version"

      it "should call a RPC method and send the result back to the client", (done)->
        client.on "error", done

        rpc.expose "version", (fn)->
          fn(null, "0.0.1")

        client.jsonRPC "version", null, (err, res)->
          should.not.exist err

          res.jsonrpc.should.be.equal "2.0"
          res.result.should.be.equal "0.0.1"
          done()

      it "should call a RPC method with an argument and send the result back to the client", (done)->
        client.on "error", done

        rpc.expose "powerOfTwo", (e, fn)-> fn(null, Math.pow(2, e))

        client.jsonRPC "powerOfTwo", 8, (err, res)->
          should.not.exist err

          res.jsonrpc.should.be.equal "2.0"
          res.result.should.be.equal 256
          done()

      it "should call a RPC method with arguments and send the result back to the client", (done)->
        client.on "error", done

        rpc.expose "pow", (b, e, fn)-> fn(null, Math.pow(b, e))

        client.jsonRPC "pow", [2, 2], (err, res)->
          should.not.exist err

          res.jsonrpc.should.be.equal "2.0"
          res.result.should.be.equal 4
          done()

      it "should return a method not found error if method wasn't found", (done)->
        client.on "error", done

        client.jsonRPC "foo", null, (err, res)->
          should.not.exist res

          err.jsonrpc.should.be.equal "2.0"
          error = err.error
          error.message.should.be.equal "Method not found"
          error.code.should.be.equal -32601
          error.data.should.be.equal "foo"
          done()

      it "should return a TimeroutError if response takes to long", (done)->
        client.on "error", done

        rpc.expose "longRunningFunction", (fn)->
          setTimeout ->
            fn(null, "finished")
          , 5

        client.jsonRPC "longRunningFunction", null, 3, (error, result)->
          should.not.exist result

          error.should.be.instanceof JSONRPC.TimeoutError
          error.message.should.be.equal "Request timeout"
          error.code.should.be.equal 1
          error.data.should.be.equal 3
          Object.keys(client.client.requests).should.have.length 0
          done()
