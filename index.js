module.exports = process.env.A2R_HUB_COV ?
  require("./lib-cov/a2r-hub") :
  (require.extensions[".coffee"] ? require("./src/a2r-hub") : require("./lib/a2r-hub"))
