should = require "should"
address = require("../").address

describe ".compilePattern", ->
  tests = {
    # normal pathes
    "/":
      match: ["/"]
      dontMatch: ["/foo"]
    "/foo":
      match: ["/foo"]
      dontMatch: ["/foo/bar"]
    # match any single character
    "/fo?":
      match: ["/foo"]
      dontMatch: ["/foos"]
    "/o?c":
      match: ["/osc"]
      dontMatch: ["/osb"]
    # match any sequenze of zero or more characters
    "/foo/*":
      match: ["/foo/bar"]
      dontMatch: ["/foo/bar/baz"]
    "/foo/*baz":
      match: ["/foo/baz", "/foo/barbaz"]
      dontMatch: ["/foo/bar/baz"]
    # match character set
    "/foo/ba[rz]":
      match: ["/foo/bar", "/foo/baz"]
      dontMatch: ["/foo", "/bar", "/baz"]
    "/foo/ba[^rz]":
      match: ["/foo/bal", "/foo/bau"]
      dontMatch: ["/foo/bar", "/foo/baz"]
    "/foo/[0-9]":
      match: ("/foo/#{i}" for i in [0..9])
      dontMatch: ("/foo/#{i}" for i in [10..19])
    "/foo/bar[0-9]baz":
      match: ("/foo/bar#{i}baz" for i in [0..9])
      dontMatch: ("/foo/bar#{i}baz" for i in [10..19])
    # match string list
    "/foo/{bar,baz}":
      match: ["/foo/bar", "/foo/baz"]
      dontMatch: ["/foo", "/bar", "/baz"]
    "/foo/sub{bar,baz}":
      match: ["/foo/subbar", "/foo/subbaz"]
      dontMatch: ["/foo", "/foo/bar", "/foo/baz"]
    # multi-line match
    "//foo":
      match: ["/foo", "/bar/foo", "/bar/baz/foo"]
      dontMatch: ["/foo/bar"]
    "/foo//baz":
      match: ["/foo/baz", "/foo/bar/baz", "/foo/bar/baz/baz"]
      dontMatch: ["/baz"]
  }
      
  it "should compile standard compilant pattern", ->
    for pattern, examples of tests
      regexp = address.compilePattern(pattern)

      for addr in examples.match
        addr.should.match(regexp)

      for addr in examples.dontMatch
        addr.should.not.match(regexp)

  illegalAddresses = ["/foo/[*]", "/foo/[?]", "/foo/[#]", "/foo/{bar,*}", "/foo/{?,bar}"]

  it "should throw an error if pattern contains illegal characters", ->
    for addr in illegalAddresses
      (-> address.compilePattern(addr) ).should.throw()
