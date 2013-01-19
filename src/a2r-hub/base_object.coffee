EventEmitter = require("events").EventEmitter

class BaseObject extends EventEmitter

  constructor: (parent)->
    if parent
      @parent = parent

    # set root object
    @root = @_root()

    if @parent
      # add to parent
      @parent.addChild(@)

  _root: ->
    return @ unless @parent

    parent = @parent
    while parent.parent
      parent = parent.parent
    parent

  addChild: (child)->
    if not (child instanceof BaseObject)
      throw new Error("Child must be an instance of BaseObject")

    unless @children
      @children = [child]
    else
      @children.push(child)

    @emit("child", child)

  removeChild: (child)->
    return false unless @children

    index = @children.indexOf(child)
    return false if index < 0

    @children.splice(index, 1)
    true

  # Dispose each child and unregister this from parent
  dispose: (removeFromParent=true)->
    return if @disposed

    @disposed = true

    if @children
      child.dispose(false) for child in @children
      delete @children

    if @parent and removeFromParent
      @parent.removeChild(@)

    @emit("dispose", @)
    @removeAllListeners()

module.exports = BaseObject
