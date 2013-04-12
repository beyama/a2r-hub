Summer = require "summer"

Jam = require "./jam"

class JamService
  Summer.autowire(@, jsonRPC: "jsonRPC")

  constructor: ->
    @jams = {}

  setApplicationContext: (ctx)->
    @context = ctx
    @logger  = ctx.get("logger")
    @hub     = ctx.get("hub")

  init: ->
    j = @

    @jsonRPC.expose "jams",

      getAll: (fn)->
        res = []
        for name, jam of j.jams
          o = { id: name, title: jam.title }
          o.description = jam.description if jam.description?
          o.stream = jam.stream if jam.stream?
          res.push(o)
        fn(null, res)

      getLayouts: (jamName, fn)->
        jam = j.getJam(jamName)

        return fn("Jam `#{jamName}` not found") unless jam

        res = []
        if jam.layouts?
          for layout in jam.layouts
            o = { name: layout.name, title: layout.title || layout.name }
            o.description = layout.description if layout.description
            res.push(o)
        fn(null, res)

      getLayout: (jamName, layoutName, fn)->
        jam = j.getJam(jamName)

        unless jam
          return fn("Jam `#{jamName}` not found")

        unless jam.layouts?.length
          return fn("Layout `#{layoutName}` not found")

        layout = l for l in jam.layouts when l.name is layoutName

        unless layout
          return fn("Layout `#{layoutName}` not found")

        fn(null, layout)

      join: (jamName, layoutName, fn)->
        jam = j.getJam(jamName)

        return fn("Jam `#{jamName}` not found") unless jam

        ret = jam.join(@connection.session)
        fn(null, ret)

  dispose: ->
    for n, jam of @jams
      jam.dispose()

  getJam: (jamName)-> @jams[jamName]

  onJamDispose: (jam)=> delete @jams[jam.name]

  createJam: (session, name, title, description)->
    if @jams[name]?
      throw new Error("Jam `#{name}` already exist")

    @jams[name] = jam = new Jam(session, name, title, description)

    jam.on("dispose", @onJamDispose)

    @hub.emit("jam", jam)
    jam

module.exports = JamService
