fs   = require "fs"
path = require "path"

class ScriptLoader
  setApplicationContext: (ctx)->
    @hub    = ctx.get("hub")
    @logger = ctx.get("logger")

  init: (callback)->
    @logger.info "Loading scripts"
    dir = path.join(__dirname, "/../../scripts")

    fs.readdir dir, (err, files)=>
      if err
        @logger.error "Error reading scripts directory `#{dir}`"
        @logger.error err.stack
        return callback()

      for file in files when /(?:\.coffee|\.js)$/.test file
        try
          fn = require(path.join(dir, file))
          fn(@hub) if typeof fn is "function"
        catch e
          @logger.error "Error loading script `#{file}`"
          @logger.error e.stack

      callback()

module.exports = ScriptLoader
