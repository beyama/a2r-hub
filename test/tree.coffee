should = require "should"
Tree = require("../").Tree

describe "Tree", ->
  tree = null

  beforeEach -> tree = new Tree()

  describe "._createNode factory function", ->

    it "should use class set on this.constructor.Node", ->
      class MyNode extends Tree.Node
      class MyTree extends Tree
        @Node = MyNode

      tree = new MyTree
      node = tree.createNode("/a2r")
      node.should.instanceof MyNode

  describe ".createNode", ->

    it "should create a new node with given address and emit 'node' with node as argument", ->
      called = false

      tree.on "node", (node)->
        node.should.be.instanceof Tree.Node
        called = true

      node = tree.createNode("/a2r")
      node.root.should.be.equal tree
      node.parent.should.be.equal tree
      node.address.should.be.equal "/a2r"
      node.token.should.be.equal "a2r"
      called.should.be.true

    it "should use factory function _createNode of tree to create a new node instance", ->
      called = false
      tree._createNode = ->
        called = true
        Tree::_createNode.apply(tree, arguments)

      tree.createNode("/a2r")

      called.should.be.true

    it "should throw an error if address is already taken", ->
      tree.createNode("/a2r")
      (-> tree.createNode("/a2r") ).should.throw()

  describe ".getNodesByPattern", ->
    beforeEach ->
      for i in [0..9]
        for j in [0..9]
          tree.createNode("/a2r/#{i}/control/#{j}")

    it "should get nodes by character-set pattern", ->
      nodes = tree.getNodesByPattern("/a2r/1/control/[0-4]")
      nodes.should.have.length 5

      for node, i in nodes
        node.address.should.be.equal "/a2r/1/control/#{i}"

    it "should get nodes by negated character-set pattern", ->
      nodes = tree.getNodesByPattern("/a2r/1/control/[!0-4]")
      nodes.should.have.length 5

      for node, i in nodes
        node.address.should.be.equal "/a2r/1/control/#{i+5}"

    it "should get nodes by string list pattern", ->
      nodes = tree.getNodesByPattern("/a2r/{0,2,4}/control/0")
      nodes.should.have.length 3

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{i*2}/control/0"

    it "should get nodes by single-character pattern", ->
      nodes = tree.getNodesByPattern("/a2r/?/control/0")
      nodes.should.have.length 10

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{i}/control/0"

      nodes = tree.getNodesByPattern("/a2r/0/con?rol/0")
      nodes.should.have.length 1
      nodes[0].address.should.equal "/a2r/0/control/0"

    it "should get nodes by character-sequenze pattern", ->
      nodes = tree.getNodesByPattern("/a2r/1/con*/4")
      nodes.should.have.length 1
      nodes[0].address.should.equal "/a2r/1/control/4"

    it "should get nodes by path-traversing pattern", ->
      nodes = tree.getNodesByPattern("//control/1")
      nodes.should.have.length 10

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{i}/control/1"

      nodes = tree.getNodesByPattern("/a2r//control/1")
      nodes.should.have.length 10

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{i}/control/1"

      nodes = tree.getNodesByPattern("/a2r//control//")
      nodes.should.have.length 100

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{Math.floor(i/10)}/control/#{i % 10}"

    it "should get nodes by path-traversing wildcard and character pattern", ->
      nodes = tree.getNodesByPattern("//{control,slider}/1")
      nodes.should.have.length 10

      for node, i in nodes
        node.address.should.be.equal "/a2r/#{i}/control/1"

describe "Tree.Node", ->
  tree = null
  node = null

  beforeEach ->
    tree = new Tree()
    node = tree.createNode("/a2r")

  describe ".configure", ->

    it "should copy values to node", ->
      node.configure { foo: "bar", bar: "baz" }
      node.foo.should.be.equal "bar"
      node.bar.should.be.equal "baz"

    it "should call node method with option value if option name is the name of a node method", ->
      node.foo = (value)->
        @_foo = value

      node.configure(foo: "bar")
      node._foo.should.be.equal "bar"

  describe ".createChild", ->

    it "should create a new child node", ->
      child = node.createChild("osc")
      child.should.be.instanceof Tree.Node

      child.parent.should.be.equal node
      child.root.should.be.equal tree
      child.address.should.be.equal "/a2r/osc"

    it "should throw an error if child name already exist", ->
      node.createChild("osc")
      (-> node.createChild("osc") ).should.throw()

    it "should pass configure options to the node constructor", ->
      child = node.createChild("osc", foo: "bar")
      child.foo.should.be.equal "bar"

  describe ".getOrCreateChild", ->

    it "should create child if child doesn't exist", ->
      child = node.getOrCreateChild("osc")
      child.address.should.be.equal "/a2r/osc"

    it "should pass configure options to new child node", ->
      child = node.getOrCreateChild("osc", foo: "bar")
      child.foo.should.be.equal "bar"

    it "should return child if child already exist", ->
      child = node.createChild("osc")
      node.getOrCreateChild("osc").should.be.equal child

    it "should call configure on already existing node if called with options", ->
      child = node.createChild("osc")
      node.getOrCreateChild("osc", foo: "bar")
      child.foo.should.be.equal "bar"

  describe ".dispose", ->
 
    it "should unregister node from tree", ->
      node.dispose()
      tree.nodes.should.have.length 0
 
    it "should emit 'dispose' with node as first argument", ->
      called = false
 
      fn = (n)->
        n.should.be.instanceof Tree.Node
        called = true
 
      node.on "dispose", fn
 
      node.dispose()
      called.should.be.true
 
    it "should remove all event listener", ->
      node.on "error", ->
      node.dispose()
      node.listeners("error").should.have.length 0
