_ = require "underscore"

Hub = require "./hub"

class Layout
  Object.defineProperty(@::, "id", get: -> @name)
  Object.defineProperty(@::, "name", get: -> @attrs.name)
  Object.defineProperty(@::, "title", get: -> @attrs.title)
  Object.defineProperty(@::, "description", get: -> @attrs.description)

  # Create a builder method for an element class.
  @registerElement: (name, klass)->
    Group::[name] = (attrs)->
      element = new klass(@, attrs)
      @add(element)
      element

    RowBuilder::[name] = (attrs)->
      element = new klass(@group, attrs)
      @add(element)
      element

  constructor: (attrs)->
    @attrs = _.extend({}, attrs)

    if typeof @attrs.name isnt "string"
      throw new Error("Name must be a string")
    
    @attrs.title ||= @attrs.name
    @sections = []

  
  # Add a section to the layout.
  addSection: (attrs)->
    section = new Section(@, attrs)
    @sections.push(section)
    section

  toJSON: ->
    json = _.extend({}, @attrs)
    json.sections = for section in @sections
      section.toJSON()
    nodes = []
    for s in @sections
      for e in s.elements when e.outs?.length
        for o in e.outs when nodes.indexOf(o.node) is -1
          nodes.push(o.node)
    json.routes = []
    for node in nodes
      json.routes.push(address: node.address, signature: node.args())
    json

Layout::section = Layout::addSection

# Helper class to add elements in a row.
class RowBuilder
  constructor: (group, x, y)->
    unless group instanceof Group
      throw new Error("group must be an instance of Layout.Group")

    @group = group
    @x = Number(x)
    @startX = x
    @y = Number(y)
    @startY = y
    @height = 1

    if isNaN(@x) or @x < 0 or isNaN(@y) or @y < 0
      throw new Error("x and y must be non-negative numbers")

  add: (element)->
    attrs = element.attrs

    attrs.x = @x
    attrs.y = @y

    attrs.cols ||= 1
    attrs.rows ||= 1

    if attrs.rows > @height
      @height = attrs.rows

    @x = @x + attrs.cols
    @group.add(element)
    @

  next: -> new RowBuilder(@group, @startX, @startY + @height)

# Abstract class to group elements.
class Group
  constructor: (parent, x, y)->
    @parent = parent
    @x = x
    @y = y
    @elements = []

  row: (x, y)-> new RowBuilder(@, @x + x, @y + y)

  add: (element)->
    attrs = element.attrs
    if attrs.x then attrs.x + @x else attrs.x = @x
    if attrs.y then attrs.y + @y else attrs.y = @y

    # TODO: check overlap

    @elements.push(element)
    @

  toJSON: ->
    for elem in @elements
      elem.toJSON()

  up: -> @parent

# A section in a layout.
#
# This will usualy be shown as one tab in a GUI.
class Section extends Group
  constructor: (layout, attrs)->
    super(layout, 0, 0)

    @attrs = _.extend({}, attrs)

    if typeof @attrs.name isnt "string"
      throw new Error("Name must be a string")
    
    @attrs.title ||= @attrs.name

  toJSON: ->
    json = _.extend({}, @attrs)
    json.elements = super
    json

class Out
  constructor: (element, node, map)->
    @element = element
    @node    = node
    @map     = map

# Abstract representation of an GUI widget (element) in the
# Layout/Section grid.
class Element
  constructor: (group, attrs)->
    unless group instanceof Group
      throw new Error("group must be an instance of Layout.Group")

    @group = group
    @attrs = if attrs then _.extend({}, attrs) else {}

  map: (node, map)->
    if not (node instanceof Hub.Node)
      throw new Error("First argument must be an instance of Hub.Node")
    @outs ||= []
    @outs.push(new Out(@, node, map))
    @

  toJSON: ->
    json = _.extend({}, @attrs)
    if @outs
      json.outs = for out in @outs
        address: out.node.address, map: out.map
    json

  up: -> @group

class Knob extends Element
  constructor: (group, attrs)->
    super
    @attrs.type    ||= "Knob"
    @attrs.minimum ||= 0
    @attrs.maximum ||= 127
    @attrs.step    ||= 1

    x = @attrs.cols || @attrs.rows || 3
    @attrs.cols ||= x
    @attrs.rows ||= x

  out: (node, index=0)-> @map(node, { 0: index })

class Text extends Element
  constructor: (group, attrs)->
    super
    @attrs.type ||= "Text"
    @attrs.cols ||= 1
    @attrs.rows ||= 1

class Adsr extends Element
  constructor: (group, attrs)->
    super
    @attrs.type ||= "ADSR"
    @attrs.cols ||= 12
    @attrs.rows ||= 6

class ToggleButton extends Element
  constructor: (group, attrs)->
    super
    @attrs.type ||= "ToggleButton"
    x = (@attrs.cols || @attrs.rows || 3)
    @attrs.cols ||= x
    @attrs.rows ||= x

class Spinner extends Element
  constructor: (group, attrs)->
    super
    @attrs.type ||= "Spinner"
    @attrs.cols ||= 1
    @attrs.rows ||= 1

Layout.Element = Element
Layout.Knob    = Knob
Layout.Text    = Text

Layout.registerElement "knob", Knob
Layout.registerElement "text", Text
Layout.registerElement "adsr", Adsr
Layout.registerElement "toggleButton", ToggleButton
Layout.registerElement "spinner", Spinner
module.exports = Layout
