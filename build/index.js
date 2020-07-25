const fs = require('fs')
const Path = require('path')
const Generator = require('./generator')
const getInflatedLocales = require('./inflate')

const SOURCE_DIRECTORY = `${__dirname}/../locales/`
const TARGET_DIRECTORY = `${__dirname}/../lng`

function createTargetDirectory() {
  mkdirP(TARGET_DIRECTORY)
}

function getAvailableLngCodes() {
  return fs.readdirSync(SOURCE_DIRECTORY).map(stripExtension)
}

function persistInflatedLocalesToDisk(lng, inflatedLocales) {
  const blob = Generator.generateModule(inflatedLocales)
  fs.writeFileSync(`${TARGET_DIRECTORY}/${lng}.js`, blob)
}

function processLng(lng) {
  persistInflatedLocalesToDisk(lng, getInflatedLocales(lng))
}

function main() {
  createTargetDirectory()
  getAvailableLngCodes().forEach(processLng)
}

main()

function mkdirP(path) {
  fs.mkdirSync(path, { recursive: true })
}
function stripExtension(file) {
  return Path.basename(file, '.json')
}
