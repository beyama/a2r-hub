should = require "should"

a2rHub = require "../"

Layout = a2rHub.Layout

describe "a2rHub.Layout", ->
  layout = null

  beforeEach ->
    layout = new Layout(name: "layout")

  describe ".addSection", ->

    it "should add a section to the layout", ->
      name = "main"
      title = "Main section"

      section = layout.section(name: name, title: title)

      layout.sections.should.have.length 1
      layout.sections[0].should.be.equal section

      section.attrs.name.should.be.equal name
      section.attrs.title.should.be.equal title

    it "should throw an error if name is undefined", ->
      (-> layout.section()).should.throw()

  describe ".toJSON", ->
    it "should return valid JSON", ->
      h = new a2rHub.Hub
      n1 = h.createNode "/node1",
        args: [
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
        ]

      n2 = h.createNode "/node2",
        args: [
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
          { type: "integer", minimum: 0, maximum: 127, step: 1 },
        ]

      s1 = layout.section(name: "s1", title: "section 1")
      s2 = layout.section(name: "s2", title: "section 2")

      s1.knob().out(n1)
      s1.knob().out(n1, 1)
      s2.adsr().map(n2, 0: 0, 1: 1, 2: 2, 3: 3)

      j = layout.toJSON()

      j.name.should.be.equal "layout"
      j.title.should.be.equal "layout"

      j.sections.should.have.length 2

      s = j.sections
      for i in [0..1]
        s[i].name.should.be.equal "s#{i+1}"
        s[i].title.should.be.equal "section #{i+1}"

      s[0].elements.should.have.length 2
      s[1].elements.should.have.length 1

      # routes
      j.routes.should.have.length 2
      r = j.routes
      r[0].address.should.be.equal "/node1"

      for i in [0..1]
        sig = r[0].signature[i]
        sig.type.should.be.equal "integer"
        sig.minimum.should.be.equal 0
        sig.maximum.should.be.equal 127
        sig.step.should.be.equal 1

      r[1].address.should.be.equal "/node2"

      for i in [0..3]
        sig = r[1].signature[i]
        sig.type.should.be.equal "integer"
        sig.minimum.should.be.equal 0
        sig.maximum.should.be.equal 127
        sig.step.should.be.equal 1

  describe "Section", ->
    describe ".up", ->
      it "should return the layout", ->
        layout.addSection(name: "x").up().should.be.equal layout

  describe "Row builder", ->
    section = null

    beforeEach ->
      section = layout.addSection(name: "section1")

    it "should set correct x and y values", ->
      row = section.row(0, 0)

      row.text(text: "1", rows: 2, cols: 3)
      row.text(text: "2", rows: 2, cols: 3)

      row.height.should.be.equal 2
      row.startX.should.be.equal 0
      row.startY.should.be.equal 0

      row = row.next()
      row.text(text: "3", rows: 2, cols: 3)
      
      elements = section.elements

      elements.should.have.length 3

      row.height.should.be.equal 2
      row.startX.should.be.equal 0
      row.startY.should.be.equal 2

      elem = elements[0]
      elem.attrs.x.should.be.equal 0
      elem.attrs.y.should.be.equal 0

      elem = elements[1]
      elem.attrs.x.should.be.equal 3
      elem.attrs.y.should.be.equal 0

      elem = elements[2]
      elem.attrs.x.should.be.equal 0
      elem.attrs.y.should.be.equal 2

  describe "Element", ->
    section = null

    beforeEach ->
      section = layout.addSection(name: "section1")

    describe ".up", ->
      it "should return the section", ->
        section.knob().up().should.be.equal section

  describe "element builder methods", ->
    section = null

    beforeEach ->
      section = layout.addSection(name: "section1")

    describe "Knob", ->
      it "should have type `Knob`", ->
        section.knob().attrs.type.should.be.equal "Knob"

      it "should set decent defaults", ->
        k = section.knob()
        k.attrs.cols.should.be.equal 3
        k.attrs.rows.should.be.equal 3
        k.attrs.minimum.should.be.equal 0
        k.attrs.maximum.should.be.equal 127
        k.attrs.step.should.be.equal 1

      it "should set rows to value of cols", ->
        k = section.knob cols: 4
        k.attrs.rows.should.be.equal 4

      it "should set cols to value of rows", ->
        k = section.knob rows: 4
        k.attrs.cols.should.be.equal 4

    describe "Text", ->
      it "should have type `Text`", ->
        section.text().attrs.type.should.be.equal "Text"

      it "should set decent defaults", ->
        t = section.text()
        t.attrs.cols.should.be.equal 1
        t.attrs.rows.should.be.equal 1

    describe "ADSR", ->
      it "should have type `ADSR`", ->
        section.adsr().attrs.type.should.be.equal "ADSR"

      it "should set decent defaults", ->
        a = section.adsr()
        a.attrs.cols.should.be.equal 12
        a.attrs.rows.should.be.equal 6

    describe "ToggleButton", ->
      it "should have type `ToggleButton`", ->
        section.toggleButton().attrs.type.should.be.equal "ToggleButton"

      it "should set decent defaults", ->
        t = section.toggleButton()
        t.attrs.cols.should.be.equal 3
        t.attrs.rows.should.be.equal 3

      it "should set rows to value of cols", ->
        t = section.toggleButton cols: 4
        t.attrs.rows.should.be.equal 4

      it "should set cols to value of rows", ->
        t = section.toggleButton rows: 4
        t.attrs.cols.should.be.equal 4

    describe "Spinner", ->
      it "should have type `Spinner`", ->
        section.spinner().attrs.type.should.be.equal "Spinner"

      it "should set decent defaults", ->
        s = section.spinner()
        s.attrs.cols.should.be.equal 12
        s.attrs.rows.should.be.equal 12
