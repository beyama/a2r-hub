BaseObject = require "./base_object"

address = require("./address")

_filterListAndDescendants = (list, pattern)->
  return unless list

  ret = null

  if pattern
    regexp = pattern instanceof RegExp

    for subpath in list
      if regexp
        if pattern.test(subpath.token)
          ret ||= []
          ret.push(subpath)
      else
        if pattern is subpath.token
          ret ||= []
          ret.push(subpath)

      children = _filterListAndDescendants(subpath.children, pattern)
      if children
        ret ||= []
        ret.push.apply(ret, children)
  else
    ret = list[..]
    for subpath in list
      children = _filterListAndDescendants(subpath.children)
      if children
        ret.push.apply(ret, children)
  ret

class Node extends BaseObject
  constructor: (parent, token, options)->
    if parent and not address.isValidToken(token)
      throw new Error("Invalid token `#{token}`")

    @token = token

    if parent
      @id = parent.root.nextId()
      @address = "#{parent.address}/#{@token}"
    else
      @address = ""

    super(parent)

    @configure(options) if options

  configure: (options)->
    for k, v of options
      if typeof @[k] is "function"
        @[k](v)
      else
        @[k] = v

  addChild: (child)->
    if child instanceof Node
      @childByToken ||= {}
      @childByToken[child.token] = child
      @root.registerAncestor(child)
      super(child)
    else
      super(child)

  removeChild: (child)->
    if (ret = super(child))
      if child instanceof Node
        delete @childByToken[child.token]
        @root.unregisterAncestor(child)
    return ret

  getChild: (token)->
    return unless @childByToken

    if token instanceof RegExp
      for t, child of @childByToken when token.test(t)
        child
    else
      @childByToken[token]

  createChild: (token, options)->
    @root._createNode(@, token, options)

  getOrCreateChild: (token, options)->
    if (node = @getChild(token))
      node.configure(options) if options
      return node
    @createChild(token, options)

Node::getChildren = Node::getChild

class Tree extends Node
  @Node = Node

  constructor: ->
    @_sequence     = 1
    @nodes         = []
    @nodeById      = {}
    @nodeByAddress = {}
    @nodesByToken  = {}
    super(null, "")

  # Factory method to create a new node instance
  _createNode: (parent, token, options)->
    new @constructor.Node(parent, token, options)

  # Get an ID which is unique in the scope of the tree
  nextId: -> @_sequence++

  registerAncestor: (node)->
    if @nodeById[node.id]
      throw new Error("Node with id `#{node.id}` already exist")
    if @nodeByAddress[node.address]
      throw new Error("Node with address `#{node.address}` already exist")

    # index ancestor node
    @nodes.push(node)
    @nodeById[node.id] = node
    @nodeByAddress[node.address] = node
    @nodesByToken[node.token] ||= []
    @nodesByToken[node.token].push(node)

    @emit("node", node)
    true

  unregisterAncestor: (node)->
    index = @nodes.indexOf(node)
    return false if index < 0

    # remove ancestor node from index
    @nodes.splice(index, 1)
    delete @nodeById[node.id]
    delete @nodeByAddress[node.address]

    if @nodesByToken[node.token].length is 1
      delete @nodesByToken[node.token]
    else
      index = @nodesByToken[node.token].indexOf(node)
      @nodesByToken[node.token].splice(index, 1) if index > -1

    true

  getNodeById: (id)-> @nodeById[id]

  getNodeByAddress: (address)-> @nodeByAddress[address]

  # Get all nodes by address pattern
  getNodesByPattern: (pattern)->
    tokens     = pattern.split("/")
    last       = @
    multilevel = false

    i = 1 # pattern split gives an empty string for the first '/'; we ignore it
    while i < tokens.length and last
      token = tokens[i++]

      if token.length is 0 # we've got an path-traversing pattern
        if tokens.length is i # pattern ends with '//'
          if last instanceof Node
            return last.children || []
          else
            children = []
            for node in last
              if node.children
                children.push.apply(children, node.children)
            return children
        else
          if last instanceof Node
            last = last.children
          multilevel = true
      else
        # compile token pattern if token is a pattern
        if (isPattern = address.isPattern(token))
          token = address.compileTokenPattern(token)

        if multilevel
          # this pattern starts with a '//'
          # so we can use the @tokenToSubpathes map
          if i is 3
            # test each subpath token
            if isPattern
              last = []
              for t, list of @nodesByToken when token.test(t)
                last.push.apply(last, list)
            # get list of subpathes by token
            else
              last = @nodesByToken[token]
            return [] unless last?.length
          else
            last = _filterListAndDescendants(last, token)
          multilevel = false
        else if Array.isArray(last)
          children = []
          for subpath in last
            if isPattern
              children.push.apply(children, subpath.getChild(token))
            else
              if (child = subpath.getChild(token))
                children.push(child)
          last = children
        else
          last = last.getChild(token)
    last

  getNode: (addressOrId)->
    if typeof addressOrId is 'number'
      @getNodeById(addressOrId)
    else if address.isValidPattern(addressOrId)
      @getNodesByPattern(addressOrId)
    else
      @getNodeByAddress(addressOrId)

  createNode: (addr, options)->
    if not address.isValidAddress(addr)
      throw new Error("Invalid address `#{addr}`")

    if @getNodeByAddress(addr)
      throw new Error("Node `#{addr}` already exist")

    tokens = addr[1..-1].split("/")

    if tokens.length is 1
      return @createChild(tokens[0], options)
    else
      node = @getOrCreateChild(tokens[0])

    i = 1
    l = tokens.length
    while i < l
      token = tokens[i++]
      if i is l
        node = node.createChild(token, options)
      else
        node = node.getOrCreateChild(token)
    node

  getOrCreateNode: (address, options)->
    if (node = @getNodeByAddress(address))
      node.configure(options) if options
      return node
    @createNode(address)

Tree::getNodes = Tree::getNode

module.exports = Tree
