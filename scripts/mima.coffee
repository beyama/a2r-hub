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
        pd.sendFUDI("master_channel", "iiiiiiiiii", msg.arguments)

      mimaSpinner.on "message", (msg)->
        pd.sendFUDI("mima_spinner", "f", msg.arguments)
