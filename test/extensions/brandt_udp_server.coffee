should = require "should"

dgram = require "dgram"

a2rHub = require "../../"
osc = a2rHub.Hub.osc

SERVER_TEST_PORT = 53456
CLIENT_TEST_PORT = 53457

BrandtUdpServerExtension = a2rHub.extensions.BrandtUdpServerExtension
BrandtUdpServer = BrandtUdpServerExtension.serverClass

describe "BrandtUdpServer", ->
  appContext = null
  client = null
  server = null
  hub = null
  jamService = null

  send = (data)->
    data = a2rHub.fudi.generateFUDI(data) if Array.isArray(data)
    data = new Buffer(data) if typeof data is "string"
    client.send(data, 0, data.length, SERVER_TEST_PORT, "127.0.0.1")

  before (done)->
    appContext = a2rHub.applicationContext()

    hub = appContext.get("hub")

    appContext.resolve ["connectionService", "jamService"], (err, services)->
      return done(err) if err

      connections = services.connectionService
      jamService = services.jamService

      connections.registerServerHandler "udp+brandt:", BrandtUdpServer

      connections.createServer "udp+brandt://127.0.0.1:#{SERVER_TEST_PORT}", (err, server)->
        return done(err) if err

        client = dgram.createSocket("udp4")
        client.bind(CLIENT_TEST_PORT, "127.0.0.1")
        done()

  after ->
    appContext.shutdown()
    client.close()

  describe "command", ->
    describe "patch", ->
      it "should create a new jam with name of patch", (done)->
        hub.once "jam", (jam)->
          jam.name.should.be.equal "mima"
          done()

        send(["patch", "mima"])

      it "should dispose a previously created jam", (done)->
        hub.once "jam", (jam)->
          jam.on "dispose", ->
            done()
          send(["patch", "mima"])

        send(["patch", "mima"])

    describe "add", ->
      beforeEach -> send("patch", "mima")

      it "should create an OSC node", (done)->
        hub.nodeObserver.once "/mima/1/goasolo/adsr", "create", (node)->
          args = node.args()

          args.should.have.length 4

          for i in [0..3]
            args[i].type.should.be.equal "integer"
            args[i].minimum.should.be.equal 0
            args[i].maximum.should.be.equal 127
            args[i].step.should.be.equal 1

          done()

        send(["add", "1-goasolo_adsr", "iiii"])

      it "should connect `message` event of created node with a message to FUDI transformer", (done)->
        client.once "message", (msg, rinfo)->
          msg = msg.toString()
          msg.should.be.equal "1-goasolo_adsr 1 2 3 4;\n"
          done()

        send(["add", "1-goasolo_adsr", "iiii"])
        message = new osc.Message("/mima/1/goasolo/adsr", [1, 2, 3, 4])
        hub.send(message)

    describe "stream", ->
      it "should set stream address on jam", (done)->
        stream = "http://test.com/stream.ogg"
        send(["stream", stream])
        setTimeout ->
          jamService.jams.mima.stream.should.be.equal stream
          done()
        , 10
