a2rHub = require "../"
osc = a2rHub.Hub.osc

module.exports = (hub)->
  hub.context.resolve "jamService", (err, service)->
    session = hub.createSession()
    jam = service.createJam(session, "mima", "Mima", "Dubstep by Addicted²Random")

    masterChannel = jam.createNode "/master/channel",
      args: [
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 },
        { type: "integer", minimum: 0, maximum: 127, step: 1 }
      ]

    masterChannel.set(session, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50])
    masterChannel.chain().lock(500).set()

    mimaSpinner = jam.createNode("/spinner", args: [ type: "float" ])

    # Layout
    layout = jam.createLayout(name: "mima", title: "Mima")
    main = layout.addSection(name: "main", title: "Main")

    row = main.row(0, 0)

    row.text(text: "Master channels", rows: 2, cols: 15)

    row = row.next()

    row.text(text: "drums", cols: 3, rows: 2)
    row.text(text: "voc",   cols: 3, rows: 2)
    row.text(text: "bass",  cols: 3, rows: 2)
    row.text(text: "deep",  cols: 3, rows: 2)
    row.text(text: "noise", cols: 3, rows: 2)

    row = row.next()

    row.knob().out(masterChannel, 0)
    row.knob().out(masterChannel, 1)
    row.knob().out(masterChannel, 2)
    row.knob().out(masterChannel, 3)
    row.knob().out(masterChannel, 4)

    row = row.next()

    row.text(text: "arp",    cols: 3, rows: 2)
    row.text(text: "chord",  cols: 3, rows: 2)
    row.text(text: "master", cols: 3, rows: 2)
    row.text(text: "del",    cols: 3, rows: 2)
    row.text(text: "rev",    cols: 3, rows: 2)

    row = row.next()

    row.knob().out(masterChannel, 5)
    row.knob().out(masterChannel, 6)
    row.knob().out(masterChannel, 7)
    row.knob().out(masterChannel, 8)
    row.knob().out(masterChannel, 9)

    row = row.next()

    row.spinner().map(mimaSpinner, 0: 0)

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
