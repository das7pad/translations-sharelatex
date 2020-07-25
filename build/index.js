const { promises: fs } = require('fs')
const Path = require('path')
const Generator = require('./generator')
const getInflatedLocales = require('./inflate')

const SOURCE_DIRECTORY = `${__dirname}/../locales/`
const TARGET_DIRECTORY = `${__dirname}/../lng`

async function createTargetDirectory() {
  return mkdirP(TARGET_DIRECTORY)
}

async function getAvailableLngCodes() {
  return (await fs.readdir(SOURCE_DIRECTORY)).map(stripExtension)
}

async function persistInflatedLocalesToDisk(lng, inflatedLocales) {
  const blob = Generator.generateModule(inflatedLocales)
  await fs.writeFile(`${TARGET_DIRECTORY}/${lng}.js`, blob)
}

async function processLng(lng) {
  await persistInflatedLocalesToDisk(lng, await getInflatedLocales(lng))
}

;(async function main() {
  await createTargetDirectory()
  await Promise.all((await getAvailableLngCodes()).map(processLng))
})()

async function mkdirP(path) {
  return fs.mkdir(path, { recursive: true })
}
function stripExtension(file) {
  return Path.basename(file, '.json')
}
