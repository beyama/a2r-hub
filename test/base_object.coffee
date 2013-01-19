should = require "should"

hub = require "../"

BaseObject = hub.BaseObject

describe "hub.BaseObject", ->

  obj = null

  beforeEach -> obj = new BaseObject

  describe ".constructor", ->

    it "should register `this` on parent if parent is given", ->
      o = new BaseObject(obj)
      obj.children.should.include(o)
      o.parent.should.be.equal obj

    it "should set `this.root` to the ancestor without parent", ->
      obj.root.should.be.equal obj

      o = new BaseObject(obj)
      o.root.should.be.equal obj

      o = new BaseObject(o)
      o.root.should.be.equal obj

  describe ".addChild", ->

    it "should emit `child`", ->
      child = null

      obj.on "child", (c)->
        child = c

      o = new BaseObject(obj)
      child.should.be.equal o

  describe ".removeChild", ->

    it "should unregister child", ->
      o = new BaseObject(obj)
      obj.removeChild(o).should.be.true
      obj.children.should.not.include(o)

    it "should return false if child doesn't exist", ->
      o = new BaseObject()
      obj.removeChild(o).should.be.false

  describe ".dispose", ->

    it "should emit `dispose` event", (done)->
      obj.on "dispose", (o)->
        o.should.be.equal obj
        done()

      obj.dispose()

    it "should remove all listeners", ->
      obj.on "error", ->
      obj.listeners("error").should.have.length 1
      obj.dispose()
      obj.listeners("error").should.have.length 0

