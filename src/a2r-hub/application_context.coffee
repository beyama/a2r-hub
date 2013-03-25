Summer  = require "summer"
winston = require "winston"
a2rHub  = require "./"
path    = require "path"
connect = require "connect"

module.exports = (argv)->
  argv ||= {}

  if process.env.NODE_ENV is "test"
    logFile = path.join(__dirname, "../../log/test.log")
    logger = new winston.Logger(
      transports: [new winston.transports.File(filename: logFile, json: false)]
    )
  else
    logFile = path.join(__dirname, "../../log/production.log")
    logger = new winston.Logger(
      transports: [
        new winston.transports.Console(handleExceptions: true),
        new winston.transports.File(filename: logFile, json: false)
      ]
    )

  logger.exitOnError = false

  # create context
  context = new Summer

  context.set("argv", argv)

  # create the hub
  hub = new a2rHub.Hub
  hub.context = context
  hub.logger  = logger

  # and register hub in context
  context.set("hub", hub)

  context.on("shutdown", -> hub.dispose())

  # register config file reader
  context.register("config", a2rHub.configFileLoader)

  # register pid file writer
  context.register("pidFileWriter", class: a2rHub.PidFileWriter, init: "init", dispose: "dispose")

  # register extension loader
  context.register("extensionLoader", class: a2rHub.ExtensionLoader, init: "init", dispose: "dispose")

  # register scripts loader
  context.register("scriptLoader", class: a2rHub.ScriptLoader, init: "init")

  # register server
  context.register("server", class: a2rHub.Server, init: "start", dispose: "stop")

  # register JSON RPC
  context.register("jsonRPC", class: a2rHub.JSONRPC)

  # register Jam service
  context.register("jamService", class: a2rHub.JamService, init: "init", dispose: "dispose")

  # set context locals
  context.set("logger", logger)

  # register connection service
  context.register("connectionService", class: a2rHub.net.ConnectionService, dispose: "dispose")

  publicDir = path.join(__dirname, "../../public")
  webApp = connect().use(connect.static(publicDir))
  context.set("connect", webApp)

  context
