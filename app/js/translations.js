const i18n = require('i18next')
const path = require('path')
const { URL } = require('url')

module.exports = {
  setup(options) {
    options = options || {}
    const subdomainLang = new Map(Object.entries(options.subdomainLang || {}))
    const availableLngs = []
    const availableHosts = new Map()
    subdomainLang.forEach(function(spec) {
      availableLngs.push(spec.lngCode)
      availableHosts.set(new URL(spec.url).host, spec.lngCode)
    })
    i18n.init({
      resGetPath: path.resolve(__dirname, '../../', 'locales/__lng__.json'),
      saveMissing: true,
      resSetPath: path.resolve(
        __dirname,
        '../../',
        'locales/missing-__lng__.json'
      ),
      sendMissingTo: 'fallback',
      fallbackLng: options.defaultLng || 'en',
      detectLngFromHeaders: true,
      useCookie: false,
      preload: availableLngs,
      supportedLngs: availableLngs
    })
    const setLangBasedOnDomainMiddlewear = function(req, res, next) {
      if (req.query.setLng) {
        // setLng is handled by i18n
        // Developers/Users can override the language per request
        return next()
      }
      const { host } = req.headers
      if (availableHosts.has(host)) {
        req.i18n.setLng(availableHosts.get(host))
      }
      if (req.language !== req.lng) {
        // accept-language header and host header mismatch
        req.showUserOtherLng = req.language
      }
      next()
    }

    return {
      expressMiddlewear: i18n.handle,
      setLangBasedOnDomainMiddlewear,
      i18n
    }
  }
}
