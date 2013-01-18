RESERVED_CHARACTERS = "\\#\\*,\\?\\[\\]{}\\s"

ALLOWED_TOKEN_CHARACTER_SET = "[^#{RESERVED_CHARACTERS}/]"
RESERVED_TOKEN_CHARACTER_SET = "[#{RESERVED_CHARACTERS}/]"

VALID_TOKEN_REGEXP = new RegExp(ALLOWED_TOKEN_CHARACTER_SET)
INVALID_TOKEN_REGEXP = new RegExp(RESERVED_TOKEN_CHARACTER_SET)

TOKEN_REPLACE_REGEXP = new RegExp("(\\?|\\*|\\[.*\\]|{.*})", "g")

TOKEN_REPLACE = (_, pattern)->
  switch pattern.charAt(0)
    when '*' then ALLOWED_TOKEN_CHARACTER_SET + "{0,}"
    when '?' then ALLOWED_TOKEN_CHARACTER_SET + "{1}"
    when '['
      if pattern.charAt(1) is '!'
        negate = true
        pattern = pattern[2..-2]
      else
        pattern = pattern[1..-2]

      if INVALID_TOKEN_REGEXP.test(pattern)
        throw new Error("Invalid pattern '#{path}'")
      else
        if negate then "[^#{pattern}]" else "[#{pattern}]"
    when '{'
      pattern = pattern[1..-2]
      tokens = for tok in pattern.split(",")
        if INVALID_TOKEN_REGEXP.test(tok)
          throw new Error("Invalid pattern '#{path}'")
        else
          tok
      "(?:#{tokens.join('|')})"

ADDRESS_REPLACE_REGEXP = /(\/)?(\/)?([^\/]*)?/g

ADDRESS_REPLACE = (_, slash, ml, capture)->
  reg = if ml then "(?:/.*)*" else (if slash then "/" else "")

  if capture
    reg += "/" if ml
    reg += capture.replace(TOKEN_REPLACE_REGEXP, TOKEN_REPLACE)
  reg

module.exports = address =
  # Retruns true if given string contains pattern
  isPattern: (addr)->
    /(?:\/\/|\?|\*|\[.*\]|{.*})/.test(addr)

  # Returns true if given token doesn't contain
  # slashes or reserved characters.
  isValidToken: (token)->
    VALID_TOKEN_REGEXP.test(token)

  # Returns true if given string starts with a slash
  # and doesn't contain pattern characters.
  isValidAddress: (addr)->
    addr.charAt(0) is "/" and not address.isPattern(addr)

  # Returns true if given string starts with a slash
  # and contains pattern characters.
  isValidPattern: (addr)->
    addr.charAt(0) is "/" and address.isPattern(addr)

  # Returns a RegExp for given address pattern
  compilePattern: (path, sensitive=true)->
    path = path.replace(ADDRESS_REPLACE_REGEXP, ADDRESS_REPLACE)
    new RegExp("^#{path}$", if sensitive then "" else "i")

  # Returns a RegExp for given token pattern
  compileTokenPattern: (token, sensitive=true)->
    pattern = token.replace(TOKEN_REPLACE_REGEXP, TOKEN_REPLACE)
    new RegExp("^#{pattern}$", if sensitive then "" else "i")
