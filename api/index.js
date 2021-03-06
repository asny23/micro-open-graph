const { URL } = require('url')
const { send } = require('micro')
const got = require('got')
const cache = require('memory-cache')

const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-logo')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')(),
  require('metascraper-logo-favicon')()
])

const TWENTY_FOUR_HOURS = 86400000
const ALLOWED_ORIGIN = []
if(process.env.ALLOWED_ORIGIN) {
  process.env.ALLOWED_ORIGIN.split(' ').forEach(ao => ALLOWED_ORIGIN.push(new RegExp(ao)))
}

module.exports = async (req, res) => {
  if(ALLOWED_ORIGIN.length) {
    const reducer = (accumulator, currentValue) => accumulator || currentValue.test(req.headers.origin)
    if(ALLOWED_ORIGIN.reduce(reducer, false)) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
    } else {
      return send(res, 400, { message: 'Origin not allowed.' })
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }

  const { searchParams: params } = new URL(req.url, `http://${req.headers.host}`)
  const url = params.get('url')
  if (!url) return send(res, 400, { message: 'Please supply an URL to be scraped in the url query parameter.' })

  const cachedResult = cache.get(url)
  if (cachedResult) return send(res, 200, cachedResult)

  let statusCode, data
  try {
    const { body: html } = await got(url)
    data = await metascraper({ url, html })
    statusCode = 200
  } catch (err) {
    console.log(err)
    statusCode = 400
    data = { message: `Scraping the open graph data from "${url}" failed.`, suggestion: 'Make sure your URL is correct and the webpage has open graph data, meta tags or twitter card data.' }
  }

  send(res, statusCode, data)
  // Cache results for 24 hours
  cache.put(url, data, TWENTY_FOUR_HOURS)
}
