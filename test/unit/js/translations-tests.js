require('chai').should()
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const modulePath = path.join(__dirname, '../../../app/js/translations.js')
const { expect } = require('chai')
const sinon = require('sinon')

describe('translations', function() {
  beforeEach(function() {
    this.translationsModule = SandboxedModule.require(modulePath, {
      globals: {
        process
      }
    })

    const opts = {
      subdomainLang: {
        www: { lngCode: 'en', url: 'https://www.sharelatex.com' },
        fr: { lngCode: 'fr', url: 'https://fr.sharelatex.com' },
        da: { lngCode: 'da', url: 'https://da.sharelatex.com' }
      }
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
      redirect: sinon.stub()
    }
  })

  describe('setLangBasedOnDomainMiddlewear', function() {
    it('should set the lang to french if the domain is fr', function(done) {
      this.req.headers.host = 'fr.sharelatex.com'
      this.translations.expressMiddlewear(this.req, this.req, () => {
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
        this.translations.expressMiddlewear(this.req, this.req, () => {
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
        this.translations.expressMiddlewear(this.req, this.req, () => {
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
    })
  })
})
