hub    = require "../../"
should = require "should"

UdpServer = hub.net.UdpServer
UdpClient = hub.net.UdpClient

SERVER_ADDRESS = "udp://127.0.0.1:9999"

describe "hub.net.UdpServer and hub.net.UdpClient", ->
  context = null
  server  = null
  connections = null

  beforeEach (done)->
    context = hub.applicationContext()

    context.resolve "connectionService", (err, service)->
      return done(err) if err

      service.registerServerHandler("udp:", UdpServer)
      service.registerClientHandler("udp:", UdpClient)
      connections = service

      service.createServer SERVER_ADDRESS, (err, srv)->
        return done(err) if err
        server = srv
        done()

  afterEach -> context.shutdown()

  describe "the server", ->

    describe "onSocketMessage", ->

      it "should create a new UDP client for a message from a new source", (done)->
        client = null

        server.on "client", (c)->
          c.port.should.be.equal client.socket.address().port
          c.should.be.instanceof UdpClient
          c.server.should.be.equal server
          done()

        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err

          client = c
          buffer = new Buffer("Hello")
          c.send(buffer, 0, buffer.length)

      it "should emit `message` with the received data on the client", (done)->
        buffer = new Buffer("hello")

        server.on "client", (c)->
          c.on "message", (data)->
            data.should.have.length buffer.length

            i = 0
            while i < data.length
              buffer[i].should.be.equal data[i]
              i++
            done()

        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err
          c.send(buffer, 0, buffer.length)

    describe "close", ->
      it "should close the socket", (done)->
        server.socket.on("close", done)
        server.socket.on("error", done)

        server.close()

  describe "the client", ->

    describe "close", ->

      it "should close the socket if it isn't a server client", (done)->
        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err

          c.socket.on("close", done)
          c.close()
