assert = require "assert"
_ = require "underscore"

Node = require("./hub").Node

mixin = {}

for m in ["description", "arguments", "argument", "desc", "args", "arg"]
  do (m)->
    mixin[m] = ->
      @_descriptor ||= new NodeDescriptor(@)
      @_descriptor[m].apply(@_descriptor, arguments)

Node.mixin(mixin)

class NodeDescriptor

  constructor: (node)->
    @node = node
    @_arguments  = []
    @_argumentByName = {}

  description: (desc)->
    return @_description unless desc
    @_description = desc.toString()

  argument: (index, desc)->
    # if getter
    unless desc?
      return if typeof index is "string"
        @_argumentByName[index]
      else
        @_arguments[index]

    # else setter
    assert(index > -1, "Argument index must be non negativ value")
    assert(not @_arguments[index], "Argument is already defined")

    # clone desc
    desc = _.extend({}, desc)

    if desc.min and desc.max
      assert(desc.min < desc.max, "Descriptor min must be less than max")

    desc.index = index

    @_arguments[index] = desc

    if desc.name
      assert(not @_argumentByName[desc.name], "Argument name is already taken")
      @_argumentByName[desc.name] = desc
    @

  arguments: (descs)->
    for desc, i in descs
      @argument(i, desc)
    @

for name, alias of { argument: "arg", arguments: "args", description: "desc" }
  NodeDescriptor::[alias] = NodeDescriptor::[name]

module.exports = NodeDescriptor
