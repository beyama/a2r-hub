should = require "should"
fudi = require("../").fudi

describe "fudi", ->
  describe ".parseFUDI", ->
    it "should parse a list of messages", ->
      msgs = fudi.parseFUDI(new Buffer("foo;bar;baz;"))
      msgs.should.have.length 3
      
      for s, i in ["foo", "bar", "baz"]
        msgs[i].should.have.length 1
        msgs[i][0].should.be.equal s

    it "should parse conver numbers", ->
      msg = fudi.parseFUDI(new Buffer("0 1 2.3;"))[0]
      for n, i in [0, 1, 2.3]
        msg[i].should.be.equal n

    it "should handle escaped strings", ->
      msg = fudi.parseFUDI(new Buffer("foo\\ bar;"))[0]
      msg.should.have.length 1
      msg[0].should.be.equal "foo bar"

      msg = fudi.parseFUDI(new Buffer("foo\\\\ bar;"))[0]
      msg.should.have.length 1
      msg[0].should.be.equal "foo\\ bar"

  describe ".generateFUDI", ->
    it "should escape strings", ->
      str = fudi.generateFUDI(["foo bar"])
      str.should.be.equal "foo\\ bar;\n"

    it "should stringify numbers", ->
      str = fudi.generateFUDI([1, 2, 4.4])
      str.should.be.equal "1 2 4.4;\n"
