Summer  = require "summer"
winston = require "winston"
hub     = require "./"
path    = require "path"
connect = require "connect"

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
      transports: [new winston.transports.Console(handleExceptions: true)]
    )

  logger.exitOnError = false

  # create context
  context = new Summer

  context.set("argv", argv)

  # create the hub
  _hub = new hub.Hub
  _hub.context = context
  # and register hub in context
  context.set("hub", _hub)

  context.on("shutdown", -> _hub.dispose())

  # register config file reader
  context.register("config", hub.configFileLoader)

  # register pid file writer
  context.register("pidFileWriter", class: hub.PidFileWriter, init: "init", dispose: "dispose")

  # register extension loader
  context.register("extensionLoader", class: hub.ExtensionLoader, init: "init", dispose: "dispose")

  # register server
  context.register("server", class: hub.Server, init: "start", dispose: "stop")

  # register JSON RPC
  context.register("jsonRPC", class: hub.JSONRPC, dispose: "dispose")

  # set context locals
  context.set("logger", logger)

  # register connection service
  context.register("connectionService", class: hub.net.ConnectionService, dispose: "dispose")

  publicDir = path.join(__dirname, "../../public")
  webApp = connect().use(connect.static(publicDir))
  context.set("connect", webApp)

  context
