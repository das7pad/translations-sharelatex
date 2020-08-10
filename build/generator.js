const FIELDS = new RegExp('__(.+?)__', 'g')

function translateWrapper(LOCALES = new Map()) {
  return function translate(key, vars) {
    vars = vars || {}
    return (LOCALES.get(key) || key).replace(FIELDS, function(field, label) {
      // fallback to no replacement
      // ('__appName__', 'appName') => vars['appName'] || '__appName__'
      return vars[label] || field
    })
  }
}

function hasLocaleWrapper(LOCALES = new Map()) {
  return function has(key) {
    return LOCALES.has(key)
  }
}

function initMapWrapper(LOCALES = new Map()) {
  return function initMap(iterable) {
    // IE11 does not have 'new Map(iterable)' support.
    // Fallback/Pony-fill to manual setting in all environments.
    iterable.forEach(function(keyLocalePair) {
      LOCALES.set.apply(LOCALES, keyLocalePair)
    })
  }
}

function serializeFunction(fn = function() {}) {
  return fn.toString().replace(/\n\s+\/\/.+/g, '')
}

module.exports = {
  hasLocaleWrapper,
  initMapWrapper,
  translateWrapper,
  generateModule(inflatedLocalesMap) {
    // Browser and NodeJS compatible module
    // use ES5 syntax
    return `'use strict';
(function () {
  ${serializeFunction(translateWrapper())}
  translate.has = ${serializeFunction(hasLocaleWrapper())}
  var FIELDS=${FIELDS.toString()}
  var LOCALES=new Map()
  initMap(${JSON.stringify(Array.from(inflatedLocalesMap.entries()))})
  ${serializeFunction(initMapWrapper())}
  if (typeof window !== 'undefined') {
    window.t = window.translate = translate
  } else {
    module.exports = translate
  }
})()
`
  }
}
