a2rHub    = require "../"
should = require "should"

class MockExtension extends a2rHub.Extension

  start: (callback)->
    @startCalled = true
    callback()

  stop: (callback)->
    @stopCalled = true
    callback()

module.exports = MockExtension

describe "a2rHub.ExtensionLoader", ->
  context = config = null

  beforeEach (done)->
    context = a2rHub.applicationContext()

    context.resolve "config", (err, c) ->
      return done(err) if err

      config = c
      done()

  afterEach -> context.shutdown()

  it "should load extensions by path", (done)->
    config.extensions = { MockExtension: { loadpath: __filename } }

    context.resolve "extensionLoader", (err, loader)->
      return done(err) if err

      mockExtension = loader.extensions.MockExtension

      mockExtension.should.be.instanceof MockExtension
      mockExtension.startCalled.should.be.true
      should.not.exist mockExtension.stopCalled

      done()

  it "should load extensions from default path", (done)->
    config.extensions.osc_udp_server = {}

    context.resolve "extensionLoader", (err, loader)->
      return done(err) if err

      loader.extensions.OscUdpServerExtension.should.be.instanceof a2rHub.net.ServerExtension
      done()

  it "should stop extensions on dispose", (done)->
    config.extensions = { MockExtension: { loadpath: __filename } }

    context.resolve "extensionLoader", (err, loader)->
      return done(err) if err

      mockExtension = loader.extensions.MockExtension

      context.shutdown ->
        mockExtension.stopCalled.should.be.true
        done()

  describe "events on hub", ->

    it "should emit all events in right order", (done)->
      config.extensions = { MockExtension: { loadpath: __filename } }

      hub = context.get("hub")

      called = 0

      hub.on "extension:start", (id, instance)->
        called++
        id.should.be.equal "MockExtension"
        instance.should.be.instanceof MockExtension
        should.not.exist instance.startCalled

      hub.on "extension:started", (id, instance)->
        called++
        id.should.be.equal "MockExtension"
        instance.should.be.instanceof MockExtension
        instance.startCalled.should.be.true

      hub.on "extension", (instance)->
        called++
        instance.should.be.instanceof MockExtension
        instance.startCalled.should.be.true

      hub.on "extensions", (extensions)->
        called++
        extensions.MockExtension.should.be.instanceof MockExtension

      context.resolve "extensionLoader", (err, loader)->
        return done(err) if err

        called.should.be.equal 4
        done()


    describe "with errors", ->
      origStart = null

      beforeEach -> origStart = MockExtension::start

      afterEach -> MockExtension::start = origStart

      it "should emit `extension:error` if an extension failed to start", (done)->
        error = new Error

        MockExtension::start = (callback)-> callback(error)

        config.extensions = { MockExtension: { loadpath: __filename } }

        hub = context.get("hub")

        hub.on "extension:error", (id, instance, e)->
          id.should.be.equal "MockExtension"
          instance.should.be.instanceof MockExtension
          e.should.be.equal error
          done()

        context.resolve "extensionLoader", (err, loader)->
          should.not.exist err

      it "should emit `extension:error` if an extension throws an error on start", (done)->
        error = new Error

        MockExtension::start = (callback)-> throw error

        config.extensions = { MockExtension: { loadpath: __filename } }

        hub = context.get("hub")

        hub.on "extension:error", (id, instance, e)->
          id.should.be.equal "MockExtension"
          instance.should.be.instanceof MockExtension
          e.should.be.equal error
          done()

        context.resolve "extensionLoader", (err, loader)->
          should.not.exist err
