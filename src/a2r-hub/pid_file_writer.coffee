fs = require "fs"
path = require "path"

Summer = require "summer"

class PidFileWriter
  Summer.autowire @, config: "config"

  setApplicationContext: (context)->
    @context = context
    @logger  = @context.get("logger")

  init: ->
    _path = @context.get("argv")?.pid ? @config.pid_file

    if _path
      _path = path.resolve(_path)
      fs.writeFile _path, String(process.pid), (err)=>
        if err
          @logger.error("Couldn't write pid file `#{_path}` - #{err.message}")
        else
          @path = _path

  dispose: (callback)->
    if @path
      fs.unlink @path, (err)=>
        if err
          @logger.error("Couldn't delete pid file `#{@path}` - #{err.message}")
        else
          @path = null
        callback()
    else
      callback()

module.exports = PidFileWriter
