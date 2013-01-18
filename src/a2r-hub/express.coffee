express = require "express"
path = require "path"

# Express bootstrap code
module.exports = (callback)->
  app = express()

  sessionStore = new express.session.MemoryStore

  root = path.join(__dirname, "../../")

  app.configure ->
    app.set("views", path.join(root, "views"))
    app.set("view engine", "jade")
    app.set("session store", sessionStore)
    app.use(express.favicon())
    app.use(express.logger("dev"))
    app.use(express.bodyParser())
    app.use(express.methodOverride())
    app.use(express.cookieParser('your secret here'))
    app.use(express.session(
      store: sessionStore
      secret: "secret"
      key: "express.sid"
    ))
    app.use(app.router)
    app.use(require('less-middleware')(src: path.join(root, "public")))
    app.use(express.static(path.join(root, 'public')))

  app.configure "development", ->
    app.use(express.errorHandler())

  app.get "/", (req, res)->
    res.render('index', { title: 'Express' })

  callback(null, app)


