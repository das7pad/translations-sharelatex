const i18n = require('i18next')
const middleware = require('i18next-http-middleware')
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

    i18n
      .use(middleware.LanguageDetector)
      .use(require('i18next-fs-backend'))
      .init({
        initImmediate: false, // load synchronous
        backend: {
          loadPath: path.resolve(__dirname, 'locales/__lng__.json'),
          addPath: path.resolve(__dirname, 'locales/missing-__lng__.json')
        },
        saveMissing: true,
        saveMissingTo: 'fallback',
        interpolation: {
          escapeValue: false, // some vars use HTML -- e.g. `<strong>`
          prefix: '__',
          suffix: '__'
        },
        fallbackLng: fallbackLng,
        preload: availableLngs,
        supportedLngs: availableLngs
      })
    const setLangBasedOnDomainMiddlewear = function(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        return new URL(req.originalUrl, spec.url).href
      }

      if (req.query.setLng) {
        // Developers/Users can override the language per request
        req.i18n.changeLanguage(req.query.setLng)
        return next()
      }
      const { host } = req.headers
      const browserLanguage = req.language
      // prefer host and then fallback language over browser hint
      const targetLanguage =
        (availableHosts.has(host) && availableHosts.get(host)) || fallbackLng
      if (browserLanguage !== targetLanguage) {
        // accept-language header and host header mismatch
        req.i18n.changeLanguage(targetLanguage)
        req.showUserOtherLng = browserLanguage
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

      const browserLanguage = req.language
      // prefer session and then fallback language over browser hint
      const targetLanguage = (req.session.lng && req.session.lng) || fallbackLng
      if (browserLanguage !== targetLanguage) {
        // 'accept-language' header and setGlobalLng mismatch
        // 'accept-language' header and fallbackLng mismatch
        req.i18n.changeLanguage(targetLanguage)
        req.showUserOtherLng = browserLanguage
      }
      next()
    }

    const singleDomainMultipleLng =
      typeof options.singleDomainMultipleLng === 'boolean'
        ? options.singleDomainMultipleLng
        : availableHosts.size === 1 && availableLngs.length !== 1

    return {
      expressMiddlewear: middleware.handle(i18n),
      setLangBasedOnDomainMiddlewear: singleDomainMultipleLng
        ? setLangBasedOnSessionOrQueryParam
        : setLangBasedOnDomainMiddlewear,
      i18n
    }
  }
}
