const fs = require('fs')
const { URL } = require('url')

module.exports = {
  setup(options) {
    options = options || {}
    const subdomainLang = new Map(Object.entries(options.subdomainLang || {}))
    const availableLngCodes = []
    const availableHosts = new Map()
    subdomainLang.forEach(function(spec) {
      availableLngCodes.push(spec.lngCode)
      availableHosts.set(new URL(spec.url).host, spec.lngCode)
    })

    const fallbackLng = options.defaultLng || 'en'
    const allLocales = new Map(
      availableLngCodes.map(lang => [
        lang,
        new Map(
          Object.entries(
            JSON.parse(fs.readFileSync(`${__dirname}/locales/${lang}.json`))
          )
        )
      ])
    )
    const fallbackLocales = allLocales.get(fallbackLng)
    function getLocaleFromFallback(key) {
      return fallbackLocales.has(key) ? fallbackLocales.get(key) : key
    }
    function getLocale(locales, key) {
      if (locales.has(key)) return locales.get(key)

      const fallback = getLocaleFromFallback(key)
      locales.set(key, fallback)
      return fallback
    }

    function translate(locales, key, vars) {
      const bareLocale = getLocale(locales, key)
      if (!vars) return bareLocale
      return Object.entries(vars).reduce((translated, keyValue) => {
        return translated.replace(`__${keyValue[0]}__`, keyValue[1])
      }, bareLocale)
    }

    const setLangBasedOnDomainMiddleware = function(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        return new URL(req.originalUrl, spec.url).href
      }

      const { host } = req.headers
      // prefer host and then fallback language over browser hint
      req.language = availableHosts.get(host) || fallbackLng
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

      // prefer session and then fallback language over browser hint
      req.language = req.session.lng || fallbackLng
      next()
    }

    const singleDomainMultipleLng =
      typeof options.singleDomainMultipleLng === 'boolean'
        ? options.singleDomainMultipleLng
        : availableHosts.size === 1 && availableLngCodes.length !== 1
    const _setLang = singleDomainMultipleLng
      ? setLangBasedOnSessionOrQueryParam
      : setLangBasedOnDomainMiddleware

    function setLang(req, res, next) {
      if (req.query.setLng) {
        // Developers/Users can override the language per request
        if (!availableLngCodes.includes(req.query.setLng)) {
          return res.status(400).json({ message: 'invalid lngCode' })
        }
        req.language = req.query.setLng
        return next()
      }
      _setLang(req, res, next)
    }

    function middleware(req, res, next) {
      setLang(req, res, function() {
        const browserLanguage = req.acceptsLanguages(availableLngCodes)
        if (browserLanguage && browserLanguage !== req.language) {
          // 'accept-language' header and fallbackLng mismatch
          // 'accept-language' header and host header mismatch
          // 'accept-language' header and ?setGlobalLng mismatch
          // 'accept-language' header and ?setLng mismatch
          req.showUserOtherLng = browserLanguage
        }
        req.lng = req.locale = req.language

        req.i18n = {}
        req.i18n.t = req.i18n.translate = translate.bind(
          null,
          allLocales.get(req.language)
        )
        next()
      })
    }

    middleware.expressMiddlewear = middleware
    middleware.setLangBasedOnDomainMiddlewear = (req, res, next) => next()
    return middleware
  }
}
