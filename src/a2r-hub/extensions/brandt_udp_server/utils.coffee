symToAddress = (sym)->
  match = sym.match(/^(\d+)?-?(\S+)_(\S+)$/)
  
  return unless match

  if match[1]?
    address = "/#{match[1]}"
  else
    address = ""
  address += "/#{match[2]}"
  address += "/#{match[3]}"
  address

module.exports.symToAddress = symToAddress
