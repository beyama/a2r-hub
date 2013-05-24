# require dependencies
optimist = require "optimist"
hub      = require("../")

# configure optimist
argv = optimist
  # usage message
  .usage("Usage: $0 [options]")

  # help
  .boolean("h")
  .alias("h", "help")
  .describe("h", "Print this help message")

  # version
  .string("v")
  .alias("v", "version")
  .describe("v", "Print version to stdout")

  # config file
  .string("c")
  .alias("c", "config")
  .describe("c", "Config file to use")

  # pidfile
  .string("pid")
  .describe("pid", "Pid file path")

  # get argv
  .argv

if argv.help
  optimist.showHelp()
  return process.exit(0)

if argv.version
  console.log("0.0.1")
  return process.exit(0)

context = hub.applicationContext(argv)
logger = context.get("logger")

# starting the server
logger.info("Starting server")

context.resolve "server", (err, server)->
  if err
    logger.warn("Starting the server failed")
    logger.warn(err.stack)
    return shutdown()
  logger.info("Server started")

shutdown = ->
  logger.info("Shutting down the server")
  process.stdin.resume()

  context.shutdown (err)->
    if err
      logger.error("Error during shutdown - #{err.message}")
    process.exit(if err then 1 else 0)

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('SIGKILL', shutdown)
