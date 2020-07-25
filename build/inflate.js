const { promises: fs } = require('fs')

async function load(lng) {
  // -> `[['key1', 'Foo __bar__'], ['key2', 'Baz']]`
  return Object.entries(
    JSON.parse(await fs.readFile(`${__dirname}/../locales/${lng}.json`))
  )
}

const FALLBACK_LOCALES = load('en')
async function inflate(translatedLocales) {
  // new Map([['key1','English'], ['key2','notTranslated'], ['key1','German']])
  // last key wins -> `Map { 'key1' => 'German', 'key2' => 'notTranslated' }`
  return new Map((await FALLBACK_LOCALES).concat(translatedLocales))
}

module.exports = async function getInflatedLocales(lng) {
  const translatedLocales = await load(lng)
  return inflate(translatedLocales)
}
