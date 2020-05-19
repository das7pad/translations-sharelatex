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
    if (!availableLngCodes.includes(fallbackLng)) {
      availableLngCodes.push(fallbackLng)
    }
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
    function getAndCacheLocaleFromFallback(locales, key) {
      const fallback = fallbackLocales.get(key) || key
      locales.set(key, fallback)
      return fallback
    }
    function getLocale(locales, key) {
      return locales.get(key) || getAndCacheLocaleFromFallback(locales, key)
    }
    const regexCache = new Map()
    function createAndCacheFieldRegex(field) {
      const regex = new RegExp(`__${field}__`, 'g')
      regexCache.set(field, regex)
      return regex
    }
    function getKeyMatcher(field) {
      return regexCache.get(field) || createAndCacheFieldRegex(field)
    }
    function substitute(locale, keyValuePair) {
      return locale.replace(getKeyMatcher(keyValuePair[0]), keyValuePair[1])
    }
    function translate(locales, key, vars) {
      return Object.entries(vars || {}).reduce(
        substitute,
        getLocale(locales, key)
      )
    }

    function setLangBasedOnDomainMiddleware(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        return new URL(req.originalUrl, spec.url).href
      }

      // prefer host and then fallback language over browser hint
      req.language = availableHosts.get(req.headers.host) || fallbackLng
      postprocess(req, res, next)
    }
    function setLangBasedOnSessionOrQueryParam(req, res, next) {
      res.locals.getTranslationUrl = spec => {
        const url = new URL(req.originalUrl, spec.url)
        // add the setGlobalLng query parameter while preserving other params
        url.searchParams.append('setGlobalLng', spec.lngCode)
        return url.href
      }

      if (req.query.setGlobalLng && subdomainLang.has(req.query.setGlobalLng)) {
        const { lngCode, url } = subdomainLang.get(req.query.setGlobalLng)
        req.session.lng = lngCode
        // cleanup the setGlobalLng query parameter and preserve other params
        const parsedURL = new URL(req.originalUrl, url)
        parsedURL.searchParams.delete('setGlobalLng')
        return res.redirect(parsedURL.pathname + parsedURL.search)
      }

      // prefer session and then fallback language over browser hint
      req.language = req.session.lng || fallbackLng
      postprocess(req, res, next)
    }

    const singleDomainMultipleLng =
      typeof options.singleDomainMultipleLng === 'boolean'
        ? options.singleDomainMultipleLng
        : availableHosts.size === 1 && availableLngCodes.length !== 1
    const middleware = singleDomainMultipleLng
      ? setLangBasedOnSessionOrQueryParam
      : setLangBasedOnDomainMiddleware

    function postprocess(req, res, next) {
      if (req.query.setLng) {
        // Developers/Users can override the language per request
        if (!availableLngCodes.includes(req.query.setLng)) {
          return res.status(400).json({ message: 'invalid lngCode' })
        }
        req.language = req.query.setLng
      }

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
      const locales = allLocales.get(req.language)
      req.i18n.t = req.i18n.translate = (key, vars) =>
        translate(locales, key, vars)
      next()
    }

    // backwards compatibility
    middleware.expressMiddlewear = middleware
    middleware.setLangBasedOnDomainMiddlewear = (req, res, next) => next()
    // used in tests
    middleware.i18n = {
      translate: key => translate(allLocales.get(fallbackLng), key)
    }
    return middleware
  }
}
