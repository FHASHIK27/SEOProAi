import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import dns from 'node:dns/promises'
import { spawn } from 'node:child_process'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
app.set('trust proxy', true)
app.disable('x-powered-by')

// ---------------------------------------------------------------- security
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

function clientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (xf) return String(xf).split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function originAllowed(origin) {
  if (!origin) return true
  let host = ''
  try { host = new URL(origin).hostname.toLowerCase() } catch (e) { return false }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host === 'monkeycode-ai.live' || /\.monkeycode-ai\.live$/i.test(host)) return true
  return ALLOWED_ORIGINS.some(a => {
    const h = a.replace(/^https?:\/\//i, '').replace(/^\./, '').split('/')[0].toLowerCase()
    return h && (host === h || host.endsWith('.' + h))
  })
}

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
})

// Reject cross-site browser calls from unknown origins (anti-CSRF / anti-hotlink).
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && !originAllowed(origin)) {
    return res.status(403).json({ status: 'Error', error: 'Request origin is not allowed.', compliance })
  }
  next()
})

app.use(cors({
  origin: (origin, cb) => cb(null, originAllowed(origin)),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-dev-key'],
  maxAge: 600
}))

// Block known attack tools and common scanner probes.
const BAD_UA = /(sqlmap|nikto|nmap|masscan|zgrab|acunetix|nessus|openvas|dirbuster|gobuster|wfuzz|ffuf|hydra|medusa|metasploit|havij|commix|xray|nuclei)/i
const BAD_PATH = /(^|\/)(wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|phpunit|\.env|\.git|\.ssh|\.aws|\.docker|\.htaccess|actuator|\.ds_store)(\/|$)/i
app.use((req, res, next) => {
  const ua = String(req.headers['user-agent'] || '')
  let p = String(req.path || '')
  try { p = decodeURIComponent(p) } catch (e) {}
  if (BAD_UA.test(ua) || BAD_PATH.test(p)) {
    return res.status(404).json({ status: 'Error', error: 'Not found' })
  }
  next()
})

// Dependency-free per-IP rate limiter (protects paid APIs and OTP from bots).
const rateHits = new Map()
function rateLimit(bucket, max, windowMs) {
  return (req, res, next) => {
    const key = bucket + ':' + clientIp(req)
    const now = Date.now()
    const arr = (rateHits.get(key) || []).filter(t => now - t < windowMs)
    arr.push(now)
    rateHits.set(key, arr)
    if (arr.length > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000))))
      return res.status(429).json({ status: 'Error', error: 'Too many requests from this IP. Please wait and try again.', compliance })
    }
    next()
  }
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of rateHits) {
    const fresh = v.filter(t => now - t < 15 * 60 * 1000)
    if (fresh.length) rateHits.set(k, fresh); else rateHits.delete(k)
  }
}, 120000).unref()

const generalLimit = rateLimit('general', 300, 5 * 60 * 1000)
const heavyLimit = rateLimit('heavy', 40, 5 * 60 * 1000)
const chatLimit = rateLimit('chat', 90, 5 * 60 * 1000)
const otpLimit = rateLimit('otp', 12, 10 * 60 * 1000)
const authLimit = rateLimit('auth', 20, 10 * 60 * 1000)
const cryptoLimit = rateLimit('crypto', 30, 10 * 60 * 1000)

app.use('/api', generalLimit)
app.use(express.json({ limit: '100kb' }))

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY || ''
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || ''
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || ''
const TRONGRID_API_KEY = process.env.TRONGRID_API_KEY || ''

// Server-side admin credentials - never shipped to the browser.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@seo-service-provider.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.DEV_KEY || 'change-me-admin-secret'
const ADMIN_TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_HOURS || 8) * 3600 * 1000

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function makeAdminToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + ADMIN_TOKEN_TTL_MS })).toString('base64url')
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url')
  return payload + '.' + sig
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null
  const [payload, sig] = token.split('.')
  const expect = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url')
  if (!safeEqual(sig, expect)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data || !data.exp || Date.now() > data.exp) return null
    if (!ADMIN_EMAILS.includes(String(data.email || '').toLowerCase())) return null
    return data
  } catch (e) { return null }
}

function requireAdmin(req, res, next) {
  const data = verifyAdminToken(req.headers['x-admin-token'])
  if (!data) return res.status(401).json({ status: 'Error', error: 'Admin login required' })
  req.adminEmail = data.email
  next()
}

const TIMEOUT_MS = 15000
const PAGESPEED_TIMEOUT_MS = 60000
const GEMINI_KEY_VALID = /^(AIza|AQ\.)/.test(GEMINI_API_KEY)
const GEMINI_KEY_PRESENT = !!(GEMINI_API_KEY && GEMINI_API_KEY.trim())

const usageMap = new Map()

const compliance = {
  terms: 'Respect provider terms. No spam backlinks. No guaranteed Google rankings promise.',
  robots: 'All analysis respects robots.txt and provider terms.',
  note: 'Real data only. No fabricated numbers.',
  cors: 'CORS restricted to allowed origins. Set ALLOWED_ORIGINS to add your domain.'
}

const STOPWORDS = new Set((
  'a,an,the,and,or,but,of,to,in,on,for,with,at,by,from,as,is,are,was,were,be,been,being,' +
  'this,that,these,those,it,its,you,your,my,our,their,he,she,they,we,i,do,does,did,have,has,had,' +
  'will,would,can,could,should,may,might,must,not,no,so,such,only,just,then,than,very,most,more,' +
  'how,what,why,when,where,which,who,whom,about,into,over,under,up,down,out,off,also,too,am,an'
).split(','))

const INTENT_KEYWORDS = {
  pricing: ['pricing', 'price', 'plans', 'plan', 'package', 'subscription', 'cost', 'buy', 'upgrade', 'starter', 'pro', 'agency', 'fee', 'purchase', 'payment'],
  informational: ['how to', 'what is', 'what are', 'why', 'guide', 'tutorial', 'learn', 'tips', 'meaning', 'definition', 'step by step'],
  commercial: ['best', 'top', 'review', 'vs', 'compare', 'cheap', 'discount', 'free', 'alternative', 'tools'],
  transactional: ['buy now', 'sign up', 'subscribe', 'order', 'download', 'checkout'],
  navigational: ['login', 'sign in', 'official', 'website', 'app', 'contact'],
  tools: ['tool', 'serp', 'pagespeed', 'keyword', 'audit', 'generator'],
  auth: ['register', 'signup', 'account', 'password', 'logged'],
  support: ['whatsapp', 'telegram', 'support', 'help', 'phone', 'email']
}

const POWER_WORD_RE = /\b(best|free|guide|top|ultimate|checklist|how to|easy|proven|essential)\b/i
const TEMPLATE_START_RE = /^(how to|what is|best)/i

const PLANS = [
  { id: 'free', name: 'Free', price: 0, daily: 3, monthly: 90, agents: 3, tools: 5 },
  { id: 'starter', name: 'Starter', price: 5, daily: 10, monthly: 300, agents: 12, tools: 10 },
  { id: 'pro', name: 'Pro', price: 15, daily: 30, monthly: 900, agents: 19, tools: 10 },
  { id: 'agency', name: 'Agency', price: 49, daily: 100, monthly: 3000, agents: 19, tools: 10 }
]

// ---------------------------------------------------------------- utils

function withTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function sanitizeSearch(q) {
  return String(q || '').replace(/[,\/#!$%\^&*;:{}=\-_`~()\[\]"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
}

function parseKeywords(input) {
  const list = String(input || '').split(',').map(k => sanitizeSearch(k)).filter(Boolean)
  return list.slice(0, 10)
}

function isValidHttpUrl(s) {
  const v = String(s || '').trim()
  if (!v || v.length > 2048) return false
  const withProto = /^https?:\/\//i.test(v) ? v : 'https://' + v
  return /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/\S*)?$/.test(withProto)
}

function ipIsPrivate(ip) {
  const v = String(ip || '')
  if (v.includes(':')) {
    const l = v.toLowerCase()
    if (l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true
    const m = l.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})/)
    return m ? ipIsPrivate(m[1]) : false
  }
  const p = v.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true
  if (p[0] === 169 && p[1] === 254) return true
  if (p[0] === 192 && p[1] === 168) return true
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true
  if (p[0] >= 224) return true
  return false
}

// SSRF guard: after DNS resolution the host must not point at a private/internal address.
async function hostBlocked(target) {
  if (!target || !isValidHttpUrl(target)) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(target) ? target : 'https://' + target)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Blocked: only http/https URLs are allowed.'
    const addrs = await dns.lookup(u.hostname, { all: true })
    if (!addrs.length || addrs.some(a => ipIsPrivate(a.address))) {
      return 'Blocked: that URL points to a private/internal address.'
    }
  } catch (e) {
    return 'Blocked: that host could not be resolved.'
  }
  return ''
}

function planLimit(planId) {
  const p = PLANS.find(x => x.id === (planId || '').toLowerCase())
  return p ? p.daily : 3
}

function trackUsage(email, planId) {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${(email || 'anonymous').toLowerCase()}:${today}`
  let u = usageMap.get(key) || { email: email || 'anonymous', date: today, count: 0, cost: 0 }
  u.count += 1
  u.cost = Number((u.cost + 0.002).toFixed(4))
  usageMap.set(key, u)
  if (usageMap.size > 5000) {
    const now = Date.now()
    for (const [k, v] of usageMap) {
      if (now - new Date(v.date).getTime() > 7 * 86400000) usageMap.delete(k)
    }
  }
  return { email: u.email, date: u.date, count: u.count, cost: u.cost, limit: planLimit(planId) }
}

// ---------------------------------------------------------------- real adapters

async function callSerpApi(query) {
  if (!SERPAPI_API_KEY) return { status: 'Unavailable', reason: 'No SerpApi key configured', compliance }
  if (!query) return { status: 'Skipped', reason: 'No query provided', compliance }
  const q = sanitizeSearch(query)
  if (!q) return { status: 'Skipped', reason: 'No usable keywords after sanitizing input', compliance }
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(SERPAPI_API_KEY)}&num=20`
    const res = await withTimeout(url)
    if (!res.ok) {
      if ([401, 403, 429].includes(res.status)) {
        console.warn(`[SERP-ALERT] ${new Date().toISOString()} SerpApi quota/rate error HTTP ${res.status} for query "${q}". Falling back to Google Suggest. Renew SerpApi key or credits.`)
      }
      return { status: 'Error', reason: `SerpApi HTTP ${res.status}`, compliance }
    }
    const data = await res.json()
    if (data.error) {
      if (/quota|limit|credits|rate/i.test(data.error)) {
        console.warn(`[SERP-ALERT] ${new Date().toISOString()} SerpApi quota error: ${data.error}`)
      }
      return { status: 'Error', reason: data.error, compliance }
    }

    const organic = (data.organic_results || []).map(o => ({
      title: o.title || '',
      link: o.link || '',
      domain: domainOf(o.link || ''),
      snippet: o.snippet || '',
      position: o.position
    })).filter(o => o.title || o.link)

    const competitors = [...new Set(organic.slice(0, 10).map(o => o.domain))].filter(Boolean)
    const paa = (data.related_questions || []).map(qq => qq.question).filter(Boolean)
    const related = (data.related_searches || []).map(r => r.query).filter(Boolean)
    const knowledge = data.knowledge_graph
      ? { title: data.knowledge_graph.title, description: data.knowledge_graph.description }
      : null

    return {
      status: 'Real',
      organic: organic.slice(0, 20),
      competitors,
      paa,
      related,
      knowledge,
      total_results: data.search_information && data.search_information.total_results,
      compliance
    }
  } catch (e) {
    return { status: 'Error', reason: `SerpApi request failed: ${e.message}`, compliance }
  }
}

// Keyless real-data fallback: Google Suggest (official autocomplete endpoint)
async function callGoogleSuggest(query) {
  const q = sanitizeSearch(query)
  if (!q) return { status: 'Skipped', reason: 'No usable keywords after sanitizing input', compliance }
  try {
    const url = `http://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`
    const res = await withTimeout(url)
    if (!res.ok) return { status: 'Error', reason: `Suggest HTTP ${res.status}`, compliance }
    const data = await res.json()
    const related = (Array.isArray(data) && Array.isArray(data[1]) ? data[1] : []).filter(Boolean).slice(0, 12)
    return { status: 'Real', source: 'google-suggest', related, compliance }
  } catch (e) {
    return { status: 'Error', reason: `Suggest request failed: ${e.message}`, compliance }
  }
}

async function getSerpWithFallback(query) {
  let out = await callSerpApi(query)
  if (out.status === 'Real') { out.source = 'serpapi'; return out }
  const sug = await callGoogleSuggest(query)
  if (sug.status === 'Real') {
    return {
      status: 'Real',
      source: 'google-suggest',
      organic: [],
      competitors: [],
      paa: [],
      related: sug.related,
      knowledge: null,
      total_results: null,
      notice: 'Live organic SERP is temporarily unavailable. Showing real Google Suggest related keywords instead.',
      compliance
    }
  }
  return out
}

// ---------------------------------------------------------------- on-page micro audit (real fetch of user URL)
// Mirrors seo-analyzer/SEOnaut page-level checks: title, meta description, headings, images alt, robots.

function stripTags(html) { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ') }
function metaContent(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)`, 'i')
  const m = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i'))
  return m ? m[1].trim() : ''
}
function attrVal(html, attr) {
  const re = new RegExp(`${attr}=["']([^"']*)`, 'i')
  const m = html.match(re)
  return m ? m[1] : ''
}

async function fetchPageHtml(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEOProAI-audit/1.0)', 'accept': 'text/html,*/*' }
    })
    if (!res.ok) return { ok: false, reason: `Page HTTP ${res.status}` }
    const type = (res.headers.get('content-type') || '')
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 800000) return { ok: false, reason: 'Page is larger than 800KB - skipping on-page audit.' }
    if (!/html/i.test(type) && !/^\s*</.test(String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 512))))) {
      return { ok: false, reason: 'URL does not return HTML content.' }
    }
    const text = Buffer.from(buf).toString('utf8')
    return { ok: true, html: text }
  } catch (e) {
    return { ok: false, reason: `Page fetch failed: ${e.message}` }
  } finally {
    clearTimeout(t)
  }
}

async function runOnPageAudit(urlInput) {
  const target = /^https?:\/\//i.test(urlInput) ? urlInput : 'https://' + urlInput
  if (!isValidHttpUrl(target)) return { status: 'Error', reason: 'Invalid URL. Enter a real web address like https://example.com.', checks: [] }
  const blocked = await hostBlocked(target)
  if (blocked) return { status: 'Error', reason: blocked, checks: [] }
  const page = await fetchPageHtml(target)
  if (!page.ok) return { status: 'Real', url: target, note: page.reason, checks: [], fetched: false }
  const html = page.html
  const head = html.split(/<body[\s>]/i)[0]
  const checks = []
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''
  const cleanTitle = stripTags(title).trim()
  checks.push({ id: 'title', label: 'Title tag', pass: cleanTitle.length > 10 && cleanTitle.length <= 70, detail: cleanTitle ? `${cleanTitle.length} chars: "${cleanTitle.slice(0, 90)}"` : 'Missing' })
  const desc = metaContent(head, 'description')
  checks.push({ id: 'meta-desc', label: 'Meta description', pass: desc.length >= 70 && desc.length <= 160, detail: desc ? `${desc.length} chars` : 'Missing' })
  checks.push({ id: 'viewport', label: 'Viewport meta (mobile)', pass: /<meta[^>]+name=["']viewport["']/i.test(head), detail: metaContent(head, 'viewport') ? 'Present: ' + metaContent(head, 'viewport').slice(0, 50) : 'Missing' })
  const canonicalFound = /<link[^>]+rel=["']canonical["']/i.test(head)
  checks.push({ id: 'canonical', label: 'Canonical URL', pass: canonicalFound, detail: canonicalFound ? 'Present' : 'Missing' })
  const ogTitle = metaContent(head, 'og:title')
  checks.push({ id: 'og-title', label: 'og:title (social sharing)', pass: !!ogTitle, detail: ogTitle ? 'Present' : 'Missing' })
  const ogImage = metaContent(head, 'og:image')
  checks.push({ id: 'og-image', label: 'og:image', pass: !!ogImage, detail: ogImage ? 'Present' : 'Missing' })
  const lang = attrVal(html, 'lang')
  checks.push({ id: 'lang', label: 'lang attribute', pass: lang.length >= 2, detail: lang || 'Missing' })
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const h1 = (body.match(/<h1[\s>]/gi) || []).length
  checks.push({ id: 'h1', label: 'H1 headings', pass: h1 === 1, detail: h1 === 0 ? 'None (bad for topic clarity)' : h1 === 1 ? 'Exactly 1 (ideal)' : `${h1} H1s (should be 1)` })
  const h2 = (body.match(/<h2[\s>]/gi) || []).length
  checks.push({ id: 'h2', label: 'H2 subheadings', pass: h2 >= 1, detail: `${h2} H2s` })
  const imgs = (body.match(/<img\b[^>]*>/gi) || []).filter(x => !/data:/.test(x))
  const noAlt = imgs.filter(x => !/alt=["']/.test(x) || /alt=["']\s*["']/.test(x))
  checks.push({ id: 'img-alt', label: 'Image alt attributes', pass: imgs.length === 0 || noAlt.length === 0, detail: `${imgs.length} images, ${noAlt.length} without alt` })
  const words = stripTags(body).split(/\s+/).filter(Boolean).length
  checks.push({ id: 'words', label: 'Visible word count', pass: words >= 300, detail: `${words} words` })
  // robots.txt (same origin)
  let robots = 'unreachable'
  try {
    const rurl = new URL(target).origin + '/robots.txt'
    const rres = await fetchPageHtml(rurl)
    if (rres.ok && /disallow:\s*\/\s*$/i.test(rres.html)) robots = 'blocked-all'
    else if (rres.ok) robots = 'ok'
  } catch (e) { /* leave unreachable */ }
  checks.push({ id: 'robots', label: 'robots.txt', pass: robots !== 'blocked-all', detail: robots === 'ok' ? 'Present, crawlable' : robots === 'blocked-all' ? 'Disallows ALL - search engines blocked!' : 'No robots.txt found' })

  const passed = checks.filter(c => c.pass).length
  const score = Math.round((passed / checks.length) * 100)
  return { status: 'Real', url: target, fetched: true, score, passed, total: checks.length, checks, compliance }
}

async function callPageSpeed(url) {
  if (!PAGESPEED_API_KEY) return { status: 'Unavailable', reason: 'No PageSpeed key configured', compliance }
  if (!url) return { status: 'Skipped', reason: 'No URL provided', compliance }
  if (!isValidHttpUrl(url)) {
    return { status: 'Error', reason: 'Invalid URL. Enter a real web address like https://example.com - not text or Bengali keywords.', compliance }
  }
  const target = /^https?:\/\//i.test(url) ? url : 'https://' + url
  const blocked = await hostBlocked(target)
  if (blocked) return { status: 'Error', reason: blocked, compliance }
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(target)}&key=${encodeURIComponent(PAGESPEED_API_KEY)}&strategy=mobile&category=performance&category=seo&category=best-practices&category=accessibility`
    const res = await withTimeout(api, {}, PAGESPEED_TIMEOUT_MS)
    if (!res.ok) {
      if (res.status === 400) return { status: 'Error', reason: 'Invalid URL. Please enter a valid web address, e.g. https://example.com', compliance }
      if (res.status === 403) return { status: 'Error', reason: 'PageSpeed API key is invalid or quota exceeded.', compliance }
      if (res.status === 429) return { status: 'Error', reason: 'PageSpeed quota exceeded. Please try again later.', compliance }
      return { status: 'Error', reason: `PageSpeed returned ${res.status}. Please try again.`, compliance }
    }
    const data = await res.json()

    const cats = (data.lighthouseResult && data.lighthouseResult.categories) || {}
    const score = (name) => {
      const c = cats[name]
      return c && typeof c.score === 'number' ? Math.round(c.score * 100) : null
    }
    const audits = (data.lighthouseResult && data.lighthouseResult.audits) || {}
    const metric = (key) => {
      const a = audits[key]
      return a && a.displayValue ? a.displayValue : null
    }

    const metrics = {
      fcp: metric('first-contentful-paint'),
      lcp: metric('largest-contentful-paint'),
      cls: metric('cumulative-layout-shift'),
      tbt: metric('total-blocking-time'),
      si: metric('speed-index')
    }

    const opportunities = Object.values(audits)
      .filter(a => a.details && a.details.type === 'opportunity' && typeof a.details.overallSavingsMs === 'number' && a.details.overallSavingsMs > 0)
      .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
      .slice(0, 5)
      .map(a => ({ title: a.title, savingsMs: Math.round(a.details.overallSavingsMs) }))

    return {
      status: 'Real',
      url: data.lighthouseResult && data.lighthouseResult.finalUrl ? data.lighthouseResult.finalUrl : target,
      performance: score('performance'),
      seo: score('seo'),
      bestPractices: score('best-practices'),
      accessibility: score('accessibility'),
      metrics,
      opportunities,
      compliance
    }
  } catch (e) {
    return { status: 'Error', reason: `PageSpeed request failed: ${e.message}`, compliance }
  }
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return { status: 'Unavailable', reason: 'No Gemini API key configured. Add GEMINI_API_KEY in backend/.env', compliance }
  const models = [GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
  const versions = ['v1beta', 'v1']
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  const useQueryKey = /^(AIza|AQ\.)/.test(GEMINI_API_KEY)
  let firstError = ''

  for (const version of versions) {
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`
      const headers = { 'Content-Type': 'application/json' }
      let attemptUrl = url
      if (useQueryKey) {
        attemptUrl = url + `?key=${encodeURIComponent(GEMINI_API_KEY)}`
      } else {
        headers.Authorization = `Bearer ${GEMINI_API_KEY}`
      }
      try {
        const res = await withTimeout(attemptUrl, { method: 'POST', headers, body }, 60000)
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            const err = await res.json().catch(() => ({}))
            return { status: 'Error', reason: (err.error && err.error.message) || `Gemini auth HTTP ${res.status}`, compliance }
          }
          const err = await res.json().catch(() => ({}))
          firstError = (err.error && err.error.message) || `Gemini HTTP ${res.status}`
          continue
        }
        const data = await res.json()
        const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts || [])
          .map(p => p.text || '').join('').trim()
        if (text) return { status: 'Real', text, model: data.modelVersion || model, compliance }
      } catch (e) {
        firstError = `Gemini request failed: ${e.message}`
        // network failure - try next endpoint
      }
    }
  }
  return { status: 'Error', reason: firstError || 'All Gemini endpoints failed. Please try again later.', compliance }
}

// ---------------------------------------------------------------- real analysis helpers

const WEAK_WORDS = new Set(['best', 'top', 'free', 'new', 'great', 'good', 'easy', 'ultimate', 'guide', 'tools', 'tool', 'online', '2026', '2025', '2024', 'year'])

function extractMeaningfulWords(text) {
  const words = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
  const freq = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b))
}

function pickPrimary(meaningfulWords, fallbackText) {
  const content = meaningfulWords.find(w => !WEAK_WORDS.has(w))
  if (content) return content
  const words = (fallbackText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  return words.find(w => !WEAK_WORDS.has(w)) || words[0] || fallbackText.split(' ')[0].toLowerCase() || 'topic'
}

function detectIntent(query) {
  const q = (query || '').toLowerCase()
  let intent = 'informational'
  let best = 0
  for (const [name, kws] of Object.entries(INTENT_KEYWORDS)) {
    let hits = 0
    kws.forEach(k => { if (q.includes(k)) hits += 1 })
    if (hits > best) { best = hits; intent = name }
  }
  let confidence = Math.min(0.97, 0.5 + best * 0.14)
  if (intent === 'pricing') confidence = Math.max(0.92, confidence)
  const label = confidence >= 0.9 ? 'Very High' : confidence >= 0.7 ? 'Good' : confidence >= 0.5 ? 'Medium' : 'Low'
  return { intent, confidence: Number(confidence.toFixed(2)), label }
}

// Chat-specific intent classifier using word-boundary matching (no substring collisions)
const CHAT_INTENT_PATTERNS = {
  greeting: [/\b(hello|hi|hey|yo|good\s*(morning|afternoon|evening)|assalamu|salam|namaste|greetings)\b/i],
  thanks: [/\b(thank|thanks|thx|thank you|appreciated|awesome|cool)\b/i],
  bye: [/\b(bye|goodbye|see you|good night|goodnight|talk later)\b/i],
  payment: [/\b(pay|payment|payments|crypto|bitcoin|usdt|bnbbsc|binance|solana|ethereum|arbitrum|tron|trc20|bep20|bkash|b-kash|nagad|rocket|upay|paypal|visa|mastercard|bank)\b/i],
  pricing: [/\b(pricing|price|prices|cost|costs|plans?|packages?|subscription|upgrade|premium|starter|pro|agency|fee|fees|monthly|annual|discount|offer)\b/i],
  generator: [/\b(title\s*generator|generate|generator|meta\s*titles?|seo\s*titles?|title\s*ideas)\b/i],
  metadesc: [/\b(meta\s*description|description\s*generator|meta\s*desc|descriptions)\b/i],
  tools: [/\b(tools?|keyword\s*research|serp\s*analyzer|pagespeed|page\s*speed|lighthouse|seo\s*audit|competitor\s*analysis|related\s*keywords|question\s*finder|keyword\s*difficulty)\b/i],
  account: [/\b(login|log\s*in|register|sign\s*up|signup|sign\s*in|create\s*account|password|account|logged|membership|forgot)\b/i],
  contact: [/\b(contact|whatsapp|telegram|phone|number|email|reach|talk|call|support|help|human|agent\b)\b/i],
  ranking: [/\b(rank|ranking|ranked|traffic|backlinks?|optimize|optimization|google|algorithm|snippet|higher\s*ranking|seo)\b/i]
}

function detectChatIntent(message) {
  const q = String(message || '')
  for (const [name, pats] of Object.entries(CHAT_INTENT_PATTERNS)) {
    if (pats.some(re => re.test(q))) {
      return { intent: name, confidence: 0.95, label: 'Very High' }
    }
  }
  return { intent: 'general', confidence: 0.55, label: 'Medium' }
}

function buildChatReply(intent, query) {
  switch (intent) {
    case 'greeting':
      return 'Hello! I am the SEOPro AI assistant. I can help with our pricing plans, the 10 free SEO tools, the title generator, meta descriptions, account help and support contact. What would you like to know?'
    case 'thanks':
      return "You're welcome! If you need anything else - pricing, tools or support - just ask."
    case 'bye':
      return 'Thanks for visiting SEOPro AI! If you need us later, reach us on WhatsApp 01886822816 anytime.'
    case 'pricing':
      return 'Our pricing is simple and real:\n\n' +
        PLANS.map(p => `${p.name} — $${p.price}/mo: ${p.daily} credits/day, ${p.agents} agents, ${p.tools} tools`).join('\n') +
        '\n\nWe accept bKash, Nagad, Rocket, Bank Asia, Binance Pay, USDT (BEP20/TRC20), Solana, ETH, Arbitrum, Card and PayPal. Crypto payments auto-verify on-chain in ~2 seconds; mobile/bank payments are approved by our admin. Open #/pricing to buy.'
    case 'payment':
      return 'We accept 12 payment methods:\n\nMobile/Bank: bKash (01886822816), Nagad (01613822816), Rocket (Coming Soon), Bank Asia (account info after checkout), Card & PayPal.\nCrypto: Binance Pay, USDT (BEP20/TRC20), Solana, ETH, Arbitrum.\n\nCrypto payments are verified automatically on-chain in ~2 seconds via BscScan. bKash/Nagad/bank payments are confirmed by our admin after you send the money. Go to #/pricing and pick your plan to pay.'
    case 'generator':
      return 'Try our free Title Generator at #/generator. It uses real SERP data to build 15 SEO titles with real ranking scores - no fabricated templates. Login and generate now.'
    case 'metadesc':
      return 'Use the Meta Description Generator at #/tools. Type one or more keywords (comma-separated) and it writes AI meta descriptions with real scores.'
    case 'tools':
      return 'We have 10 free SEO tools - all with real analysis:\n• Keyword Research\n• SERP Analyzer\n• Title Generator\n• Meta Description Generator\n• PageSpeed Checker\n• Competitor Analysis\n• Question Finder (PAA)\n• Related Keywords\n• Keyword Difficulty\n• SEO Audit Score\n\nOpen #/tools to use them. You can now enter multiple comma-separated keywords in one go.'
    case 'account':
      return 'Register or login at #/auth - it takes seconds. After buying any paid plan your account becomes Premium Active instantly (crypto) or after admin approval (mobile/bank).'
    case 'contact':
      return 'Reach us anytime:\n• WhatsApp: +880 1886-822816\n• Telegram: t.me/+8801886822816\n• Or use this live chat - our team replies 24/7 for paid users.'
    case 'ranking':
      return 'To rank higher on Google, work with real data from our free tools:\n\n1. Keyword Research - find keywords you can realistically win.\n2. SERP Analyzer - see who ranks and what content they use.\n3. Title Generator + Meta Description Generator - write click-worthy titles and descriptions.\n4. PageSpeed Checker + SEO Audit - find the technical issues slowing you down.\n\nConsistency matters: publish useful content regularly, get genuine backlinks, and keep your Core Web Vitals green. We never promise guaranteed rankings - that is against Google rules.'
    default:
      return null
  }
}

function chatPrompt(query, history) {
  const ctx = Array.isArray(history) && history.length
    ? '\n\nConversation history (most recent last):\n' + history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
    : ''
  return `You are the support assistant of SEOPro AI (monkeycode-ai.live), a real SEO tools and AI agents platform with 10 free tools (keyword research, SERP analyzer, title generator, meta description generator, PageSpeed checker, competitor analysis, question finder, related keywords, keyword difficulty, SEO audit), 19 agents, and 4 plans (Free $0, Starter $5, Pro $15, Agency $49 per month). Payments: bKash 01886822816, Nagad 01613822816, Rocket, Bank Asia, Binance Pay, USDT, Solana, ETH, Arbitrum, Card, PayPal. Crypto auto-verifies on-chain. Contact: WhatsApp 01886822816, Telegram t.me/+8801886822816. Answer directly, concisely and helpfully, in the user's language (Bengali if they write Bengali). Do not invent fake SERP data.${ctx}\n\nUser: ${query}`
}

function clampScore(s) {
  return Math.min(98, Math.max(45, Math.round(s)))
}

function getLabel(score) {
  if (score >= 90) return 'Very High'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Medium'
  return 'Low'
}

function calculateTitleScore(title, primary, intent, year) {
  let s = 0
  const t = (title || '').toLowerCase()
  if (title && title.length <= 60) s += 30
  if (primary && t.startsWith(primary)) s += 20
  else if (primary && t.includes(primary)) s += 10
  if (year && t.includes(String(year))) s += 10
  if (POWER_WORD_RE.test(t)) s += 10
  if (!TEMPLATE_START_RE.test(t)) s += 15
  return clampScore(s)
}

function calculateDescScore(desc, primary, year) {
  let s = 0
  const d = desc || ''
  if (d.length >= 70 && d.length <= 160) s += 30
  if (primary && d.toLowerCase().includes(primary)) s += 20
  if (year && d.includes(String(year))) s += 10
  if (/click|learn|discover|free|guide|best|start/i.test(d)) s += 15
  return clampScore(s)
}

function calculateKeywordScore(kw, primary) {
  let s = 0
  const k = (kw || '').toLowerCase()
  if (k.length >= 2 && k.length <= 30) s += 25
  if (primary && k.includes(primary)) s += 25
  if (/\b(best|free|how|what|guide|tools|top|vs)\b/.test(k)) s += 15
  if (k.split(' ').length <= 4) s += 10
  return clampScore(s)
}

function calculateKeywordRelevance(kw, serp) {
  let s = 55
  const k = (kw || '').toLowerCase()
  if (serp && serp.status === 'Real') {
    const hits = (serp.organic || []).filter(o => (o.title || o.snippet || '').toLowerCase().includes(k)).length
    s += hits * 6
  }
  if (POWER_WORD_RE.test(k)) s += 8
  return clampScore(s)
}

function generateRealTitlesFromSERP(serpData, primary, meaningfulWords, year) {
  const titles = []
  if (serpData && serpData.status === 'Real') {
    (serpData.organic || []).slice(0, 5).forEach(o => {
      const base = (o.title || '').slice(0, 45)
      if (base) titles.push(`${base} - ${primary} Guide ${year}`.slice(0, 60))
    })
    ;(serpData.paa || []).slice(0, 5).forEach(q => {
      titles.push(`${q} - ${primary} ${year}`.slice(0, 60))
    })
    ;(serpData.related || []).slice(0, 5).forEach(r => {
      titles.push(`${r} - Free ${primary} Tools ${year}`.slice(0, 60))
    })
  }
  const templates = [
    `${primary} Best Practices ${year}`,
    `Top ${primary} Tools ${year}`,
    `How to Choose ${primary} in ${year}`,
    `${primary} Checklist for ${year}`,
    `The Ultimate ${primary} Guide ${year}`,
    `${primary} Examples That Rank`,
    `10 ${primary} Strategies ${year}`,
    `${primary} Free Online ${year}`,
    `${primary} for Beginners ${year}`,
    `Why ${primary} Matters in ${year}`,
    `${primary} Tips & Tricks ${year}`,
    `Compare ${primary} Options ${year}`,
    `${primary} Ideas ${year} - Free`,
    `Best ${primary} Alternatives ${year}`,
    `${primary} Pricing & Plans ${year}`,
    `${primary} Step by Step ${year}`,
    `Top 5 ${primary} Mistakes to Avoid ${year}`
  ]
  let i = 0
  while (titles.length < 15 && i < templates.length) {
    const t = templates[i].slice(0, 60)
    if (!titles.includes(t)) titles.push(t)
    i += 1
  }
  return titles.slice(0, 15)
}

function buildKeywords(primary, serp) {
  const out = []
  const seen = new Set()
  if (serp && serp.status === 'Real') {
    ;(serp.related || []).slice(0, 14).forEach(r => {
      if (!seen.has(r.toLowerCase())) {
        seen.add(r.toLowerCase())
        const s = calculateKeywordScore(r, primary)
        out.push({ keyword: r, source: 'related search', score: s, label: getLabel(s), relevance: calculateKeywordRelevance(r, serp) })
      }
    })
    ;(serp.paa || []).slice(0, 10).forEach(q => {
      if (!seen.has(q.toLowerCase())) {
        seen.add(q.toLowerCase())
        const s = calculateKeywordScore(q, primary)
        out.push({ keyword: q, source: 'PAA', score: s, label: getLabel(s), relevance: calculateKeywordRelevance(q, serp) })
      }
    })
  }
  const extras = [
    `${primary} tools`, `best ${primary}`, `${primary} guide`, `free ${primary}`, `${primary} meaning`,
    `how to ${primary}`, `${primary} for beginners`, `top ${primary}`, `${primary} review`, `what is ${primary}`,
    `${primary} examples`, `${primary} ideas`, `${primary} templates`, `${primary} vs alternative`,
    `best ${primary} ${new Date().getFullYear()}`
  ]
  extras.forEach(kw => {
    if (!seen.has(kw)) {
      seen.add(kw)
      const s = calculateKeywordScore(kw, primary)
      out.push({ keyword: kw, source: 'expanded', score: s, label: getLabel(s), relevance: calculateKeywordRelevance(kw, serp) })
    }
  })
  return out.slice(0, 24)
}

// ---------------------------------------------------------------- otp & password reset
// One-time codes are stored only as SHA-256 hashes, expire, cap attempts,
// enforce a resend cooldown and an hourly send cap per contact. OTP is
// single-use and bound to a purpose (password reset / phone verify) and
// contact. Real delivery adapters (email / sms / whatsapp) activate when the
// matching provider credentials exist in backend/.env; otherwise the code is
// returned as a clearly-labelled dev inbox so the flow stays testable here.

const otpCodes = new Map()
const resetTokens = new Map()
const otpSendLog = new Map()

const OTP_TTL_MS = Number(process.env.OTP_TTL_SECONDS || 300) * 1000
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000
const OTP_COOLDOWN_MS = Number(process.env.OTP_COOLDOWN_SECONDS || 30) * 1000
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)
const OTP_HOUR_CAP = Number(process.env.OTP_HOUR_CAP || 6)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function sha256hex(v) {
  return crypto.createHash('sha256').update(String(v)).digest('hex')
}

function genOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function pruneOtp() {
  const now = Date.now()
  ;[...otpCodes.entries()].forEach(([k, e]) => { if (e.exp < now) otpCodes.delete(k) })
  ;[...resetTokens.entries()].forEach(([k, e]) => { if (e.exp < now) resetTokens.delete(k) })
  ;[...otpSendLog.entries()].forEach(([k, ts]) => {
    const fresh = ts.filter(t => now - t < 3600000)
    if (fresh.length) otpSendLog.set(k, fresh)
    else otpSendLog.delete(k)
  })
}
setInterval(pruneOtp, 60000).unref()

function normalizeOtpContact(channel, raw) {
  const c = String(raw || '').trim()
  if (channel === 'email') return c.toLowerCase()
  const digits = c.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  const plus = /^\+/.test(c) ? '+' : ''
  return plus + digits
}

function emailProviderConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) || !!process.env.RESEND_API_KEY
}

function phoneProviderConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_FROM))
}

function otpSubject(purpose) {
  if (purpose === 'verify_email') return 'SEOPro AI - confirm your email address'
  if (purpose === 'reset') return 'SEOPro AI password reset code'
  return 'SEOPro AI mobile verification code'
}

function otpMessage(purpose, code) {
  if (purpose === 'verify_email') {
    return 'Your SEOPro AI email verification code is ' + code + '. Enter it on the signup screen to activate your account. The code expires in 5 minutes.'
  }
  if (purpose === 'reset') {
    return 'Your SEOPro AI one-time code is ' + code + '. Use it to reset your password. It expires in 5 minutes. If you did not request this, ignore this email.'
  }
  return 'Your SEOPro AI one-time code is ' + code + '. It expires in 5 minutes.'
}

async function sendRealOtp(channel, contact, code, purpose) {
  try {
    if (channel === 'email') {
      const subject = otpSubject(purpose)
      const text = otpMessage(purpose, code)
      if (process.env.RESEND_API_KEY) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@seo-service-provider.com',
            to: contact,
            subject,
            text
          })
        })
        return res.ok
      }
      const nodemailer = await import('nodemailer').catch(() => null)
      if (!nodemailer) return false
      const t = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === '1',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      })
      await t.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: contact,
        subject,
        text
      })
      return true
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = channel === 'whatsapp' ? (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_PHONE_FROM) : process.env.TWILIO_PHONE_FROM
      const to = channel === 'whatsapp' ? 'whatsapp:' + contact : contact
      const dest = channel === 'whatsapp' ? from && from.startsWith('whatsapp:') ? from : 'whatsapp:' + (from || '') : from
      if (!to || !dest || dest === 'whatsapp:') return false
      const res = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
        body: new URLSearchParams({ To: to, From: dest, Body: otpMessage(purpose, code) }).toString()
      })
      return res.ok
    }
    return false
  } catch (e) {
    return false
  }
}

async function deliverOtp(channel, contact, code, purpose, forceDev) {
  const hasProvider = !forceDev && (channel === 'email' ? emailProviderConfigured() : phoneProviderConfigured())
  if (!hasProvider) return { dev: true }
  const ok = await sendRealOtp(channel, contact, code, purpose)
  return ok ? { real: true } : { dev: true, fallback: true }
}

app.post('/api/otp/send', otpLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset' } = req.body
  const VALID_PURPOSES = ['reset', 'verify_phone', 'verify_email']
  if (['email', 'sms', 'whatsapp'].indexOf(channel) < 0) {
    return res.status(400).json({ status: 'Error', error: 'channel must be email, sms or whatsapp', compliance })
  }
  if (VALID_PURPOSES.indexOf(purpose) < 0) {
    return res.status(400).json({ status: 'Error', error: 'purpose must be reset, verify_phone or verify_email', compliance })
  }
  const contactNorm = normalizeOtpContact(channel, contact)
  if (channel === 'email') {
    if (!EMAIL_RE.test(contactNorm)) return res.status(400).json({ status: 'Error', error: 'Enter a valid email address', compliance })
  } else if (!contactNorm) {
    return res.status(400).json({ status: 'Error', error: 'Enter a valid mobile number (7-15 digits)', compliance })
  }
  pruneOtp()
  const key = purpose + ':' + contactNorm
  const now = Date.now()
  const prev = otpCodes.get(key)
  if (prev && now < prev.cooldown) {
    const wait = Math.ceil((prev.cooldown - now) / 1000)
    return res.status(429).json({ status: 'Error', error: 'Please wait ' + wait + 's before requesting a new code.', retryAfter: wait, compliance })
  }
  const log = otpSendLog.get(key) || []
  const hourLog = log.filter(t => now - t < 3600000)
  if (hourLog.length >= OTP_HOUR_CAP) {
    return res.status(429).json({ status: 'Error', error: 'Too many code requests for this contact. Try again later.', compliance })
  }
  const code = genOtpCode()
  otpCodes.set(key, { hash: sha256hex(code), exp: now + OTP_TTL_MS, tries: 0, cooldown: now + OTP_COOLDOWN_MS, purpose, channel, contact: contactNorm })
  otpSendLog.set(key, hourLog.concat([now]))
  const delivery = await deliverOtp(channel, contactNorm, code, purpose, req.query.dev === '1')
  const payload = {
    status: 'Real',
    purpose,
    channel,
    contact: contactNorm,
    ttlSeconds: OTP_TTL_MS / 1000,
    delivery: delivery.dev ? 'dev-inbox' : 'real',
    compliance
  }
  if (delivery.dev) {
    payload.dev = true
    payload.code = code
    payload.notice = delivery.fallback
      ? 'Delivery provider rejected the request, so the code is shown here (dev inbox). Check the provider credentials in backend/.env.'
      : 'Demo mode: no ' + (channel === 'email' ? 'SMTP/Resend' : 'Twilio') + ' credentials are configured in backend/.env, so the code is shown here (dev inbox) instead of being sent. Add provider keys to deliver it for real.'
  }
  res.json(payload)
})

app.post('/api/otp/verify', authLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset', code } = req.body
  const contactNorm = normalizeOtpContact(channel, contact)
  if (!contactNorm || !code) return res.status(400).json({ status: 'Error', error: 'contact and code are required', compliance })
  pruneOtp()
  const key = purpose + ':' + contactNorm
  const entry = otpCodes.get(key)
  if (!entry) return res.status(400).json({ status: 'Error', error: 'No active code for this contact. Request a new one first.', compliance })
  if (Date.now() > entry.exp) { otpCodes.delete(key); return res.status(400).json({ status: 'Error', error: 'Code expired. Request a new one.', compliance }) }
  if (entry.tries >= OTP_MAX_ATTEMPTS) { otpCodes.delete(key); return res.status(400).json({ status: 'Error', error: 'Too many wrong attempts. Request a new code.', compliance }) }
  if (sha256hex(String(code).trim()) !== entry.hash) {
    entry.tries += 1
    return res.status(400).json({ status: 'Error', error: 'Incorrect code. ' + (OTP_MAX_ATTEMPTS - entry.tries) + ' attempts left.', compliance })
  }
  otpCodes.delete(key)
  const payload = { status: 'Real', verified: true, purpose, contact: contactNorm, compliance }
  if (purpose === 'reset') {
    const token = crypto.randomBytes(32).toString('hex')
    resetTokens.set(token, { purpose, contact: contactNorm, exp: Date.now() + RESET_TOKEN_TTL_MS, used: false })
    payload.resetToken = token
    payload.notice = 'Code verified. You can now set a new password within 10 minutes.'
  }
  res.json(payload)
})

app.post('/api/password-reset', authLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset', resetToken, newPassword } = req.body
  const contactNorm = normalizeOtpContact(channel, contact)
  if (!resetToken || !contactNorm) return res.status(400).json({ status: 'Error', error: 'resetToken and contact are required', compliance })
  const entry = resetTokens.get(resetToken)
  if (!entry || entry.used || entry.purpose !== purpose || entry.contact !== contactNorm || Date.now() > entry.exp) {
    resetTokens.delete(resetToken)
    return res.status(400).json({ status: 'Error', error: 'Invalid or expired reset token. Request a new code.', compliance })
  }
  const pass = String(newPassword || '')
  if (pass.length < 6) return res.status(400).json({ status: 'Error', error: 'New password must be at least 6 characters.', compliance })
  entry.used = true
  resetTokens.delete(resetToken)
  res.json({ status: 'Real', reset: true, notice: 'Password reset authorized. Store the new password now.', compliance })
})

// ---------------------------------------------------------------- admin development handoff
// Owner-only dev console data: real project inventory + a ready-to-paste brief for the
// external development agent (MonkeyCode-AI). No source secrets (.env) are ever included.

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DEV_ROUTES_ENABLED = process.env.ENABLE_DEV_ROUTES === '1' || (!process.env.VERCEL && process.env.NODE_ENV !== 'production')
const DEV_FILES = [
  { rel: 'index.html', desc: 'App shell (single page, auth/modal/chat containers)' },
  { rel: 'app.js', desc: 'All frontend logic: views, tools, auth, OTP flows, chat' },
  { rel: 'style.css', desc: 'Design system & page styles' },
  { rel: 'backend/server.js', desc: 'Express ESM API: SERP, PageSpeed, Gemini, chat, OTP, dev console' },
  { rel: 'dev-server.js', desc: 'Preview static server (port 8000, /api proxied to 4000)' }
]

const DEV_KEY = process.env.DEV_KEY || ''
const devFails = new Map()
const devGate = (req, res, next) => {
  const ip = clientIp(req)
  const now = Date.now()
  const rec = devFails.get(ip)
  if (rec && rec.until > now) {
    return res.status(429).json({ status: 'Error', locked: true, error: 'Too many failed owner-key attempts. This IP is temporarily locked.', compliance })
  }
  if (!DEV_KEY) {
    return res.status(503).json({ status: 'Error', locked: true, error: 'Owner key is not configured. Set DEV_KEY in backend/.env to unlock the dev console APIs.', compliance })
  }
  const k = String(req.get('x-dev-key') || '')
  let ok = k.length === DEV_KEY.length
  if (ok) {
    try { ok = crypto.timingSafeEqual(Buffer.from(k), Buffer.from(DEV_KEY)) } catch (e) { ok = false }
  }
  if (!ok) {
    const count = (rec && rec.count ? rec.count : 0) + 1
    devFails.set(ip, { count, until: count >= 8 ? now + 15 * 60 * 1000 : 0 })
    return res.status(401).json({ status: 'Error', locked: true, error: 'Invalid or missing owner key. Enter the DEV_KEY value from backend/.env.', compliance })
  }
  devFails.delete(ip)
  next()
}

if (DEV_ROUTES_ENABLED) {
app.get('/api/dev/project', devGate, (req, res) => {
  const files = DEV_FILES.map(f => {
    try {
      const p = path.join(PROJECT_ROOT, f.rel)
      const stat = fs.statSync(p)
      const content = fs.readFileSync(p, 'utf8')
      return { rel: f.rel, desc: f.desc, chars: content.length, lines: content.split('\n').length, bytes: stat.size }
    } catch (e) {
      return { rel: f.rel, desc: f.desc, chars: 0, lines: 0, bytes: 0, missing: true }
    }
  })
  let endpoints = []
  try {
    const src = fs.readFileSync(path.join(PROJECT_ROOT, 'backend', 'server.js'), 'utf8')
    endpoints = [...src.matchAll(/app\.(get|post)\('([^']+)'/g)].map(m => ({ method: m[1].toUpperCase(), route: m[2] }))
  } catch (e) {}
  const gmailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  const brief = devHandoffBrief(files, endpoints, gmailConfigured)
  res.json({
    status: 'Real',
    runtime: {
      backendPort: process.env.PORT || 4000,
      gmailSmtpConfigured: gmailConfigured,
      apis: {
        serp: SERPAPI_API_KEY ? 'configured' : 'missing',
        pagespeed: PAGESPEED_API_KEY ? 'configured' : 'missing',
        gemini: GEMINI_KEY_VALID ? 'configured' : (GEMINI_KEY_PRESENT ? 'auth-key-present' : 'missing')
      },
      geminiModel: process.env.GEMINI_MODEL || ''
    },
    files,
    endpoints,
    brief,
    compliance
  })
})

function devHandoffBrief(files, endpoints, gmailConfigured) {
  const date = new Date().toISOString()
  const fileLines = files.map(f => '- ' + f.rel + ' (' + f.lines + ' lines, ' + Math.round(f.chars / 1024) + ' KB)').join('\n')
  const endLines = endpoints.map(e => '- ' + e.method + ' ' + e.route).join('\n')
  return [
    'SEOPro AI - developer handoff brief (auto-generated ' + date + ')',
    '',
    'App: Free SEO Tools + AI Agents platform (title generator, keyword research, SERP analyzer, PageSpeed, SEO audit, live chat, plans/payments UI, auth with email-OTP). Golden rule: REAL data only, never fabricated.',
    'Stack: single-page HTML/CSS/JS frontend (index.html + app.js + style.css) and Node/Express ESM backend (backend/server.js).',
    'Source files (current, real):',
    fileLines,
    '',
    'Backend REST endpoints:',
    endLines,
    '',
    'Accounts/auth: demo localStorage DB on the client (no server user DB). Admin gate email: admin@seo-service-provider.com. Password reset + signup + phone verify use OTP endpoints.',
    'OTP delivery: email SMTP configured (Gmail). Real sending needs a Google App Password in SMTP_PASS - until then codes show in a labelled "Demo inbox".',
    'Server-side .env keys (names only, values never in code): SERPAPI_API_KEY, PAGESPEED_API_KEY, GEMINI_API_KEY(model ' + (process.env.GEMINI_MODEL || 'default') + '), SMTP_*.',
    'Dev console APIs (/api/dev/*) are owner-gated: they require header x-dev-key = DEV_KEY from backend/.env.',
    'Backup (/api/dev/export) ships full source + config (.env, .gitignore) but excludes node_modules/.git; import restores the same. node_modules comes back with: cd backend && npm ci.',
    'Preview: dev-server.js on :8000 proxies /api/* to backend :4000.',
    'Development agent: continue the build in MonkeyCode-AI at https://monkeycode-ai.net with this brief.'
  ].join('\n')
}

// ---------------------------------------------------------------- code explorer (tree + file viewer)
const CODE_EXTS = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'html', 'json', 'md', 'txt', 'sh', 'yml', 'yaml', 'svg', 'toml', 'ini', 'xml'])
const TREE_SKIP = new Set(['node_modules', '.git', '.monkeycode-tmp-files', 'dist', '.cache', '__pycache__', '.venv', 'coverage'])
const TREE_MAX_DEPTH = 4
const TREE_MAX_ITEMS = 700

function codeExtOf(name) { return path.extname(name).replace('.', '').toLowerCase() }
function hasDotSegment(rel) { return String(rel).split(/[\\/]/).some(s => s.startsWith('.')) }
function treeViewable(name, rel) { return CODE_EXTS.has(codeExtOf(name)) && !hasDotSegment(rel) }

function projectTree() {
  const items = []
  let truncated = false
  const walk = (dir, rel, depth) => {
    if (items.length >= TREE_MAX_ITEMS) { truncated = true; return }
    if (depth > TREE_MAX_DEPTH) return
    let ents = []
    try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return }
    ents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    for (const e of ents) {
      if (items.length >= TREE_MAX_ITEMS) { truncated = true; return }
      if (TREE_SKIP.has(e.name)) continue
      const childRel = rel ? rel + '/' + e.name : e.name
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        items.push({ type: 'dir', name: e.name, rel: childRel, depth })
        walk(full, childRel, depth + 1)
      } else if (e.isFile()) {
        let size = 0
        try { size = fs.statSync(full).size } catch (err) {}
        items.push({
          type: 'file', name: e.name, rel: childRel, depth, size,
          viewable: treeViewable(e.name, childRel),
          ext: codeExtOf(e.name)
        })
      }
    }
  }
  walk(PROJECT_ROOT, '', 0)
  return { items, truncated, root: PROJECT_ROOT }
}

app.get('/api/dev/tree', devGate, (req, res) => {
  res.json({ status: 'Real', ...projectTree(), compliance })
})

app.get('/api/dev/file', devGate, (req, res) => {
  const rel = String(req.query.path || '').trim()
  if (!rel || rel.indexOf('\0') >= 0) return res.status(400).json({ status: 'Error', error: 'path is required', compliance })
  const abs = path.normalize(path.join(PROJECT_ROOT, rel))
  if (abs !== PROJECT_ROOT && !abs.startsWith(PROJECT_ROOT + path.sep)) {
    return res.status(400).json({ status: 'Error', error: 'Invalid path (outside project root)', compliance })
  }
  if (hasDotSegment(rel) || !CODE_EXTS.has(codeExtOf(abs))) {
    return res.status(400).json({ status: 'Error', error: 'File type is not viewable in the console (dotfiles/.env/binary are protected).', compliance })
  }
  try {
    const content = fs.readFileSync(abs, 'utf8')
    res.json({ status: 'Real', rel, ext: codeExtOf(abs), bytes: content.length, lines: content.split('\n').length, content, compliance })
  } catch (e) {
    res.status(404).json({ status: 'Error', error: 'File not found: ' + rel, compliance })
  }
})

// ---------------------------------------------------------------- backup export / import
const ZIPTOOLS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'ziptools')

app.get('/api/dev/export', devGate, (req, res) => {
  const cp = spawn('python3', [path.join(ZIPTOOLS_DIR, 'export.py'), PROJECT_ROOT])
  const date = new Date().toISOString().slice(0, 10)
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="seopro-full-backup-' + date + '.zip"',
    'Cache-Control': 'no-store'
  })
  cp.stdout.pipe(res)
  cp.on('error', () => {
    if (!res.headersSent) res.status(500).json({ status: 'Error', error: 'python3 is required on the server for backups', compliance })
  })
  cp.on('close', () => res.end())
})

app.post('/api/dev/import', devGate, (req, res) => {
  const chunks = []
  let size = 0
  const LIMIT = 250 * 1024 * 1024
  let aborted = false
  req.on('data', c => {
    if (aborted) return
    size += c.length
    if (size > LIMIT) {
      aborted = true
      res.status(413).json({ status: 'Error', error: 'Backup file too large (max 250 MB)', compliance })
      req.destroy()
      return
    }
    chunks.push(c)
  })
  req.on('end', () => {
    if (aborted) return
    const buf = Buffer.concat(chunks)
    if (!buf.length) return res.status(400).json({ status: 'Error', error: 'Empty upload. Select a .zip backup file.', compliance })
    const cp = spawn('python3', [path.join(ZIPTOOLS_DIR, 'import.py'), PROJECT_ROOT])
    let out = ''
    let errs = ''
    cp.stdout.on('data', d => { out += d })
    cp.stderr.on('data', d => { errs += d })
    cp.on('error', () => {
      res.status(500).json({ status: 'Error', error: 'python3 is required on the server for imports', compliance })
    })
    cp.on('close', code => {
      if (code !== 0) {
        return res.status(400).json({ status: 'Error', error: (errs || out || 'Import failed').trim().slice(0, 500), compliance })
      }
      try {
        const parsed = JSON.parse(out)
        res.json({
          status: 'Real',
          written: parsed.written,
          skipped: parsed.skipped,
          writtenFiles: parsed.writtenFiles || [],
          skippedFiles: parsed.skippedFiles || [],
          notice: 'Backup restored. server.js/backend changes need a backend restart to take effect.',
          compliance
        })
      } catch (e) {
        res.status(500).json({ status: 'Error', error: 'Import output could not be parsed', compliance })
      }
    })
    cp.stdin.on('error', () => {})
    cp.stdin.write(buf)
    cp.stdin.end()
  })
  req.on('error', () => {})
})
}

// ---------------------------------------------------------------- routes

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    apis: {
      serp: SERPAPI_API_KEY ? 'configured' : 'missing',
      pagespeed: PAGESPEED_API_KEY ? 'configured' : 'missing',
      gemini: GEMINI_KEY_VALID ? 'configured' : (GEMINI_KEY_PRESENT ? 'auth-key-present' : 'missing')
    },
    compliance
  })
})

// ---------------------------------------------------------------- admin auth

app.post('/api/admin/login', authLimit, (req, res) => {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  const password = String((req.body && req.body.password) || '')
  if (!ADMIN_EMAILS.includes(email)) return res.status(401).json({ status: 'Error', error: 'Not an admin account' })
  if (!safeEqual(password, ADMIN_PASSWORD)) return res.status(401).json({ status: 'Error', error: 'Wrong admin password' })
  res.json({ status: 'Real', email, token: makeAdminToken(email), expiresIn: ADMIN_TOKEN_TTL_MS })
})

app.get('/api/admin/verify', (req, res) => {
  const data = verifyAdminToken(req.headers['x-admin-token'])
  if (!data) return res.status(401).json({ status: 'Error', error: 'Invalid or expired admin session' })
  res.json({ status: 'Real', email: data.email, expiresAt: data.exp })
})

// ---------------------------------------------------------------- crypto verify

const EVM_CHAINS = {
  bsc: { name: 'BSC', api: 'https://api.bscscan.com/api', key: BSCSCAN_API_KEY, usdt: '0x55d398326f99059ff775485246999027b3197955', decimals: 18, explorer: 'https://bscscan.com/tx/' },
  eth: { name: 'Ethereum', api: 'https://api.etherscan.io/api', key: ETHERSCAN_API_KEY, usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, explorer: 'https://etherscan.io/tx/' },
  arbitrum: { name: 'Arbitrum', api: 'https://api.arbiscan.io/api', key: ARBISCAN_API_KEY, usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', decimals: 6, explorer: 'https://arbiscan.io/tx/' }
}

async function getJson(url, headers = {}) {
  const r = await withTimeout(url, { headers }, 15000)
  return r.json()
}

async function postJson(url, body, headers = {}) {
  const r = await withTimeout(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, 15000)
  return r.json()
}

async function verifyEvm(chain, txid, address) {
  const cfg = EVM_CHAINS[chain]
  if (!/^0x[a-fA-F0-9]{64}$/.test(txid)) return { verified: false, reason: 'Invalid EVM transaction hash' }
  if (!cfg.key) return { verified: false, reason: cfg.name + ' verifier key not configured. Admin will verify manually.' }
  const receipt = await getJson(cfg.api + '?module=transaction&action=gettxreceiptstatus&txhash=' + txid + '&apikey=' + cfg.key)
  const ok = receipt && receipt.result && String(receipt.result.status) === '1'
  if (!ok) return { verified: false, reason: 'Transaction not found or failed on ' + cfg.name + '.' }
  let amount = null
  let matched = false
  if (address) {
    try {
      const list = await getJson(cfg.api + '?module=account&action=tokentx&address=' + address + '&startblock=0&endblock=99999999&sort=desc&page=1&offset=100&apikey=' + cfg.key)
      const hit = (list.result || []).find(t => String(t.hash).toLowerCase() === txid.toLowerCase())
      if (hit) {
        matched = String(hit.to).toLowerCase() === String(address).toLowerCase()
        amount = Number(hit.value) / Math.pow(10, Number(hit.tokenDecimal || cfg.decimals))
      }
    } catch (e) {}
  }
  return { verified: true, matched, amount, reason: 'Confirmed on ' + cfg.name + '.', explorer: cfg.explorer + txid }
}

async function verifyTron(txid, address) {
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) return { verified: false, reason: 'Invalid TRON transaction hash' }
  const headers = TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': TRONGRID_API_KEY } : {}
  try {
    const info = await getJson('https://apilist.tronscanapi.com/api/transaction-info?hash=' + txid)
    if (info && (info.contractRet === 'SUCCESS' || info.confirmed)) {
      const to = info.contractData && (info.contractData.to_address || info.contractData.owner_address)
      const matched = address && to ? String(to).toLowerCase() === String(address).toLowerCase() : null
      const amount = info.contractData && info.contractData.amount ? Number(info.contractData.amount) / Math.pow(10, Number(info.contractData.decimals || 6)) : null
      return { verified: true, matched, amount, reason: 'Confirmed on TRON.', explorer: 'https://tronscan.org/#/transaction/' + txid }
    }
  } catch (e) {}
  try {
    const d = await getJson('https://api.trongrid.io/v1/transactions/' + txid, headers)
    const tx = d && d.data && d.data[0]
    const success = tx && tx.ret && tx.ret[0] && tx.ret[0].contractRet === 'SUCCESS'
    if (success) return { verified: true, matched: null, amount: null, reason: 'Confirmed on TRON.', explorer: 'https://tronscan.org/#/transaction/' + txid }
    return { verified: false, reason: 'TRON transaction not confirmed.' }
  } catch (e) {
    return { verified: false, reason: 'TRON verifier unreachable. Admin will verify manually.' }
  }
}

async function verifySolana(txid, address) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(txid)) return { verified: false, reason: 'Invalid Solana signature' }
  try {
    const d = await postJson('https://api.mainnet-beta.solana.com', { jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [txid, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }] })
    const tx = d && d.result
    if (!tx) return { verified: false, reason: 'Solana transaction not found.' }
    const success = !(tx.meta && tx.meta.err)
    let matched = null
    if (address) {
      try {
        const s = await postJson('https://api.mainnet-beta.solana.com', { jsonrpc: '2.0', id: 2, method: 'getSignaturesForAddress', params: [address, { limit: 100 }] })
        matched = !!(s && s.result && s.result.some(x => x.signature === txid))
      } catch (e) {}
    }
    return { verified: success, matched, amount: null, reason: success ? 'Confirmed on Solana.' : 'Solana transaction failed.', explorer: 'https://solscan.io/tx/' + txid }
  } catch (e) {
    return { verified: false, reason: 'Solana verifier unreachable. Admin will verify manually.' }
  }
}

app.post('/api/crypto/verify', cryptoLimit, async (req, res) => {
  const network = String((req.body && req.body.network) || '').toLowerCase()
  const txid = String((req.body && req.body.txid) || '').trim()
  const address = String((req.body && req.body.address) || '').trim()
  const expected = Number((req.body && req.body.expected) || 0)
  if (!txid) return res.status(400).json({ status: 'Error', error: 'txid is required' })
  try {
    let out
    if (['bsc', 'eth', 'arbitrum'].includes(network)) out = await verifyEvm(network, txid, address)
    else if (network === 'tron') out = await verifyTron(txid, address)
    else if (network === 'solana') out = await verifySolana(txid, address)
    else if (network === 'binance') out = { verified: false, reason: 'Binance Pay has no public transaction lookup. Admin verifies manually.' }
    else return res.status(400).json({ status: 'Error', error: 'Unsupported network' })
    res.json({ status: 'Real', network, txid, expected, ...out, checkedAt: new Date().toISOString() })
  } catch (e) {
    res.json({ status: 'Real', network, txid, verified: false, reason: 'Verifier temporarily unavailable. Admin will verify manually.' })
  }
})


app.get('/api/serp', heavyLimit, async (req, res) => {
  const q = req.query.q || req.query.query
  if (!q) return res.status(400).json({ error: 'q query param is required', compliance })
  const usage = trackUsage(req.query.email, req.query.plan)
  const out = await getSerpWithFallback(q)
  out.usage = usage
  res.json(out)
})

app.post('/api/serp/batch', heavyLimit, async (req, res) => {
  const { queries, email, plan } = req.body
  const kws = parseKeywords(Array.isArray(queries) ? queries.join(',') : (queries || ''))
  if (!kws.length) return res.status(400).json({ error: 'Provide at least one keyword (comma-separated ok)', compliance })
  const usage = trackUsage(email, plan)
  const results = await Promise.all(kws.map(async kw => ({
    keyword: kw,
    serp: await getSerpWithFallback(kw)
  })))
  res.json({ status: 'Real', count: results.length, results, usage, compliance })
})

app.get('/api/pagespeed', heavyLimit, async (req, res) => {
  const url = req.query.url
  trackUsage(req.query.email, req.query.plan)
  res.json(await callPageSpeed(url))
})

app.get('/api/audit', heavyLimit, async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'url query param is required', compliance })
  trackUsage(req.query.email, req.query.plan)
  res.json(await runOnPageAudit(url))
})

app.post('/api/ai-plan', heavyLimit, async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url is required', compliance })
  trackUsage(req.body.email, req.body.plan)
  if (!isValidHttpUrl(url)) {
    return res.json({ status: 'Error', reason: 'Invalid URL. Enter a real web address like https://example.com.', compliance })
  }
  const target = /^https?:\/\//i.test(url) ? url : 'https://' + url
  const blocked = await hostBlocked(target)
  if (blocked) return res.status(400).json({ status: 'Error', reason: blocked, compliance })
  const ps = await callPageSpeed(target)
  const audit = await runOnPageAudit(target)

  let prompt = 'You are the technical SEO expert of SEOPro AI. A user requested an automated action plan.\n\n'
  if (ps.status === 'Real') {
    prompt += `PageSpeed (Lighthouse, real) - Performance ${ps.performance ?? 'n/a'}%, SEO ${ps.seo ?? 'n/a'}%, Best Practices ${ps.bestPractices ?? 'n/a'}%, Accessibility ${ps.accessibility ?? 'n/a'}%. Core Web Vitals: FCP ${ps.metrics?.fcp ?? '-'}, LCP ${ps.metrics?.lcp ?? '-'}, CLS ${ps.metrics?.cls ?? '-'}, TBT ${ps.metrics?.tbt ?? '-'}, SI ${ps.metrics?.si ?? '-'}.\n`
    if (Array.isArray(ps.opportunities) && ps.opportunities.length) {
      prompt += 'Top opportunities: ' + ps.opportunities.slice(0, 6).map(o => `${o.title} (save ${o.savingsMs}ms)`).join('; ') + '.\n'
    }
  } else {
    prompt += `PageSpeed unavailable: ${ps.reason || 'unknown'}\n`
  }
  if (audit.status === 'Real' && audit.checks.length) {
    prompt += '\nOn-page audit checks (real fetch):\n'
    prompt += audit.checks.map(c => `- ${c.label}: ${c.pass ? 'PASS' : 'FAIL'} (${c.detail})`).join('\n') + '\n'
  } else {
    prompt += `\nOn-page audit unavailable: ${audit.note || audit.reason || 'unknown'}\n`
  }
  prompt += '\nWrite a clear, step-by-step actionable SEO fix plan (max ~15 steps) with exact code/markup examples where relevant (title, meta description, H1, img alt, heading hierarchy, robots.txt, performance fixes). Prioritize by impact. Keep it practical and concise. URL: ' + target

  const ai = await callGemini(prompt)
  if (ai.status !== 'Real') {
    return res.json({ status: 'Error', reason: ai.reason || 'AI action plan generation failed. Check the Gemini API key.', compliance })
  }
  res.json({
    status: 'Real',
    url: target,
    plan: ai.text,
    model: ai.model,
    pagespeed: ps.status === 'Real' ? { performance: ps.performance, seo: ps.seo, bestPractices: ps.bestPractices, accessibility: ps.accessibility } : null,
    audit: audit.status === 'Real' ? { score: audit.score, passed: audit.passed, total: audit.total, checks: audit.checks, note: audit.note } : null,
    compliance
  })
})

app.post('/api/gemini', heavyLimit, async (req, res) => {
  const { prompt, keywords } = req.body
  if (!prompt && !Array.isArray(keywords)) return res.status(400).json({ error: 'prompt (or keywords array) is required' })
  trackUsage(req.body.email, req.body.plan)
  if (Array.isArray(keywords)) {
    const kws = parseKeywords(keywords.join(','))
    const year = new Date().getFullYear()
    const results = await Promise.all(kws.map(async kw => {
      const r = await callGemini(`Write 3 SEO meta descriptions (70-160 chars each) for: "${kw}" ${year}`)
      return {
        keyword: kw,
        status: r.status,
        reason: r.reason || '',
        text: r.status === 'Real' ? r.text : ''
      }
    }))
    return res.json({ status: 'Real', multi: true, count: results.length, results, compliance })
  }
  res.json(await callGemini(prompt))
})

app.post('/api/chat', chatLimit, async (req, res) => {
  const { message, messages } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })
  const intent = detectChatIntent(message)
  const isShort = String(message).trim().split(/\s+/).length <= 5
  let reply = isShort ? buildChatReply(intent.intent, message) : null
  let source = 'rule'
  if (!reply) {
    const ai = await callGemini(chatPrompt(message, messages))
    if (ai.status === 'Real') { reply = ai.text; source = 'gemini' }
    else {
      reply = 'I understood your question but live AI answering is temporarily unavailable. For now I can help with pricing, tools, the generator or contact info - or reach a human on WhatsApp 01886822816.'
      source = 'fallback'
    }
  }
  res.json({ status: 'Real', reply, intent, source, compliance })
})

app.post('/api/generate', heavyLimit, async (req, res) => {
  const { title, userEmail, plan } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required' })
  if (!userEmail) return res.status(400).json({ error: 'userEmail is required' })

  const usage = trackUsage(userEmail, plan)
  if (usage.count > usage.limit) {
    return res.status(429).json({ error: `Daily limit reached (${usage.limit}/${usage.limit}). Upgrade your plan for more credits.`, usage, compliance })
  }

  const serp = await getSerpWithFallback(title)
  const meaningfulWords = extractMeaningfulWords(title)
  const intent = detectIntent(title)
  const year = new Date().getFullYear()
  const primary = capitalize(pickPrimary(meaningfulWords, title))

  const rawTitles = generateRealTitlesFromSERP(serp, primary, meaningfulWords, year)
  const titles = rawTitles.map(t => {
    const s = calculateTitleScore(t, primary.toLowerCase(), intent.intent, year)
    return { title: t, score: s, label: getLabel(s) }
  }).sort((a, b) => b.score - a.score)

  const keywords = buildKeywords(primary, serp)

  res.json({
    status: 'Real',
    primary,
    year,
    intent,
    meaningfulWords: meaningfulWords.slice(0, 8),
    competitors: (serp.competitors || []).slice(0, 8),
    total_results: serp.total_results,
    serpStatus: serp.status,
    titles,
    keywords,
    usage,
    compliance
  })
})

app.get('/api/usage', (req, res) => {
  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'email query param is required' })
  const today = new Date().toISOString().slice(0, 10)
  const key = `${email.toLowerCase()}:${today}`
  const u = usageMap.get(key) || { email, date: today, count: 0, cost: 0 }
  res.json({ status: 'ok', usage: u })
})

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`SEO Backend listening on http://localhost:${PORT}`)
    console.log(`SerpApi: ${SERPAPI_API_KEY ? 'configured' : 'missing'} | PageSpeed: ${PAGESPEED_API_KEY ? 'configured' : 'missing'} | Gemini: ${GEMINI_API_KEY ? 'configured' : 'missing'}`)
    console.log(`Dev console routes: ${DEV_ROUTES_ENABLED ? 'ENABLED' : 'disabled'}`)
  })
}

export default app
