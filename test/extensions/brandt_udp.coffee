should = require "should"

dgram = require "dgram"

a2rHub = require "../../"
osc = a2rHub.Hub.osc

SERVER_TEST_PORT = 53456
TEST_ADDRESS = "udp+brandt://127.0.0.1:#{SERVER_TEST_PORT}"

BrandtUdpServerExtension = a2rHub.extensions.BrandtUdpServerExtension
BrandtUdpServer = BrandtUdpServerExtension.serverClass
BrandtUdpClient = BrandtUdpServerExtension.clientClass

describe "Brandt UDP connector", ->
  appContext = null
  client     = null
  server     = null
  hub        = null
  session    = null
  jamService = null

  beforeEach (done)->
    appContext = a2rHub.applicationContext()

    hub = appContext.get("hub")

    session = hub.createSession()

    appContext.resolve ["connectionService", "jamService"], (err, services)->
      return done(err) if err

      connections = services.connectionService
      jamService = services.jamService

      connections.registerServerHandler "udp+brandt:", BrandtUdpServer
      connections.registerClientHandler "udp+brandt:", BrandtUdpClient

      connections.createServer TEST_ADDRESS, (err, s)->
        return done(err) if err

        server = s

        connections.createClient TEST_ADDRESS, (err, c)->
          return done(err) if err

          client = c
          done()

  afterEach -> appContext.shutdown()

  describe "commands", ->
    describe "patch", ->

      it "should create a new jam with name of patch", (done)->
        hub.on "jam", (jam)->
          jam.name.should.be.equal "mima"
          done()

        client.sendFUDI(["patch", "mima"])

      it "should dispose a jam previously created by the client", (done)->
        hub.once "jam", (jam)->
          jam.on "dispose", ->
            done()
          client.sendFUDI(["patch", "mima"])

        client.sendFUDI(["patch", "mima"])

      it "should join an existing jam", (done)->
        jam = jamService.createJam(session, "mima")
        jam.participants.should.have.length 0
        client.sendFUDI(["patch", "mima"])
        setTimeout ->
          jam.participants.should.have.length 1
          done()
        , 10

      it "should leave a jam and join a another one", (done)->
        jamService.createJam(session, "clicks_and_cuts")
        jamService.createJam(session, "mima")

        client.sendFUDI(["patch", "clicks_and_cuts"])
        client.sendFUDI(["patch", "mima"])

        setTimeout ->
          jamService.getJam("clicks_and_cuts").participants.should.have.length 0
          jamService.getJam("mima").participants.should.have.length 1
          done()
        , 10

    describe "add", ->
      beforeEach -> client.sendFUDI(["patch", "mima"])

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

        client.sendFUDI(["add", "1-goasolo_adsr", "iiii"])

    describe "stream", ->
      it "should set stream address on jam", (done)->
        stream = "http://test.com/stream.ogg"
        client.sendFUDI(["patch", "mima"])
        client.sendFUDI(["stream", stream])

        setTimeout ->
          jamService.getJam("mima").stream.should.be.equal stream
          done()
        , 10

  describe "client", ->
    describe ".sendOSC", ->
      
      it "should transform a message to FUDI and send it to PD", (done)->
        client.on "message", (message)->
          message.toString().should.be.equal "goasolo_adsr 1 2 3 4;\n"
          done()

        hub.nodeObserver.on "/mima/goasolo/adsr", "create", (node)->
          # Give it time to register its handler
          process.nextTick ->
            # send message
            message = new osc.Message(node.address, [1, 2, 3, 4])
            # the node chain created by the Brandt connector has a session lock
            # so we need a sender so that the message gets forwarded
            message.from = session
            hub.send(message)

        # create jam `mima`
        client.sendFUDI(["patch", "mima"])
        # create node `/mima/goasolo/adsr`
        client.sendFUDI(["add", "goasolo_adsr", "iiii"])
