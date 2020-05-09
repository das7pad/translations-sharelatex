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

    const fallbackLng = options.defaultLng || 'en'

    i18n.init({
      resGetPath: path.resolve(__dirname, 'locales/__lng__.json'),
      saveMissing: true,
      resSetPath: path.resolve(__dirname, 'locales/missing-__lng__.json'),
      sendMissingTo: 'fallback',
      fallbackLng: fallbackLng,
      detectLngFromHeaders: true,
      useCookie: false,
      preload: availableLngs,
      supportedLngs: availableLngs
    })
    const setLangBasedOnDomainMiddlewear = function(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        return new URL(req.originalUrl, spec.url).href
      }

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
    function setLangBasedOnSessionOrQueryParam(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        const url = new URL(req.originalUrl, spec.url)
        url.searchParams.append('setGlobalLng', spec.lngCode)
        return url.href
      }

      if (req.query.setGlobalLng && subdomainLang.has(req.query.setGlobalLng)) {
        const { lngCode, url } = subdomainLang.get(req.query.setGlobalLng)
        req.session.lng = lngCode
        const parsedURL = new URL(req.originalUrl, url)
        parsedURL.searchParams.delete('setGlobalLng')
        return res.redirect(parsedURL.pathname + parsedURL.search)
      }
      if (req.session.lng) {
        req.i18n.setLng(req.session.lng)
      } else {
        req.i18n.setLng(fallbackLng)
      }
      if (req.language !== req.lng) {
        // 'accept-language' header and setGlobalLng mismatch
        // 'accept-language' header and fallbackLng mismatch
        req.showUserOtherLng = req.language
      }
      next()
    }

    const singleDomainMultipleLng =
      typeof options.singleDomainMultipleLng === 'boolean'
        ? options.singleDomainMultipleLng
        : availableHosts.size === 1 && availableLngs.length !== 1

    return {
      expressMiddlewear: i18n.handle,
      setLangBasedOnDomainMiddlewear: singleDomainMultipleLng
        ? setLangBasedOnSessionOrQueryParam
        : setLangBasedOnDomainMiddlewear,
      i18n
    }
  }
}
