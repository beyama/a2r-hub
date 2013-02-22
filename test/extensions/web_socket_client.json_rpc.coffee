should = require "should"

a2rHub = require "../../"

HttpServerExtension = a2rHub.extensions.HttpServerExtension

HttpServer      = HttpServerExtension.HttpServer
WebSocketClient = HttpServerExtension.WebSocketClient

TEST_PORT = 53456

describe "WebSocketClient", ->
  appContext = null
  client = null
  server = null
  jsonRPC = null

  before (done)->
    appContext = a2rHub.applicationContext()

    appContext.resolve ["connectionService", "jsonRPC"], (err, services)->
      return done(err) if err

      jsonRPC = services.jsonRPC
      connections = services.connectionService

      connections.registerServerHandler "http:", HttpServer
      connections.registerClientHandler "ws:", WebSocketClient

      connections.createServer "http://127.0.0.1:#{TEST_PORT}", (err, server)->
        return done(err) if err

        connections.createClient "ws://127.0.0.1:#{TEST_PORT}", (err, c)->
          return done(err) if err

          client = c
          done()

  after -> appContext.shutdown()

  it "should call a remote method and pass the result to the callback", (done)->
    client.on "error", done

    jsonRPC.expose "foo",(fn)-> fn(null, "bar")

    client.jsonRPC "foo", null, (err, result)->
      result.jsonrpc.should.be.equal "2.0"
      result.result.should.be.equal "bar"
      done(err)

