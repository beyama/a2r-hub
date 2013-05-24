should = require "should"

a2rHub = require "../"

HttpServerExtension = a2rHub.extensions.HttpServerExtension

HttpServer      = HttpServerExtension.HttpServer
WebSocketClient = HttpServerExtension.WebSocketClient

TEST_PORT = 53456

describe "JamService", ->
  appContext = null
  session    = null
  client     = null
  server     = null
  jamService = null
  hub        = null

  beforeEach (done)->
    appContext = a2rHub.applicationContext()

    hub = appContext.get("hub")

    session = hub.createSession()

    appContext.resolve ["connectionService", "jamService"], (err, services)->
      return done(err) if err

      jamService = services.jamService
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

  describe "JSON-RPC 2 methods", ->

    describe "jams.getAll", ->
      it "should return a list of available jams", (done)->

        jamService.createJam(session, "mima", "Mima", "Dubstep by Mima")

        client.rpcClient.on("error", done)

        client.jsonRPC "jams.getAll", null, (err, res)->
          jams = res.result
          jams.should.have.length 1
          jam = jams[0]

          jam.id.should.be.equal "mima"
          jam.title.should.be.equal "Mima"
          jam.description.should.be.equal "Dubstep by Mima"
          done()
