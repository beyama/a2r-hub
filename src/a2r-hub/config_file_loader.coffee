fs = require "fs"
path = require "path"

# Config file loader class.
class ConfigFileLoader
  constructor: (_path)->
    if _path
      @path = path.resolve(_path)

  # Load a JSON config file
  # either from supplied path or from default pathes.
  load: (callback)->
    # load config from path if path given
    if @path
      @loadFile(@path, callback)
    else
      @loadFile @userConfigPath(), (err, config)=>
        # try to load system config
        if err or not config
          return @loadFile @globalConfigPath(), (err, config)=>
            # try to load default config
            if err or not config
              try
                # default config
                config = require("../../config/config.json")
                return callback(null, config)
              catch e
                return callback(e)
            # else
            callback(null, config)
        # system config
        callback(null, config)

  # return path to user config
  userConfigPath: ->
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']
    path.join(home, ".a2r_server.json")

  # return path to global congig
  globalConfigPath: -> "/etc/a2r_server.json"

  # Load file from fs, parse with JSON and return result
  loadFile: (path, callback)->
    fs.stat path, (err, stat)->
      return callback(err) if err or not stat.isFile()

      fs.readFile path, (err, data)->
        return callback(err) if err

        try
          callback(null, JSON.parse(data))
        catch e
          callback(e)

# Load a config file from `path` or try to
# load config file from default locations
module.exports = (path, callback)->
  if typeof path is "function"
    callback = path
    path = null
  path ||= @get("argv")?.config
  new ConfigFileLoader(path).load(callback)
