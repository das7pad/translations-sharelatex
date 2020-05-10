require('chai').should()
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(__dirname, '../../../index.js')
const { expect } = require('chai')
const sinon = require('sinon')

describe('translations', function() {
  const subdomainLang = Object.fromEntries(
    ['cn', 'da', 'de', 'es', 'fr', 'pt', 'ru']
      .map(lang => {
        return [
          lang,
          {
            lngCode: lang,
            url: `https://${lang}.sharelatex.com`
          }
        ]
      })
      .concat([['www', { lngCode: 'en', url: 'https://www.sharelatex.com' }]])
  )

  beforeEach(function() {
    this.translationsModule = SandboxedModule.require(modulePath, {
      globals: {
        process
      }
    })

    const opts = {
      subdomainLang
    }
    this.translations = this.translationsModule.setup(opts)
    this.req = {
      headers: {
        'accept-language': ''
      },
      originalUrl: '/login',
      query: {},
      session: {},
      url: '/login'
    }
    this.res = {
      locals: {},
      redirect: sinon.stub()
    }
    this.appName = `Overleaf Dev (${Math.random()})`

    // taken from web/app/src/infrastructure/ExpressLocals.js
    this.res.locals.translate = (key, vars) => {
      vars = vars || {}
      vars.appName = this.appName
      return this.req.i18n.translate(key, vars)
    }
  })

  describe('i18n.translate', function() {
    function cloneVars(vars) {
      // i18n adds the used language as `.lng` into the vars when there is no
      //  exact locale for a given language available. this in turn corrupts
      //  following translations with the same context -- they are using the
      //  `.lng` as language:
      // vars={}; translate('ENOENT', vars); vars.lng === 'someLang'
      if (typeof vars !== 'object') return vars
      return JSON.parse(JSON.stringify(vars))
    }
    function getLocale(lang, key) {
      return require(`../../../locales/${lang}.json`)[key]
    }
    function getLocaleWithFallback(lang, key) {
      return getLocale(lang, key) || getLocale('en', key) || ''
    }

    beforeEach(function() {
      this.mockedTranslate = (lang, key, vars) => {
        const bareLocale = getLocaleWithFallback(lang, key)
        vars = vars || {}
        vars.appName = this.appName
        return Object.entries(vars).reduce((translated, keyValue) => {
          return translated.replace(`__${keyValue[0]}__`, keyValue[1])
        }, bareLocale)
      }
    })
    ;[
      {
        desc: 'when the locale is plain text',
        key: 'email'
      },
      {
        desc: 'when there is html in the locale',
        key: 'track_changes_is_on'
      },
      {
        desc: 'when there are additional variables',
        key: 'register_to_edit_template',
        vars: { templateName: `[${Math.random()}]` }
      },
      {
        desc: 'when there is html in the vars',
        key: 'click_here_to_view_sl_in_lng',
        vars: { lngName: `<strong>${Math.random()}</strong>` }
      }
    ].forEach(testSpec => {
      describe(testSpec.desc, function() {
        Object.values(subdomainLang).forEach(langSpec => {
          it(`should translate for lang=${langSpec.lngCode}`, function(done) {
            this.req.headers.host = new URL(langSpec.url).host
            this.translations.expressMiddlewear(this.req, this.res, () => {
              this.translations.setLangBasedOnDomainMiddlewear(
                this.req,
                this.res,
                () => {
                  const actual = this.res.locals.translate(
                    testSpec.key,
                    cloneVars(testSpec.vars)
                  )
                  const expected = this.mockedTranslate(
                    langSpec.lngCode,
                    testSpec.key,
                    cloneVars(testSpec.vars)
                  )
                  actual.should.equal(expected)
                  done()
                }
              )
            })
          })
        })
      })
    })
  })

  describe('setLangBasedOnDomainMiddlewear', function() {
    it('should set the lang to french if the domain is fr', function(done) {
      this.req.headers.host = 'fr.sharelatex.com'
      this.translations.expressMiddlewear(this.req, this.res, () => {
        this.translations.setLangBasedOnDomainMiddlewear(
          this.req,
          this.res,
          () => {
            this.req.lng.should.equal('fr')
            done()
          }
        )
      })
    })

    describe('showUserOtherLng', function() {
      it('should set it to true if the languge based on headers is different to lng', function(done) {
        this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        this.req.headers.host = 'fr.sharelatex.com'
        this.translations.expressMiddlewear(this.req, this.res, () => {
          this.translations.setLangBasedOnDomainMiddlewear(
            this.req,
            this.res,
            () => {
              this.req.showUserOtherLng.should.equal('da')
              done()
            }
          )
        })
      })

      it('should not set prop', function(done) {
        this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        this.req.headers.host = 'da.sharelatex.com'
        this.translations.expressMiddlewear(this.req, this.res, () => {
          this.translations.setLangBasedOnDomainMiddlewear(
            this.req,
            this.res,
            () => {
              expect(this.req.showUserOtherLng).to.not.exist
              done()
            }
          )
        })
      })
    })

    describe('getTranslationUrl', function() {
      describe('with not query params', function() {
        beforeEach(function(done) {
          this.req.originalUrl = '/login'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should set the setGlobalLng query param', function() {
          expect(
            this.res.locals.getTranslationUrl({
              lngCode: 'da',
              url: 'https://da.sharelatex.com'
            })
          ).to.equal('https://da.sharelatex.com/login')
        })
      })
      describe('with additional query params', function() {
        beforeEach(function(done) {
          this.req.originalUrl = '/login?someKey=someValue'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should preserve the query param', function() {
          expect(
            this.res.locals.getTranslationUrl({
              lngCode: 'da',
              url: 'https://da.sharelatex.com'
            })
          ).to.equal('https://da.sharelatex.com/login?someKey=someValue')
        })
      })
    })

    describe('singleDomainMultipleLng', function() {
      beforeEach(function() {
        const opts = {
          subdomainLang: {
            www: { lngCode: 'en', url: 'https://www.sharelatex.com' },
            fr: { lngCode: 'fr', url: 'https://www.sharelatex.com' },
            da: { lngCode: 'da', url: 'https://www.sharelatex.com' }
          }
        }
        this.translations = this.translationsModule.setup(opts)
      })

      describe('when nothing is set', function() {
        beforeEach(function(done) {
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should not set a lng in the session', function() {
          expect(this.req.session.lng).to.not.exist
        })
        it('should default to english', function() {
          expect(this.req.lng).to.equal('en')
        })
        it('should not suggest anything', function() {
          expect(this.req.showUserOtherLng).to.not.exist
        })
      })

      describe('when the browser sends hints', function() {
        beforeEach(function(done) {
          this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should not set a lng in the session', function() {
          expect(this.req.session.lng).to.not.exist
        })
        it('should default to english', function() {
          expect(this.req.lng).to.equal('en')
        })
        it('should suggest the language from the browser hint', function() {
          expect(this.req.showUserOtherLng).to.equal('da')
        })
      })

      describe('when session.lng is set and the browser sends other hints', function() {
        beforeEach(function(done) {
          this.req.session.lng = 'fr'
          this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should preserve lng=fr in the session', function() {
          expect(this.req.session.lng).to.equal('fr')
        })
        it('should set lng to fr', function() {
          expect(this.req.lng).to.equal('fr')
        })
        it('should suggest the language from the browser hint', function() {
          expect(this.req.showUserOtherLng).to.equal('da')
        })
      })

      describe('when session.lng is set and the browser sends the same hints', function() {
        beforeEach(function(done) {
          this.req.session.lng = 'fr'
          this.req.headers['accept-language'] = 'fr, en-gb;q=0.8, en;q=0.7'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(
              this.req,
              this.res,
              done
            )
          })
        })
        it('should preserve lng=fr in the session', function() {
          expect(this.req.session.lng).to.equal('fr')
        })
        it('should set lng to fr', function() {
          expect(this.req.lng).to.equal('fr')
        })
        it('should not suggest any other language', function() {
          expect(this.req.showUserOtherLng).to.not.exist
        })
      })

      function checkLang(lng) {
        describe(`setGlobalLng=${lng}`, function() {
          beforeEach(function(done) {
            this.req.query.setGlobalLng = lng
            this.translations.expressMiddlewear(this.req, this.res, () => {
              this.translations.setLangBasedOnDomainMiddlewear(
                this.req,
                this.res
              )
              done()
            })
          })
          it('should send the user back', function() {
            this.res.redirect.calledWith('/login').should.equal(true)
          })
          it('should set the requested lang permanent', function() {
            this.req.session.lng.should.equal(lng)
          })
        })
      }
      checkLang('da')
      checkLang('fr')

      describe('with additional query params', function() {
        beforeEach(function(done) {
          this.req.originalUrl = '/login?setGlobalLng=da&someKey=someValue'
          this.req.query.setGlobalLng = 'da'
          this.translations.expressMiddlewear(this.req, this.res, () => {
            this.translations.setLangBasedOnDomainMiddlewear(this.req, this.res)
            done()
          })
        })
        it('should send the user back and preserve the query param', function() {
          this.res.redirect
            .calledWith('/login?someKey=someValue')
            .should.equal(true)
        })
        it('should set the requested lang permanent', function() {
          this.req.session.lng.should.equal('da')
        })
      })

      describe('getTranslationUrl', function() {
        describe('with not query params', function() {
          beforeEach(function(done) {
            this.req.originalUrl = '/login'
            this.translations.expressMiddlewear(this.req, this.res, () => {
              this.translations.setLangBasedOnDomainMiddlewear(
                this.req,
                this.res,
                done
              )
            })
          })
          it('should set the setGlobalLng query param', function() {
            expect(
              this.res.locals.getTranslationUrl({
                lngCode: 'da',
                url: 'https://www.sharelatex.com'
              })
            ).to.equal('https://www.sharelatex.com/login?setGlobalLng=da')
          })
        })
        describe('with additional query params', function() {
          beforeEach(function(done) {
            this.req.originalUrl = '/login?someKey=someValue'
            this.translations.expressMiddlewear(this.req, this.res, () => {
              this.translations.setLangBasedOnDomainMiddlewear(
                this.req,
                this.res,
                done
              )
            })
          })
          it('should preserve the query param', function() {
            expect(
              this.res.locals.getTranslationUrl({
                lngCode: 'da',
                url: 'https://www.sharelatex.com'
              })
            ).to.equal(
              'https://www.sharelatex.com/login?someKey=someValue&setGlobalLng=da'
            )
          })
        })
      })
    })
  })
})
