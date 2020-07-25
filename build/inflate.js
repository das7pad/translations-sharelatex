const fs = require('fs')

function load(lng) {
  // -> `[['key1', 'Foo __bar__'], ['key2', 'Baz']]`
  return Object.entries(
    JSON.parse(fs.readFileSync(`${__dirname}/../locales/${lng}.json`))
  )
}

const FALLBACK_LOCALES = load('en')
function inflate(translatedLocales) {
  // new Map([['key1','English'], ['key2','notTranslated'], ['key1','German']])
  // last key wins -> `Map { 'key1' => 'German', 'key2' => 'notTranslated' }`
  return new Map(FALLBACK_LOCALES.concat(translatedLocales))
}

module.exports = function getInflatedLocales(lng) {
  const translatedLocales = load(lng)
  return inflate(translatedLocales)
}
