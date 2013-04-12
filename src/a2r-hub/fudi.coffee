castAtom = (value)->
  if isNaN(value)
    value.replace /(\\)+/, (m)->
      if m.length is 1
        ""
      else
        s = ""
        i = 0
        l = m.length - 1
        while i < l
          s += "\\"
          i++
        s
  else
    Number(value)

# Parse FUDI data
parseFUDI = (buffer)->
  messages = []
  atoms = []
  i = 0
  start = 0
  while i < buffer.length
    switch buffer[i]
      when 9, 10, 32 # \t, \n or ' '
        if i is 0 or buffer[i-1] isnt 92 # if not escaped with '\'
          atoms.push(castAtom(buffer.toString("ascii", start, i)))
          start = i+1
      when 59 # ';'
        atoms.push(castAtom(buffer.toString("ascii", start, i)))
        start = i+1
        messages.push(atoms)
        atoms = []
    i++
  messages

# Generate FUDI data
generateFUDI = (values)->
  atoms = for value in values
    value.toString().replace(" ", "\\ ")
  atoms.join(' ') + ";\n"

module.exports =
  parseFUDI: parseFUDI
  generateFUDI: generateFUDI
