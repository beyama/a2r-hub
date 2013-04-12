a2rHub = require "../"
osc = a2rHub.Hub.osc

module.exports = (hub)->
  hub.context.resolve "jamService", (err, service)->
    session = hub.createSession()
    jam = service.createJam(session, "mima", "Mima", "Dubstep by Addicted²Random")
    jam.layouts = [require "./mima.json"]

    masterChannel = jam.createNode("/master/channel")
    masterChannel.set(@session, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50])
    masterChannel.chain().lock(500).set()

    mimaSpinner = jam.createNode("/spinner")

    hub.context.get("connectionService").createClient "udp+brandt://127.0.0.1:3002", (err, pd)=>
      # connect nodes on message event with pd
      masterChannel.on "message", (msg)->
        values = msg.arguments[0..-1]
        values.unshift("master_channel")
        pd.sendFUDI(values)

      mimaSpinner.on "message", (msg)->
        values = msg.arguments[0..-1]
        values.unshift("mima_spinner")
        pd.sendFUDI(values)
