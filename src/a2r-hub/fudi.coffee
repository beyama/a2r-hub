castAtom = (value)->
  return value if isNaN(value)
  Number(value)

# Parse FUDI data
parseFUDI = (buffer)->
  messages = []
  atoms = []
  i = 0
  start = 0
  while i < buffer.length
    switch buffer[i]
      when 9, 10, 32
        if i is 0 or buffer[i-1] isnt 92
          atoms.push(castAtom(buffer.toString("ascii", start, i)))
          start = i+1
      when 59
        atoms.push(castAtom(buffer.toString("ascii", start, i)))
        start = i+1
        messages.push(atoms)
        atoms = []
    i++
  messages

# Generate FUDI data
generateFUDI = (sym, typeTag, values)->
  if typeTag.length isnt values.length
    throw new Error("Type tag length doesn't match values length")

  atoms = [sym]
  i = 0
  while i < typeTag.length
    value = values[i]
    char  = typeTag.charAt(i++)
    switch char
      when 'i' then atoms.push(Math.round(value).toString())
      when 'f'
        fraction = value - Math.floor(value)
        if fraction
          atoms.push(value.toString())
        else
          atoms.push(value.toString() + '.0')
      when 's' then atoms.push(value)
      else throw new Error("Unsupported type `#{char}`")
  atoms.join(' ') + ";\n"

module.exports.parseFUDI = parseFUDI
module.exports.generateFUDI = generateFUDI
