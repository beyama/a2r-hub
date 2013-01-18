hub    = require "../../"
should = require "should"

TcpServer = hub.net.TcpServer
TcpClient = hub.net.TcpClient

SERVER_ADDRESS = "tcp://127.0.0.1:9999"

describe "hub.net.TcpServer and hub.net.TcpClient", ->
  context = null
  server  = null
  connections = null

  beforeEach (done)->
    context = hub.applicationContext()

    context.resolve "connectionService", (err, service)->
      return done(err) if err

      service.registerServerHandler("tcp:", TcpServer)
      service.registerClientHandler("tcp:", TcpClient)
      connections = service

      service.createServer SERVER_ADDRESS, (err, srv)->
        return done(err) if err
        server = srv
        done()

  afterEach -> context.shutdown()

  describe "the server", ->

    describe ".onSocketConnection", ->

      it "should create a new TCP client", (done)->
        client = null

        server.on "client", (c)->
          address = client.socket.address()
          c.ip.should.be.equal address.address
          c.port.should.be.equal address.port
          c.should.be.instanceof TcpClient
          c.server.should.be.equal server
          done()

        client = connections.createClient SERVER_ADDRESS
        client.open (err)->
          return done(err) if err

    describe ".close", ->
      it "should close the socket", (done)->
        server.socket.on("close", done)
        server.socket.on("error", done)

        server.close()

  describe "the client", ->

    describe ".onSocketClose", ->
      it "should close the connection on socket close", (done)->
        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err
          c.on("close", done)
          c.socket.end()

    describe ".onSocketError", ->
      it "should emit `error` on socket error", (done)->
        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err

          error = new Error("Boom")
          c.on "error", (err)->
            err.should.be.equal error
            done()

          c.socket.emit("error", error)

    describe ".send", ->
      it "should send a complete buffer", (done)->
        buffer = new Buffer("Hello")

        server.on "client", (c)->
          c.socket.on "data", (d)->
            d.toString().should.be.equal buffer.toString()
            done()

        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err
          c.send(buffer, 0, buffer.length)

      it "should send a specific part of the buffer", (done)->
        buffer = new Buffer("Hello")

        server.on "client", (c)->
          c.socket.on "data", (d)->
            d.toString().should.be.equal "ll"
            done()

        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err
          c.send(buffer, 2, 2)

    describe ".close", ->

      it "should close the socket", (done)->
        connections.createClient SERVER_ADDRESS, (err, c)->
          return done(err) if err

          c.socket.on "close", ->
            done()
          c.close()
