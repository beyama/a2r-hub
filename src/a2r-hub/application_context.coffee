Summer  = require "summer"
winston = require "winston"
hub     = require "./"
path    = require "path"

module.exports = (argv)->
  argv ||= {}

  if process.env.NODE_ENV is "test"
    # create logger
    logFile = path.join(__dirname, "../../log/test.log")
    logger = new winston.Logger(
      transports: [new winston.transports.File(filename: logFile, json: false)]
    )
  else
    # create logger
    logger = new winston.Logger(
      transports: [new winston.transports.Console()]
    )

  # create context
  context = new Summer

  context.set("argv", argv)

  # create the hub
  _hub  = new hub.Hub
  # and register hub in context
  context.set("hub", _hub)

  context.on("shutdown", -> _hub.shutdown())

  # register config file reader
  context.register("config", hub.configFileLoader)

  # register pid file writer
  context.register("pidFileWriter", class: hub.PidFileWriter, init: "init", dispose: "dispose")

  # register server
  context.register("server", class: hub.Server, init: "start", dispose: "stop")

  # set context locals
  context.set("logger", logger)

  # register connection service
  context.register("connectionService", class: hub.net.ConnectionService, dispose: "dispose")

  context.register("express", hub.express)

  context
