const fs = require('fs')
const { URL } = require('url')

// IO is very expensive -- load locales up-front
function buildAllLocales(fallbackLng, availableLngCodes) {
  function load(lng) {
    // -> `[['key1', 'Foo __bar__'], ['key2', 'Bar']]`
    return Object.entries(
      JSON.parse(fs.readFileSync(`${__dirname}/locales/${lng}.json`))
    )
  }
  function chain(targetLocales) {
    // new Map([['key1','English'], ['key2','foo'], ['key1','German']])
    // last key wins -> `Map { 'key1' => 'German', 'key2' => 'foo' }`
    return new Map(fallbackLocales.concat(targetLocales))
  }
  const fallbackLocales = load(fallbackLng)
  return new Map(availableLngCodes.map(lng => [lng, chain(load(lng))]))
}

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
    const allLocales = buildAllLocales(fallbackLng, availableLngCodes)
    const fallbackLocales = allLocales.get(fallbackLng)
    const KEYS = new RegExp('__(.+?)__', 'g')

    function translate(locales, key, vars) {
      vars = vars || {}
      return (locales.get(key) || key).replace(
        KEYS,
        (field, label) => vars[label] || field
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
    middleware.i18n = {
      translate: key => translate(fallbackLocales, key)
    }
    return middleware
  }
}
