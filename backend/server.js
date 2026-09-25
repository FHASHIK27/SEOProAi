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

function originAllowed(origin, selfHost) {
  if (!origin) return true
  let host = ''
  try { host = new URL(origin).hostname.toLowerCase() } catch (e) { return false }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host === 'monkeycode-ai.live' || /\.monkeycode-ai\.live$/i.test(host)) return true
  // Vercel previews/production: allow the site to call its own /api (same origin).
  if (host === 'vercel.app' || /\.vercel\.app$/i.test(host)) return true
  if (selfHost) {
    const sh = String(selfHost).toLowerCase().replace(/:\d+$/, '')
    if (sh && host === sh) return true
  }
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
  if (origin && !originAllowed(origin, req.headers.host)) {
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
app.use(express.json({ limit: '2mb' }))

// Maintenance mode + concurrency guard. Admin/health/site-config stay reachable
// so the owner can always turn maintenance back off. Heavy AI/SEO jobs are
// rejected with 503 when the configured in-flight limit is reached.
const HEAVY_API_PATHS = ['/generate', '/serp', '/serp/batch', '/pagespeed', '/audit', '/ai-plan', '/gemini', '/chat']
app.use('/api', async (req, res, next) => {
  try {
    const p = req.path || ''
    if (p.indexOf('/admin') === 0 || p === '/health' || p === '/site-config') return next()
    const settings = await getSiteSettings()
    const isAdmin = !!verifyAdminToken(req.headers['x-admin-token'])
    if (settings.maintenance && !isAdmin) {
      return res.status(503).json({
        status: 'Error', maintenance: true,
        error: 'The service is temporarily under maintenance. Please try again shortly.',
        compliance
      })
    }
    if (HEAVY_API_PATHS.indexOf(p) >= 0) {
      if (INFLIGHT >= settings.concurrencyLimit) {
        sysLog('warn', 'concurrency', 'Rejected ' + p + ' (in-flight ' + INFLIGHT + '/' + settings.concurrencyLimit + ')')
        return res.status(503).json({ status: 'Error', busy: true, error: 'Server is busy right now. Please retry in a moment.', compliance })
      }
      acquireSlot()
      const startedAt = Date.now()
      let released = false
      const release = () => { if (released) return; released = true; releaseSlot() }
      res.on('finish', () => {
        release()
        const code = res.statusCode
        const source = p.replace(/^\//, '').replace(/\//g, '-') || 'api'
        sysLog(code >= 500 ? 'error' : (code >= 400 ? 'warn' : 'success'), source,
          'Job finished with HTTP ' + code + ' in ' + (Date.now() - startedAt) + 'ms', { path: p, status: code })
      })
      res.on('close', release)
    }
  } catch (e) { /* never block traffic on a settings read failure */ }
  next()
})

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

// fetch() with a hard timeout so a slow provider can never hang an OTP request.
async function fetchT(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
  } finally {
    clearTimeout(timer)
  }
}

function makeAdminToken(email, role, permissions) {
  const payload = Buffer.from(JSON.stringify({
    email,
    role: role === 'moderator' ? 'moderator' : 'admin',
    permissions: permissions || null,
    exp: Date.now() + ADMIN_TOKEN_TTL_MS
  })).toString('base64url')
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
    const email = String(data.email || '').toLowerCase()
    const role = data.role === 'moderator' ? 'moderator' : 'admin'
    if (role === 'admin' && !ADMIN_EMAILS.includes(email)) return null
    data.email = email
    data.role = role
    return data
  } catch (e) { return null }
}

const MODERATOR_DEFAULT_PERMISSIONS = ['logs', 'chats']

async function requireAdmin(req, res, next) {
  const data = verifyAdminToken(req.headers['x-admin-token'])
  if (!data) return res.status(401).json({ status: 'Error', error: 'Admin login required', compliance })
  if (data.role === 'moderator') {
    let mods = []
    try { mods = (await kvGet('moderators', [])) || [] } catch (e) { mods = [] }
    const m = mods.find(x => String(x.email || '').toLowerCase() === data.email && x.active !== false)
    if (!m) return res.status(401).json({ status: 'Error', error: 'Moderator access revoked. Please sign in again.', compliance })
    data.permissions = Array.isArray(m.permissions) && m.permissions.length ? m.permissions : MODERATOR_DEFAULT_PERMISSIONS
  }
  req.adminEmail = data.email
  req.adminRole = data.role
  req.adminPermissions = data.role === 'moderator' ? data.permissions : ['all']
  next()
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.adminRole)) {
      return res.status(403).json({ status: 'Error', error: 'Your role does not have permission for this action.', compliance })
    }
    next()
  }
}

// ---------------------------------------------------------------- admin account store
// Optional server-side persistence for admin credentials/recovery, via the
// Supabase REST API with the service-role key (kept server-side only).
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ADMIN_SETTINGS_KEY = 'admin_account'

function supabaseReady() { return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) }

function supaHeaders(extra) {
  return Object.assign({
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  }, extra || {})
}

async function supaReadSetting(key) {
  if (!supabaseReady()) return null
  const r = await fetch(SUPABASE_URL + '/rest/v1/app_settings?key=eq.' + encodeURIComponent(key) + '&select=value', { headers: supaHeaders() })
  if (!r.ok) throw new Error('read ' + r.status)
  const rows = await r.json()
  return rows && rows[0] ? rows[0].value : null
}

async function supaWriteSetting(key, value) {
  if (!supabaseReady()) throw new Error('Server storage is not configured')
  const r = await fetch(SUPABASE_URL + '/rest/v1/app_settings?on_conflict=key', {
    method: 'POST',
    headers: supaHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }])
  })
  if (!r.ok) throw new Error('write ' + r.status + ' ' + String(await r.text().catch(() => '')).slice(0, 160))
  return true
}

async function supaDeleteSetting(key) {
  if (!supabaseReady()) return false
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/app_settings?key=eq.' + encodeURIComponent(key), {
      method: 'DELETE', headers: supaHeaders({ Prefer: 'return=minimal' })
    })
    return r.ok
  } catch (e) { return false }
}

function hashAdminPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex')
  const h = crypto.scryptSync(String(pw), salt, 64).toString('hex')
  return 'scrypt$' + salt + '$' + h
}

function verifyAdminPasswordHash(pw, stored) {
  try {
    if (!stored || String(stored).indexOf('scrypt$') !== 0) return false
    const parts = String(stored).split('$')
    if (parts.length !== 3) return false
    const calc = crypto.scryptSync(String(pw), parts[1], 64).toString('hex')
    return safeEqual(calc, parts[2])
  } catch (e) { return false }
}

async function loadAdminAccount(email) {
  try {
    const all = await supaReadSetting(ADMIN_SETTINGS_KEY)
    if (all && typeof all === 'object' && all[email]) return all[email]
  } catch (e) { /* storage optional */ }
  return null
}

async function saveAdminAccount(email, patch) {
  let all = {}
  try { all = (await supaReadSetting(ADMIN_SETTINGS_KEY)) || {} } catch (e) { all = {} }
  if (typeof all !== 'object' || Array.isArray(all)) all = {}
  all[email] = Object.assign({}, all[email] || {}, patch, { updatedAt: new Date().toISOString() })
  await supaWriteSetting(ADMIN_SETTINGS_KEY, all)
  return all[email]
}

// ---------------------------------------------------------------- admin KV store
// Small JSON key/value store for admin-managed data (plans, payment methods,
// moderators, logs, site settings). Persisted in Supabase app_settings via the
// service-role key when configured; falls back to an in-memory store locally.
const MEM_KV = Object.create(null)

function kvReady() { return supabaseReady() }

async function kvGet(key, fallback) {
  if (kvReady()) {
    try {
      const v = await supaReadSetting(key)
      if (v !== null && v !== undefined) return v
    } catch (e) { /* fall through to memory */ }
  }
  return Object.prototype.hasOwnProperty.call(MEM_KV, key) ? MEM_KV[key] : fallback
}

async function kvSet(key, value) {
  MEM_KV[key] = value
  if (kvReady()) {
    try { await supaWriteSetting(key, value) } catch (e) { /* keep memory copy */ }
  }
  return value
}

function newId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex')
}

// ---- site settings (maintenance / registrations / concurrency) ----
const SITE_SETTINGS_KEY = 'site_settings'
const DEFAULT_SITE_SETTINGS = {
  maintenance: false,
  allowRegistration: true,
  concurrencyLimit: 8,
  updatedAt: null,
  updatedBy: null
}

async function getSiteSettings() {
  const v = await kvGet(SITE_SETTINGS_KEY, null)
  return Object.assign({}, DEFAULT_SITE_SETTINGS, (v && typeof v === 'object' && !Array.isArray(v)) ? v : {})
}

async function saveSiteSettings(patch, actor) {
  const cur = await getSiteSettings()
  const next = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString(), updatedBy: actor || cur.updatedBy || null })
  if (typeof next.concurrencyLimit !== 'number' || !isFinite(next.concurrencyLimit)) next.concurrencyLimit = DEFAULT_SITE_SETTINGS.concurrencyLimit
  next.concurrencyLimit = Math.max(1, Math.min(64, Math.round(next.concurrencyLimit)))
  next.maintenance = !!next.maintenance
  next.allowRegistration = !!next.allowRegistration
  await kvSet(SITE_SETTINGS_KEY, next)
  return next
}

// ---- system logs + audit logs ----
const SYSTEM_LOGS_KEY = 'system_logs'
const AUDIT_LOGS_KEY = 'audit_logs'
const SYSTEM_LOGS_CAP = 800
const AUDIT_LOGS_CAP = 500

async function appendLog(key, cap, entry) {
  try {
    const list = (await kvGet(key, [])) || []
    const arr = Array.isArray(list) ? list : []
    arr.unshift(Object.assign({ id: newId('log'), at: new Date().toISOString() }, entry))
    await kvSet(key, arr.slice(0, cap))
  } catch (e) { /* logging must never break a request */ }
}

function sysLog(level, source, message, meta) {
  const entry = { level: level || 'info', source: source || 'app', message: String(message || '').slice(0, 500), meta: meta || null }
  appendLog(SYSTEM_LOGS_KEY, SYSTEM_LOGS_CAP, entry)
  return entry
}

function auditLog(actor, action, target, meta, ip) {
  const entry = { actor: actor || 'system', action: action || 'action', target: target || null, meta: meta || null, ip: ip || null }
  appendLog(AUDIT_LOGS_KEY, AUDIT_LOGS_CAP, entry)
  return entry
}

async function getLogs(key, limit) {
  const list = (await kvGet(key, [])) || []
  const arr = Array.isArray(list) ? list : []
  const n = Math.max(1, Math.min(500, Number(limit) || 200))
  return arr.slice(0, n)
}

async function clearLogs(key) {
  await kvSet(key, [])
}

// ---- plans ----
const PLANS_KEY = 'plans'
async function getPlans() {
  const v = await kvGet(PLANS_KEY, null)
  return Array.isArray(v) ? v : []
}
async function savePlan(plan, actor) {
  if (!plan || !plan.name) throw new Error('Plan name is required')
  const plans = await getPlans()
  const id = plan.id || newId('plan')
  const idx = plans.findIndex(p => p.id === id)
  const clean = {
    id,
    name: String(plan.name).slice(0, 60),
    price: Number(plan.price) || 0,
    currency: String(plan.currency || 'BDT').slice(0, 8),
    agents: Number(plan.agents) || 1,
    daily: Number(plan.daily) || 10,
    monthly: Number(plan.monthly) || 100,
    features: Array.isArray(plan.features) ? plan.features.slice(0, 20).map(f => String(f).slice(0, 120)) : [],
    badge: plan.badge ? String(plan.badge).slice(0, 24) : '',
    active: plan.active !== false,
    sort: Number.isFinite(Number(plan.sort)) ? Number(plan.sort) : (plans.length + 1),
    updatedAt: new Date().toISOString()
  }
  if (idx >= 0) plans[idx] = Object.assign({}, plans[idx], clean)
  else plans.push(Object.assign({ createdAt: new Date().toISOString() }, clean))
  plans.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
  await kvSet(PLANS_KEY, plans)
  return clean
}
async function deletePlan(id, actor) {
  const plans = await getPlans()
  const next = plans.filter(p => p.id !== id)
  await kvSet(PLANS_KEY, next)
  return plans.length !== next.length
}

// ---- payment methods ----
const METHODS_KEY = 'payment_methods'
async function getPaymentMethods() {
  const v = await kvGet(METHODS_KEY, null)
  return Array.isArray(v) ? v : []
}
async function savePaymentMethod(m, actor) {
  if (!m || !m.label) throw new Error('Payment method label is required')
  const list = await getPaymentMethods()
  const id = m.id || newId('pm')
  const idx = list.findIndex(p => p.id === id)
  const clean = {
    id,
    label: String(m.label).slice(0, 60),
    number: String(m.number || '').slice(0, 120),
    network: String(m.network || '').slice(0, 60),
    note: String(m.note || '').slice(0, 240),
    crypto: !!m.crypto,
    enabled: m.enabled !== false,
    sort: Number.isFinite(Number(m.sort)) ? Number(m.sort) : (list.length + 1),
    updatedAt: new Date().toISOString()
  }
  if (idx >= 0) list[idx] = Object.assign({}, list[idx], clean)
  else list.push(Object.assign({ createdAt: new Date().toISOString() }, clean))
  list.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
  await kvSet(METHODS_KEY, list)
  return clean
}
async function deletePaymentMethod(id, actor) {
  const list = await getPaymentMethods()
  const next = list.filter(p => p.id !== id)
  await kvSet(METHODS_KEY, next)
  return list.length !== next.length
}

// ---- moderators ----
const MODERATORS_KEY = 'moderators'
async function getModerators() {
  const v = await kvGet(MODERATORS_KEY, null)
  return Array.isArray(v) ? v : []
}
function publicModerator(m) {
  return {
    id: m.id, name: m.name, email: m.email, active: m.active !== false,
    permissions: Array.isArray(m.permissions) && m.permissions.length ? m.permissions : MODERATOR_DEFAULT_PERMISSIONS,
    createdAt: m.createdAt || null, lastLoginAt: m.lastLoginAt || null, createdBy: m.createdBy || null
  }
}
async function createModerator(input, actor) {
  const name = String(input.name || '').trim().slice(0, 80)
  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  if (!name) throw new Error('Moderator name is required')
  if (!EMAIL_RE.test(email)) throw new Error('Enter a valid moderator email address')
  if (password.length < 8) throw new Error('Moderator password must be at least 8 characters')
  if (ADMIN_EMAILS.includes(email)) throw new Error('This email is already an owner/admin account')
  const mods = await getModerators()
  if (mods.some(m => String(m.email || '').toLowerCase() === email)) throw new Error('A moderator with this email already exists')
  const mod = {
    id: newId('mod'),
    name, email,
    hash: hashAdminPassword(password),
    active: true,
    permissions: MODERATOR_DEFAULT_PERMISSIONS.slice(),
    createdAt: new Date().toISOString(),
    createdBy: actor || null,
    lastLoginAt: null
  }
  mods.push(mod)
  await kvSet(MODERATORS_KEY, mods)
  return publicModerator(mod)
}
async function updateModerator(id, patch, actor) {
  const mods = await getModerators()
  const mod = mods.find(m => m.id === id)
  if (!mod) throw new Error('Moderator not found')
  if (patch.name !== undefined) mod.name = String(patch.name).slice(0, 80)
  if (patch.active !== undefined) mod.active = !!patch.active
  if (patch.password) {
    if (String(patch.password).length < 8) throw new Error('Moderator password must be at least 8 characters')
    mod.hash = hashAdminPassword(String(patch.password))
  }
  if (Array.isArray(patch.permissions)) {
    mod.permissions = patch.permissions.filter(p => MODERATOR_DEFAULT_PERMISSIONS.includes(p))
    if (!mod.permissions.length) mod.permissions = MODERATOR_DEFAULT_PERMISSIONS.slice()
  }
  mod.updatedAt = new Date().toISOString()
  mod.updatedBy = actor || null
  await kvSet(MODERATORS_KEY, mods)
  return publicModerator(mod)
}
async function deleteModerator(id, actor) {
  const mods = await getModerators()
  const next = mods.filter(m => m.id !== id)
  await kvSet(MODERATORS_KEY, next)
  return mods.length !== next.length
}

// ---- concurrency guard ----
let INFLIGHT = 0
function acquireSlot() {
  INFLIGHT++
  return INFLIGHT
}
function releaseSlot() {
  if (INFLIGHT > 0) INFLIGHT--
}

function maskContact(channel, contact) {
  const c = String(contact || '')
  if (channel === 'email') {
    const at = c.indexOf('@')
    if (at < 1) return c
    const name = c.slice(0, at)
    return name.slice(0, 2) + '*'.repeat(Math.max(1, name.length - 2)) + c.slice(at)
  }
  return c.length > 4 ? '*'.repeat(c.length - 4) + c.slice(-4) : c
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

const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP || '01883822816'
const SUPPORT_WHATSAPP_WA = '+880' + SUPPORT_WHATSAPP.replace(/^0/, '')

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
      return 'Thanks for visiting SEOPro AI! If you need us later, message our human support on WhatsApp ' + SUPPORT_WHATSAPP + ' anytime.'
    case 'pricing':
      return 'Our pricing is simple and real:\n\n' +
        PLANS.map(p => `${p.name} — $${p.price}/mo: ${p.daily} credits/day, ${p.agents} agents, ${p.tools} tools`).join('\n') +
        '\n\nWe accept bKash, Nagad, Rocket, Bank Asia, Binance Pay, USDT (BEP20/TRC20), Solana, ETH, Arbitrum, Card and PayPal. Crypto payments auto-verify on-chain in ~2 seconds; mobile/bank payments are approved by our admin. Open /pricing to buy.'
    case 'payment':
      return 'We accept 12 payment methods:\n\nMobile/Bank: bKash (01886822816), Nagad (01613822816), Rocket (Coming Soon), Bank Asia (account info after checkout), Card & PayPal.\nCrypto: Binance Pay, USDT (BEP20/TRC20), Solana, ETH, Arbitrum.\n\nCrypto payments are verified automatically on-chain in ~2 seconds via BscScan. bKash/Nagad/bank/Binance payments are confirmed by our admin after you send the money - you can submit an order ID, a TX hash, or a payment screenshot. Go to /pricing and pick your plan to pay.'
    case 'generator':
      return 'Try our free Title Generator at /generator. It uses real SERP data to build SEO titles with real ranking scores - no fabricated templates. Login and generate now.'
    case 'metadesc':
      return 'Use the Meta Description Generator at /tools. Type one or more keywords (comma-separated) and it writes AI meta descriptions with real scores.'
    case 'tools':
      return 'We have 10 free SEO tools - all with real analysis:\n• Keyword Research\n• SERP Analyzer\n• Title Generator\n• Meta Description Generator\n• PageSpeed Checker\n• Competitor Analysis\n• Question Finder (PAA)\n• Related Keywords\n• Keyword Difficulty\n• SEO Audit Score\n\nOpen /tools to use them. You can now enter multiple comma-separated keywords in one go.'
    case 'account':
      return 'Register or login at /auth - it takes seconds. After buying any paid plan your account becomes Premium Active instantly (crypto) or after admin approval (mobile/bank).'
    case 'contact':
      return 'Reach us anytime:\n• WhatsApp (human support): ' + SUPPORT_WHATSAPP + '\n• Telegram: t.me/+8801886822816\n• Or use this live chat - our AI answers instantly and a human agent can join when needed.'
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
  return `You are the support assistant of SEOPro AI (monkeycode-ai.live), a real SEO tools and AI agents platform with 10 free tools (keyword research, SERP analyzer, title generator, meta description generator, PageSpeed checker, competitor analysis, question finder, related keywords, keyword difficulty, SEO audit), 19 agents, and 4 plans (Free $0, Starter $5, Pro $15, Agency $49 per month). Pages: / (home), /generator, /tools, /pricing, /dashboard, /auth. Payments: bKash 01886822816, Nagad 01613822816, Rocket, Bank Asia, Binance Pay, USDT, Solana, ETH, Arbitrum, Card, PayPal. For manual payments the user can submit an order ID, a TX hash, or a screenshot (any one is enough). Crypto auto-verifies on-chain. Human support: WhatsApp ${SUPPORT_WHATSAPP} (also available as a human agent in this live chat). Answer directly, concisely and helpfully, in the user's language (Bengali if they write Bengali). Only use the website information above; if you do not know something, tell the user to contact human support on WhatsApp ${SUPPORT_WHATSAPP}. Do not invent fake SERP data or make promises about rankings.${ctx}\n\nUser: ${query}`
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
// single-use and bound to a purpose (password reset / email verify) and
// contact. Real email delivery activates when the matching provider
// credentials exist in backend/.env; otherwise the code is
// returned as a clearly-labelled dev inbox so the flow stays testable here.

const otpCodes = new Map()
const resetTokens = new Map()
const otpSendLog = new Map()

// Codes and reset tokens must survive across serverless invocations, so they
// are persisted in Supabase app_settings (service role) with the in-memory maps
// acting as a cache/fallback local store.
const OTP_STORE_PREFIX = 'otp_code_'
const RESET_STORE_PREFIX = 'otp_reset_'

async function otpGet(key) {
  if (supabaseReady()) {
    try { const v = await supaReadSetting(OTP_STORE_PREFIX + key); if (v) return v } catch (e) {}
  }
  return otpCodes.get(key) || null
}
async function otpPut(key, val) {
  otpCodes.set(key, val)
  if (supabaseReady()) { try { await supaWriteSetting(OTP_STORE_PREFIX + key, val) } catch (e) {} }
}
async function otpDrop(key) {
  otpCodes.delete(key)
  if (supabaseReady()) { try { await supaDeleteSetting(OTP_STORE_PREFIX + key) } catch (e) {} }
}
async function resetGet(token) {
  if (supabaseReady()) {
    try { const v = await supaReadSetting(RESET_STORE_PREFIX + token); if (v) return v } catch (e) {}
  }
  return resetTokens.get(token) || null
}
async function resetPut(token, val) {
  resetTokens.set(token, val)
  if (supabaseReady()) { try { await supaWriteSetting(RESET_STORE_PREFIX + token, val) } catch (e) {} }
}
async function resetDrop(token) {
  resetTokens.delete(token)
  if (supabaseReady()) { try { await supaDeleteSetting(RESET_STORE_PREFIX + token) } catch (e) {} }
}

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
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) || !!process.env.RESEND_API_KEY || !!process.env.BREVO_API_KEY
}

function emailProviderName() {
  if (process.env.BREVO_API_KEY) return 'Brevo'
  if (process.env.RESEND_API_KEY) return 'Resend'
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'SMTP (' + process.env.SMTP_HOST + ')'
  return null
}

function deliveryStatus() {
  return {
    email: emailProviderConfigured(),
    emailProvider: emailProviderName()
  }
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
      // Try every configured provider in order and stop at the first success,
      // so one misconfigured provider never blocks a working one.
      const attempts = []
      if (process.env.BREVO_API_KEY) {
        try {
          const fromAddr = (process.env.EMAIL_FROM || '').match(/<([^>]+)>/)
          const sender = fromAddr ? fromAddr[1] : (process.env.EMAIL_FROM || process.env.SMTP_USER || '').trim()
          const senderName = (String(process.env.EMAIL_FROM || '').match(/^(.*)</) || [])[1] || 'SEO Service Provider'
          const res = await fetchT('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { email: sender, name: senderName.trim() || 'SEO Service Provider' },
              to: [{ email: contact }],
              subject,
              textContent: text
            })
          }, 15000)
          if (res.ok) return { ok: true, provider: 'Brevo' }
          const body = await res.text().catch(() => '')
          attempts.push('Brevo ' + res.status + (body ? ': ' + body.slice(0, 140) : ''))
        } catch (e) { attempts.push('Brevo: ' + ((e && e.message) || 'failed')) }
      }
      if (process.env.RESEND_API_KEY) {
        try {
          const res = await fetchT('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'noreply@seo-service-provider.com',
              to: contact,
              subject,
              text
            })
          }, 15000)
          if (res.ok) return { ok: true, provider: 'Resend' }
          const body = await res.text().catch(() => '')
          attempts.push('Resend ' + res.status + (body ? ': ' + body.slice(0, 140) : ''))
        } catch (e) { attempts.push('Resend: ' + ((e && e.message) || 'failed')) }
      }
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const nodemailer = await import('nodemailer').catch(() => null)
        if (!nodemailer) attempts.push('SMTP: mail library unavailable')
        else {
          try {
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
            return { ok: true, provider: 'SMTP' }
          } catch (e) {
            const raw = (e && (e.response || e.message)) ? String(e.response || e.message) : 'SMTP rejected the message.'
            attempts.push('SMTP: ' + raw.slice(0, 160))
          }
        }
      }
      if (!attempts.length) return { ok: false, error: 'No email provider is configured.' }
      return { ok: false, error: 'Email delivery failed. ' + attempts.join(' | ') }
    }
    return { ok: false, error: 'Unsupported OTP channel.' }
  } catch (e) {
    return { ok: false, error: (e && e.message) ? String(e.message).slice(0, 200) : 'Delivery failed.' }
  }
}

async function deliverOtp(channel, contact, code, purpose, allowDev) {
  if (allowDev) return { ok: true, dev: true }
  if (!emailProviderConfigured()) {
    return {
      ok: false,
      reason: 'Email delivery is not configured on the server (set BREVO_API_KEY, or RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS).'
    }
  }
  return await sendRealOtp(channel, contact, code, purpose)
}

// Shared OTP issue/verify used by user flows and the admin account flows.
async function issueOtp(channel, contact, purpose, allowDev) {
  pruneOtp()
  const now = Date.now()
  const key = purpose + ':' + contact
  const prev = await otpGet(key)
  if (prev && now < prev.cooldown) {
    return { ok: false, error: 'Please wait ' + Math.ceil((prev.cooldown - now) / 1000) + 's before requesting a new code.' }
  }
  const log = otpSendLog.get(key) || []
  const hourLog = log.filter(t => now - t < 3600000)
  if (hourLog.length >= OTP_HOUR_CAP) return { ok: false, error: 'Too many code requests for this contact. Try again later.' }
  const code = genOtpCode()
  await otpPut(key, { hash: sha256hex(code), exp: now + OTP_TTL_MS, tries: 0, cooldown: now + OTP_COOLDOWN_MS, purpose, channel, contact })
  otpSendLog.set(key, hourLog.concat([now]))
  const delivery = await deliverOtp(channel, contact, code, purpose, allowDev)
  if (!delivery.ok) {
    await otpDrop(key)
    return { ok: false, error: 'Could not send the code to ' + maskContact(channel, contact) + '. ' + (delivery.reason || delivery.error || 'Please try again later.') }
  }
  return { ok: true, code, dev: !!delivery.dev, channel, contact }
}

async function consumeOtp(channel, contact, purpose, code) {
  pruneOtp()
  const key = purpose + ':' + contact
  const entry = await otpGet(key)
  if (!entry) return { ok: false, error: 'No active code for this contact. Request a new one first.' }
  if (Date.now() > entry.exp) { await otpDrop(key); return { ok: false, error: 'Code expired. Request a new one.' } }
  if (entry.tries >= OTP_MAX_ATTEMPTS) { await otpDrop(key); return { ok: false, error: 'Too many wrong attempts. Request a new code.' } }
  if (sha256hex(String(code).trim()) !== entry.hash) {
    entry.tries += 1
    await otpPut(key, entry)
    return { ok: false, error: 'Incorrect code. ' + (OTP_MAX_ATTEMPTS - entry.tries) + ' attempts left.' }
  }
  await otpDrop(key)
  return { ok: true }
}

app.post('/api/otp/send', otpLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset' } = req.body
  const VALID_PURPOSES = ['reset', 'verify_email']
  if (channel !== 'email') {
    return res.status(400).json({ status: 'Error', error: 'channel must be email', compliance })
  }
  if (VALID_PURPOSES.indexOf(purpose) < 0) {
    return res.status(400).json({ status: 'Error', error: 'purpose must be reset or verify_email', compliance })
  }
  const contactNorm = normalizeOtpContact('email', contact)
  if (!EMAIL_RE.test(contactNorm)) return res.status(400).json({ status: 'Error', error: 'Enter a valid email address', compliance })
  const allowDev = DEV_ROUTES_ENABLED && req.query.dev === '1'
  const issued = await issueOtp(channel, contactNorm, purpose, allowDev)
  if (!issued.ok) {
    const rate = /wait|too many/i.test(issued.error || '')
    return res.status(rate ? 429 : 502).json({ status: 'Error', error: issued.error, compliance })
  }
  const payload = {
    status: 'Real',
    purpose,
    channel,
    contact: contactNorm,
    ttlSeconds: OTP_TTL_MS / 1000,
    delivery: issued.dev ? 'dev-inbox' : 'sent',
    compliance
  }
  if (issued.dev) {
    payload.dev = true
    payload.code = issued.code
    payload.notice = 'Development mode: the code is shown on screen because this is not a production environment.'
  }
  res.json(payload)
})

app.post('/api/otp/verify', authLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset', code } = req.body
  const contactNorm = normalizeOtpContact(channel, contact)
  if (!contactNorm || !code) return res.status(400).json({ status: 'Error', error: 'contact and code are required', compliance })
  const verified = await consumeOtp(channel, contactNorm, purpose, code)
  if (!verified.ok) return res.status(400).json({ status: 'Error', error: verified.error, compliance })
  const payload = { status: 'Real', verified: true, purpose, contact: contactNorm, compliance }
  if (purpose === 'reset') {
    const token = crypto.randomBytes(32).toString('hex')
    await resetPut(token, { purpose, contact: contactNorm, exp: Date.now() + RESET_TOKEN_TTL_MS, used: false })
    payload.resetToken = token
    payload.notice = 'Code verified. You can now set a new password within 10 minutes.'
  }
  res.json(payload)
})

app.post('/api/password-reset', authLimit, async (req, res) => {
  const { contact, channel = 'email', purpose = 'reset', resetToken, newPassword } = req.body
  const contactNorm = normalizeOtpContact(channel, contact)
  if (!resetToken || !contactNorm) return res.status(400).json({ status: 'Error', error: 'resetToken and contact are required', compliance })
  const entry = await resetGet(resetToken)
  if (!entry || entry.used || entry.purpose !== purpose || entry.contact !== contactNorm || Date.now() > entry.exp) {
    await resetDrop(resetToken)
    return res.status(400).json({ status: 'Error', error: 'Invalid or expired reset token. Request a new code.', compliance })
  }
  const pass = String(newPassword || '')
  if (pass.length < 6) return res.status(400).json({ status: 'Error', error: 'New password must be at least 6 characters.', compliance })
  entry.used = true
  await resetDrop(resetToken)
  res.json({ status: 'Real', reset: true, notice: 'Password reset authorized. Store the new password now.', compliance })
})

// ---------------------------------------------------------------- account recovery email (users)
// A signed-in user can attach a recovery email and use it to reset a forgotten
// password. Ownership of the address is proven with the same OTP flow. Recovery
// addresses live in app_settings (no schema migration required).
function userRecoveryKey(email) { return 'user_recovery_' + String(email || '').toLowerCase() }

async function verifySupabaseUser(req) {
  const token = req.headers['x-user-token']
  if (!token || !supabaseReady()) return null
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token }
    })
    if (!r.ok) return null
    const u = await r.json()
    return (u && u.email) ? { id: u.id, email: String(u.email).toLowerCase() } : null
  } catch (e) { return null }
}

async function supaUserIdByEmail(email) {
  if (!supabaseReady()) return null
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/profiles?email=eq.' + encodeURIComponent(email) + '&select=id', { headers: supaHeaders() })
    if (r.ok) {
      const rows = await r.json().catch(() => [])
      if (rows && rows[0] && rows[0].id) return rows[0].id
    }
  } catch (e) { /* fall through to auth list */ }
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users?page=1&per_page=1000', { headers: supaHeaders() })
    if (!r.ok) return null
    const data = await r.json().catch(() => ({}))
    const hit = (data.users || []).find(u => String(u.email || '').toLowerCase() === email)
    return hit ? hit.id : null
  } catch (e) { return null }
}

async function supaSetPassword(email, password) {
  const id = await supaUserIdByEmail(email)
  if (!id) return { ok: false, error: 'No account found for that email address.' }
  const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(id), {
    method: 'PUT', headers: supaHeaders(), body: JSON.stringify({ password })
  })
  if (!r.ok) return { ok: false, error: 'Could not update the password: ' + String(await r.text().catch(() => '')).slice(0, 160) }
  return { ok: true }
}

app.get('/api/account/recovery-email', async (req, res) => {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ status: 'Error', error: 'Please sign in again.', compliance })
  const saved = await kvGet(userRecoveryKey(user.email), null)
  res.json({ status: 'Real', email: (saved && saved.email) || '', verified: !!(saved && saved.verified), compliance })
})

app.post('/api/account/recovery-email/send', otpLimit, async (req, res) => {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ status: 'Error', error: 'Please sign in again.', compliance })
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return res.status(400).json({ status: 'Error', error: 'Enter a valid recovery email address.', compliance })
  const allowDev = DEV_ROUTES_ENABLED && req.query.dev === '1'
  const issued = await issueOtp('email', email, 'verify_email', allowDev)
  if (!issued.ok) {
    const rate = /wait|too many/i.test(issued.error || '')
    return res.status(rate ? 429 : 502).json({ status: 'Error', error: issued.error, compliance })
  }
  const out = { status: 'Real', sent: true, channel: 'email', contact: maskContact('email', email), delivery: issued.dev ? 'dev-inbox' : 'sent', compliance }
  if (issued.dev) { out.dev = true; out.code = issued.code }
  res.json(out)
})

app.post('/api/account/recovery-email/verify', authLimit, async (req, res) => {
  const user = await verifySupabaseUser(req)
  if (!user) return res.status(401).json({ status: 'Error', error: 'Please sign in again.', compliance })
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  const code = String((req.body && req.body.code) || '').trim()
  if (!EMAIL_RE.test(email) || !code) return res.status(400).json({ status: 'Error', error: 'email and code are required', compliance })
  const v = await consumeOtp('email', email, 'verify_email', code)
  if (!v.ok) return res.status(400).json({ status: 'Error', error: v.error, compliance })
  await kvSet(userRecoveryKey(user.email), { email, verified: true, at: new Date().toISOString() })
  auditLog(user.email, 'recovery_email_set', email, null, clientIp(req))
  res.json({ status: 'Real', verified: true, email, compliance })
})

// Forgot-password entry point that prefers the saved recovery email.
app.post('/api/account/forgot', otpLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return res.status(400).json({ status: 'Error', error: 'Enter a valid email address.', compliance })
  const saved = await kvGet(userRecoveryKey(email), null)
  const dest = (saved && saved.email) ? saved.email : email
  const allowDev = DEV_ROUTES_ENABLED && req.query.dev === '1'
  const issued = await issueOtp('email', dest, 'reset', allowDev)
  if (!issued.ok) {
    const rate = /wait|too many/i.test(issued.error || '')
    return res.status(rate ? 429 : 502).json({ status: 'Error', error: issued.error, compliance })
  }
  const out = { status: 'Real', sent: true, viaRecovery: !!(saved && saved.email), contact: maskContact('email', dest), delivery: issued.dev ? 'dev-inbox' : 'sent', compliance }
  if (issued.dev) { out.dev = true; out.code = issued.code }
  res.json(out)
})

app.post('/api/account/forgot/verify', authLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  const code = String((req.body && req.body.code) || '').trim()
  const saved = await kvGet(userRecoveryKey(email), null)
  const dest = (saved && saved.email) ? saved.email : email
  const v = await consumeOtp('email', dest, 'reset', code)
  if (!v.ok) return res.status(400).json({ status: 'Error', error: v.error, compliance })
  const token = crypto.randomBytes(32).toString('hex')
  await resetPut(token, { purpose: 'reset', contact: dest, account: email, exp: Date.now() + RESET_TOKEN_TTL_MS, used: false })
  res.json({ status: 'Real', verified: true, resetToken: token, compliance })
})

app.post('/api/account/reset', authLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  const resetToken = String((req.body && req.body.resetToken) || '')
  const newPassword = String((req.body && req.body.newPassword) || '')
  if (newPassword.length < 6) return res.status(400).json({ status: 'Error', error: 'Password must be at least 6 characters.', compliance })
  const entry = await resetGet(resetToken)
  if (!entry || entry.used || entry.purpose !== 'reset' || entry.account !== email || Date.now() > entry.exp) {
    await resetDrop(resetToken)
    return res.status(400).json({ status: 'Error', error: 'Invalid or expired reset link. Request a new code.', compliance })
  }
  const saved = await supaSetPassword(email, newPassword)
  if (!saved.ok) return res.status(400).json({ status: 'Error', error: saved.error, compliance })
  entry.used = true
  await resetDrop(resetToken)
  auditLog(email, 'user_password_reset', email, { via: 'recovery-email' }, clientIp(req))
  res.json({ status: 'Real', reset: true, notice: 'Password updated. Please sign in with the new password.', compliance })
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
    'Accounts/auth: demo localStorage DB on the client (no server user DB). Admin gate email: admin@seo-service-provider.com. Password reset + signup use email OTP endpoints.',
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

app.post('/api/admin/login', authLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  const password = String((req.body && req.body.password) || '')
  const ip = clientIp(req)

  // Owner/admin account
  if (ADMIN_EMAILS.includes(email)) {
    const acct = await loadAdminAccount(email)
    let ok = false
    if (acct && acct.hash) ok = verifyAdminPasswordHash(password, acct.hash)
    if (!ok) ok = safeEqual(password, ADMIN_PASSWORD)
    if (!ok) {
      auditLog(email, 'admin_login_failed', 'admin', { reason: 'wrong_password' }, ip)
      return res.status(401).json({ status: 'Error', error: 'Wrong admin password', compliance })
    }
    auditLog(email, 'admin_login', 'admin', { role: 'admin' }, ip)
    return res.json({ status: 'Real', email, role: 'admin', permissions: ['all'], token: makeAdminToken(email, 'admin'), expiresIn: ADMIN_TOKEN_TTL_MS })
  }

  // Moderator account
  const mods = await getModerators().catch(() => [])
  const mod = mods.find(m => String(m.email || '').toLowerCase() === email)
  if (mod) {
    if (mod.active === false) return res.status(401).json({ status: 'Error', error: 'This moderator account is disabled', compliance })
    if (!verifyAdminPasswordHash(password, mod.hash)) {
      auditLog(email, 'moderator_login_failed', 'moderator', { reason: 'wrong_password' }, ip)
      return res.status(401).json({ status: 'Error', error: 'Wrong moderator password', compliance })
    }
    const permissions = Array.isArray(mod.permissions) && mod.permissions.length ? mod.permissions : MODERATOR_DEFAULT_PERMISSIONS
    mod.lastLoginAt = new Date().toISOString()
    await kvSet(MODERATORS_KEY, mods).catch(() => {})
    auditLog(email, 'moderator_login', 'moderator', { permissions }, ip)
    return res.json({ status: 'Real', email, role: 'moderator', permissions, token: makeAdminToken(email, 'moderator', permissions), expiresIn: ADMIN_TOKEN_TTL_MS })
  }

  auditLog(email || 'unknown', 'login_failed', 'admin', { reason: 'not_admin' }, ip)
  return res.status(401).json({ status: 'Error', error: 'Not an admin account', compliance })
})

app.get('/api/admin/verify', (req, res) => {
  const data = verifyAdminToken(req.headers['x-admin-token'])
  if (!data) return res.status(401).json({ status: 'Error', error: 'Invalid or expired admin session' })
  res.json({ status: 'Real', email: data.email, role: data.role, permissions: data.permissions || null, expiresAt: data.exp })
})

// ---------------------------------------------------------------- admin account (password / recovery)
const ADMIN_RESET_PURPOSE = 'admin_reset'

app.get('/api/admin/account', requireAdmin, async (req, res) => {
  try {
    const acct = (await loadAdminAccount(req.adminEmail)) || {}
    res.json({
      status: 'Real',
      email: req.adminEmail,
      recoveryEmail: acct.recoveryEmail || '',
      passwordSet: !!acct.hash,
      storageReady: supabaseReady(),
      emailProvider: emailProviderConfigured(),
      compliance
    })
  } catch (e) {
    res.status(500).json({ status: 'Error', error: 'Could not load account settings.', compliance })
  }
})

app.post('/api/admin/account/password', authLimit, requireAdmin, async (req, res) => {
  const currentPassword = String((req.body && req.body.currentPassword) || '')
  const newPassword = String((req.body && req.body.newPassword) || '')
  if (newPassword.length < 8) return res.status(400).json({ status: 'Error', error: 'New password must be at least 8 characters.', compliance })
  const acct = await loadAdminAccount(req.adminEmail)
  let ok = false
  if (acct && acct.hash) ok = verifyAdminPasswordHash(currentPassword, acct.hash)
  if (!ok) ok = safeEqual(currentPassword, ADMIN_PASSWORD)
  if (!ok) return res.status(401).json({ status: 'Error', error: 'Current password is incorrect.', compliance })
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', compliance })
  try {
    await saveAdminAccount(req.adminEmail, { hash: hashAdminPassword(newPassword), passwordChangedAt: new Date().toISOString() })
    auditLog(req.adminEmail, 'admin_password_changed', 'admin', null, clientIp(req))
    res.json({ status: 'Real', changed: true, notice: 'Admin password updated. Use it from the next login.', compliance })
  } catch (e) {
    res.status(500).json({ status: 'Error', error: 'Could not save the new password. ' + String((e && e.message) || ''), compliance })
  }
})

app.post('/api/admin/account/recovery', requireAdmin, async (req, res) => {
  const recoveryEmail = String((req.body && req.body.recoveryEmail) || '').trim().toLowerCase()
  if (!EMAIL_RE.test(recoveryEmail)) return res.status(400).json({ status: 'Error', error: 'Enter a valid recovery email address.', compliance })
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  try {
    await saveAdminAccount(req.adminEmail, { recoveryEmail })
    auditLog(req.adminEmail, 'recovery_email_changed', recoveryEmail, null, clientIp(req))
    res.json({ status: 'Real', saved: true, recoveryEmail, notice: 'Recovery email saved.', compliance })
  } catch (e) {
    res.status(500).json({ status: 'Error', error: 'Could not save the recovery email.', compliance })
  }
})

// Admin password recovery (works from the admin login screen, before a session exists).
app.post('/api/admin/account/forgot', otpLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  if (!ADMIN_EMAILS.includes(email)) {
    return res.json({ status: 'Real', sent: false, notice: 'If that admin account exists, a code has been sent.', compliance })
  }
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  const acct = await loadAdminAccount(email)
  const contact = (acct && acct.recoveryEmail) || email
  const allowDev = DEV_ROUTES_ENABLED && req.query.dev === '1'
  const issued = await issueOtp('email', contact, ADMIN_RESET_PURPOSE, allowDev)
  if (!issued.ok) {
    const rate = /wait|too many/i.test(issued.error || '')
    return res.status(rate ? 429 : 502).json({ status: 'Error', error: issued.error, compliance })
  }
  const out = { status: 'Real', channel: 'email', contact: maskContact('email', contact), delivery: issued.dev ? 'dev-inbox' : 'sent', compliance }
  if (issued.dev) { out.dev = true; out.code = issued.code }
  res.json(out)
})

app.post('/api/admin/account/forgot/verify', authLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  const code = String((req.body && req.body.code) || '').trim()
  if (!ADMIN_EMAILS.includes(email)) return res.status(401).json({ status: 'Error', error: 'Invalid or expired code.', compliance })
  const acct = await loadAdminAccount(email)
  const contact = (acct && acct.recoveryEmail) || email
  const v = await consumeOtp('email', contact, ADMIN_RESET_PURPOSE, code)
  if (!v.ok) return res.status(400).json({ status: 'Error', error: v.error, compliance })
  const token = crypto.randomBytes(32).toString('hex')
  await resetPut(token, { purpose: ADMIN_RESET_PURPOSE, contact, exp: Date.now() + RESET_TOKEN_TTL_MS, used: false })
  res.json({ status: 'Real', verified: true, resetToken: token, compliance })
})

app.post('/api/admin/account/reset', authLimit, async (req, res) => {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  const resetToken = String((req.body && req.body.resetToken) || '')
  const newPassword = String((req.body && req.body.newPassword) || '')
  if (!ADMIN_EMAILS.includes(email)) return res.status(401).json({ status: 'Error', error: 'Not an admin account', compliance })
  if (newPassword.length < 8) return res.status(400).json({ status: 'Error', error: 'New password must be at least 8 characters.', compliance })
  const entry = await resetGet(resetToken)
  if (!entry || entry.used || entry.purpose !== ADMIN_RESET_PURPOSE || Date.now() > entry.exp) {
    await resetDrop(resetToken)
    return res.status(400).json({ status: 'Error', error: 'Invalid or expired reset token. Request a new code.', compliance })
  }
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  entry.used = true
  await resetDrop(resetToken)
  try {
    await saveAdminAccount(email, { hash: hashAdminPassword(newPassword), passwordChangedAt: new Date().toISOString() })
    auditLog(email, 'admin_password_reset', 'admin', { via: 'recovery' }, clientIp(req))
    res.json({ status: 'Real', reset: true, notice: 'Admin password updated. Sign in with the new password.', compliance })
  } catch (e) {
    res.status(500).json({ status: 'Error', error: 'Could not save the new password.', compliance })
  }
})

// ---------------------------------------------------------------- site config (public)
// Public, non-sensitive configuration the storefront reads: maintenance state,
// registration toggle, live plans and enabled payment methods.
app.get('/api/site-config', async (req, res) => {
  try {
    const [settings, plans, methods] = await Promise.all([getSiteSettings(), getPlans(), getPaymentMethods()])
    res.json({
      status: 'Real',
      maintenance: !!settings.maintenance,
      allowRegistration: settings.allowRegistration !== false,
      concurrencyLimit: settings.concurrencyLimit,
      plans: plans.filter(p => p.active !== false),
      paymentMethods: methods.filter(m => m.enabled !== false),
      delivery: deliveryStatus(),
      updatedAt: settings.updatedAt || null
    })
  } catch (e) {
    res.json({ status: 'Real', maintenance: false, allowRegistration: true, plans: [], paymentMethods: [], delivery: deliveryStatus() })
  }
})

// ---------------------------------------------------------------- payment proof submissions
// Users submit a manual payment proof for bKash/Bank/Binance Pay etc. Accepts
// an order id, a transaction hash, a screenshot, or any combination; at least
// one is required. Stored server-side so admins/moderators with access can
// review it from any device (no dependency on new payments columns).
const PAYMENT_PROOFS_KEY = 'payment_proofs'
const PROOF_CAP = 1000
const PROOF_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/

app.post('/api/payment/proof', generalLimit, async (req, res) => {
  const b = req.body || {}
  const email = String(b.email || '').trim().toLowerCase()
  const orderId = String(b.orderId || '').trim().slice(0, 120)
  const trx = String(b.trx || '').trim().slice(0, 160)
  const proofImage = typeof b.proofImage === 'string' ? b.proofImage : ''
  if (!EMAIL_RE.test(email)) return res.status(400).json({ status: 'Error', error: 'A valid account email is required.', compliance })
  if (!orderId && !trx && !proofImage) return res.status(400).json({ status: 'Error', error: 'Provide a Binance order ID, a transaction hash, or a payment screenshot.', compliance })
  if (proofImage && (!PROOF_IMAGE_RE.test(proofImage) || proofImage.length > 2000000)) {
    return res.status(400).json({ status: 'Error', error: 'Screenshot must be a PNG/JPG/WEBP/GIF image under 1.5 MB.', compliance })
  }
  const proof = {
    id: newId('proof'),
    email,
    name: String(b.name || '').slice(0, 80),
    plan: String(b.plan || '').slice(0, 40),
    planName: String(b.planName || '').slice(0, 60),
    amount: Number(b.amount) || 0,
    method: String(b.method || '').slice(0, 60),
    methodId: String(b.methodId || '').slice(0, 40),
    trx,
    orderId,
    proofImage,
    status: 'pending',
    createdAt: new Date().toISOString()
  }
  try {
    const list = (await kvGet(PAYMENT_PROOFS_KEY, [])) || []
    const arr = Array.isArray(list) ? list : []
    arr.unshift(proof)
    // strip image bodies from older entries beyond a small window to keep storage small
    const trimmed = arr.slice(0, 200)
    await kvSet(PAYMENT_PROOFS_KEY, trimmed)
    sysLog('info', 'payment-proof', 'Proof submitted for ' + proof.planName + ' via ' + proof.method, { email, orderId: orderId || null, hasImage: !!proofImage, trx: trx || null })
    res.json({ status: 'Real', proof: { id: proof.id, status: proof.status, createdAt: proof.createdAt }, compliance })
  } catch (e) {
    res.status(500).json({ status: 'Error', error: 'Could not save the payment proof.', compliance })
  }
})

app.get('/api/admin/payment-proofs', requireAdmin, async (req, res) => {
  if (req.adminRole !== 'admin') return res.status(403).json({ status: 'Error', error: 'Only the owner can review payment proofs.', compliance })
  const list = (await kvGet(PAYMENT_PROOFS_KEY, [])) || []
  const arr = Array.isArray(list) ? list : []
  res.json({ status: 'Real', proofs: arr.slice(0, 200), total: arr.length, compliance })
})

app.patch('/api/admin/payment-proofs/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const status = String((req.body && req.body.status) || '').toLowerCase()
  if (['approved', 'rejected', 'pending'].indexOf(status) < 0) return res.status(400).json({ status: 'Error', error: 'status must be approved, rejected or pending', compliance })
  const list = (await kvGet(PAYMENT_PROOFS_KEY, [])) || []
  const arr = Array.isArray(list) ? list : []
  const proof = arr.find(p => p.id === req.params.id)
  if (!proof) return res.status(404).json({ status: 'Error', error: 'Payment proof not found', compliance })
  proof.status = status
  proof.reviewedAt = new Date().toISOString()
  proof.reviewedBy = req.adminEmail
  await kvSet(PAYMENT_PROOFS_KEY, arr)
  auditLog(req.adminEmail, 'payment_proof_' + status, proof.id, { email: proof.email, orderId: proof.orderId || null, trx: proof.trx || null, amount: proof.amount }, clientIp(req))
  sysLog(status === 'approved' ? 'success' : 'warn', 'payment-proof', 'Proof ' + status + ' for ' + proof.email, { id: proof.id, amount: proof.amount })
  res.json({ status: 'Real', proof, compliance })
})

// ---------------------------------------------------------------- logs (admin + moderator)
async function requireLogAccess(req, res, next) {
  if (req.adminRole === 'admin') return next()
  const perms = req.adminPermissions || []
  if (perms.indexOf('logs') >= 0) return next()
  return res.status(403).json({ status: 'Error', error: 'Your role cannot view logs.', compliance })
}

app.get('/api/admin/logs', requireAdmin, requireLogAccess, async (req, res) => {
  const limit = Number(req.query.limit) || 200
  const type = String(req.query.type || 'all')
  const out = { status: 'Real', concurrencyLimit: (await getSiteSettings()).concurrencyLimit, inFlight: INFLIGHT }
  if (type === 'all' || type === 'system') out.system = await getLogs(SYSTEM_LOGS_KEY, limit)
  if (type === 'all' || type === 'audit') out.audit = (req.adminRole === 'admin') ? await getLogs(AUDIT_LOGS_KEY, limit) : []
  res.json(out)
})

app.post('/api/admin/logs/clear', requireAdmin, requireRole('admin'), async (req, res) => {
  const type = String((req.body && req.body.type) || 'system')
  if (type === 'audit') await clearLogs(AUDIT_LOGS_KEY)
  else await clearLogs(SYSTEM_LOGS_KEY)
  auditLog(req.adminEmail, 'logs_cleared', type, null, clientIp(req))
  res.json({ status: 'Real', cleared: type, compliance })
})

// ---------------------------------------------------------------- settings / maintenance (admin)
app.get('/api/admin/settings', requireAdmin, requireRole('admin'), async (req, res) => {
  res.json({ status: 'Real', settings: await getSiteSettings(), compliance })
})

app.post('/api/admin/settings', requireAdmin, requireRole('admin'), async (req, res) => {
  const b = req.body || {}
  const patch = {}
  if (b.maintenance !== undefined) patch.maintenance = !!b.maintenance
  if (b.allowRegistration !== undefined) patch.allowRegistration = !!b.allowRegistration
  if (b.concurrencyLimit !== undefined) patch.concurrencyLimit = Number(b.concurrencyLimit)
  try {
    const saved = await saveSiteSettings(patch, req.adminEmail)
    auditLog(req.adminEmail, 'settings_updated', 'site_settings', patch, clientIp(req))
    sysLog('info', 'settings', 'Site settings updated', patch)
    res.json({ status: 'Real', settings: saved, compliance })
  } catch (e) {
    res.status(400).json({ status: 'Error', error: String((e && e.message) || 'Could not save settings'), compliance })
  }
})

// ---------------------------------------------------------------- plans (admin)
app.get('/api/admin/plans', requireAdmin, requireRole('admin'), async (req, res) => {
  res.json({ status: 'Real', plans: await getPlans(), compliance })
})

app.post('/api/admin/plans', requireAdmin, requireRole('admin'), async (req, res) => {
  try {
    const plan = await savePlan(req.body || {}, req.adminEmail)
    auditLog(req.adminEmail, 'plan_saved', plan.id, { name: plan.name, price: plan.price }, clientIp(req))
    res.json({ status: 'Real', plan, plans: await getPlans(), compliance })
  } catch (e) {
    res.status(400).json({ status: 'Error', error: String((e && e.message) || 'Could not save plan'), compliance })
  }
})

app.delete('/api/admin/plans/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const removed = await deletePlan(req.params.id, req.adminEmail)
  if (removed) auditLog(req.adminEmail, 'plan_deleted', req.params.id, null, clientIp(req))
  res.json({ status: 'Real', removed, plans: await getPlans(), compliance })
})

// ---------------------------------------------------------------- payment methods (admin)
app.get('/api/admin/payment-methods', requireAdmin, requireRole('admin'), async (req, res) => {
  res.json({ status: 'Real', methods: await getPaymentMethods(), compliance })
})

app.post('/api/admin/payment-methods', requireAdmin, requireRole('admin'), async (req, res) => {
  try {
    const method = await savePaymentMethod(req.body || {}, req.adminEmail)
    auditLog(req.adminEmail, 'payment_method_saved', method.id, { label: method.label, enabled: method.enabled }, clientIp(req))
    res.json({ status: 'Real', method, methods: await getPaymentMethods(), compliance })
  } catch (e) {
    res.status(400).json({ status: 'Error', error: String((e && e.message) || 'Could not save payment method'), compliance })
  }
})

app.delete('/api/admin/payment-methods/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const removed = await deletePaymentMethod(req.params.id, req.adminEmail)
  if (removed) auditLog(req.adminEmail, 'payment_method_deleted', req.params.id, null, clientIp(req))
  res.json({ status: 'Real', removed, methods: await getPaymentMethods(), compliance })
})

// ---------------------------------------------------------------- moderators (admin)
app.get('/api/admin/moderators', requireAdmin, requireRole('admin'), async (req, res) => {
  const mods = await getModerators()
  res.json({ status: 'Real', moderators: mods.map(publicModerator), allowedPermissions: MODERATOR_DEFAULT_PERMISSIONS, compliance })
})

app.post('/api/admin/moderators', requireAdmin, requireRole('admin'), async (req, res) => {
  try {
    const mod = await createModerator(req.body || {}, req.adminEmail)
    auditLog(req.adminEmail, 'moderator_created', mod.id, { email: mod.email }, clientIp(req))
    res.json({ status: 'Real', moderator: mod, moderators: (await getModerators()).map(publicModerator), compliance })
  } catch (e) {
    res.status(400).json({ status: 'Error', error: String((e && e.message) || 'Could not create moderator'), compliance })
  }
})

app.patch('/api/admin/moderators/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  try {
    const mod = await updateModerator(req.params.id, req.body || {}, req.adminEmail)
    auditLog(req.adminEmail, 'moderator_updated', mod.id, { email: mod.email, active: mod.active }, clientIp(req))
    res.json({ status: 'Real', moderator: mod, moderators: (await getModerators()).map(publicModerator), compliance })
  } catch (e) {
    res.status(400).json({ status: 'Error', error: String((e && e.message) || 'Could not update moderator'), compliance })
  }
})

app.delete('/api/admin/moderators/:id', requireAdmin, requireRole('admin'), async (req, res) => {
  const removed = await deleteModerator(req.params.id, req.adminEmail)
  if (removed) auditLog(req.adminEmail, 'moderator_deleted', req.params.id, null, clientIp(req))
  res.json({ status: 'Real', removed, moderators: (await getModerators()).map(publicModerator), compliance })
})

// ---------------------------------------------------------------- admin audit trail (from UI actions)
app.post('/api/admin/audit', requireAdmin, async (req, res) => {
  const b = req.body || {}
  const action = String(b.action || '').slice(0, 60)
  if (!action) return res.status(400).json({ status: 'Error', error: 'action is required', compliance })
  auditLog(req.adminEmail, action, b.target ? String(b.target).slice(0, 80) : null, b.meta || null, clientIp(req))
  res.json({ status: 'Real', logged: true, compliance })
})

// ---------------------------------------------------------------- live chat (admin + moderator)
async function supaChatRows(query) {
  if (!supabaseReady()) return null
  const r = await fetch(SUPABASE_URL + '/rest/v1/chats?' + query, { headers: supaHeaders() })
  if (!r.ok) throw new Error('chat read ' + r.status)
  return await r.json()
}

app.get('/api/admin/chats', requireAdmin, async (req, res) => {
  if (req.adminRole !== 'admin' && (req.adminPermissions || []).indexOf('chats') < 0) {
    return res.status(403).json({ status: 'Error', error: 'Your role cannot access live chat.', compliance })
  }
  try {
    if (!supabaseReady()) return res.json({ status: 'Real', chats: [], storageReady: false, compliance })
    const rows = await supaChatRows('select=id,client_ref,email,name,messages,user_unread,admin_unread,updated_at&order=updated_at.desc&limit=100')
    res.json({ status: 'Real', chats: rows || [], storageReady: true, compliance })
  } catch (e) {
    res.status(502).json({ status: 'Error', error: 'Could not load chats: ' + String((e && e.message) || ''), compliance })
  }
})

app.post('/api/admin/chats/reply', requireAdmin, async (req, res) => {
  if (req.adminRole !== 'admin' && (req.adminPermissions || []).indexOf('chats') < 0) {
    return res.status(403).json({ status: 'Error', error: 'Your role cannot reply to live chat.', compliance })
  }
  const email = String((req.body && req.body.email) || '').toLowerCase().trim()
  const text = String((req.body && req.body.text) || '').trim().slice(0, 2000)
  if (!email || !text) return res.status(400).json({ status: 'Error', error: 'email and text are required', compliance })
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  try {
    const rows = await supaChatRows('select=id,messages&email=eq.' + encodeURIComponent(email) + '&limit=1')
    const row = rows && rows[0]
    if (!row) return res.status(404).json({ status: 'Error', error: 'Chat not found for that user.', compliance })
    const messages = Array.isArray(row.messages) ? row.messages : []
    messages.push({ from: 'admin', text, at: new Date().toISOString(), by: req.adminEmail, role: req.adminRole })
    const up = await fetch(SUPABASE_URL + '/rest/v1/chats?id=eq.' + encodeURIComponent(row.id), {
      method: 'PATCH',
      headers: supaHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ messages, admin_unread: 0, updated_at: new Date().toISOString() })
    })
    if (!up.ok) throw new Error('chat update ' + up.status)
    auditLog(req.adminEmail, 'chat_reply', email, { role: req.adminRole }, clientIp(req))
    res.json({ status: 'Real', replied: true, compliance })
  } catch (e) {
    res.status(502).json({ status: 'Error', error: 'Could not send reply: ' + String((e && e.message) || ''), compliance })
  }
})

// ---------------------------------------------------------------- broadcast + create user
app.post('/api/admin/chats/broadcast', requireAdmin, requireRole('admin'), async (req, res) => {
  const text = String((req.body && req.body.text) || '').trim().slice(0, 2000)
  if (!text) return res.status(400).json({ status: 'Error', error: 'Broadcast text is required', compliance })
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  try {
    const rows = await supaChatRows('select=id,messages,user_unread&limit=1000')
    let sent = 0
    for (const row of (rows || [])) {
      const messages = Array.isArray(row.messages) ? row.messages : []
      messages.push({ from: 'admin', text, at: new Date().toISOString(), by: req.adminEmail, role: 'admin', broadcast: true })
      const up = await fetch(SUPABASE_URL + '/rest/v1/chats?id=eq.' + encodeURIComponent(row.id), {
        method: 'PATCH', headers: supaHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ messages, user_unread: (Number(row.user_unread) || 0) + 1, updated_at: new Date().toISOString() })
      })
      if (up.ok) sent++
    }
    auditLog(req.adminEmail, 'chat_broadcast', 'all-users', { sent, text: text.slice(0, 80) }, clientIp(req))
    sysLog('info', 'chat', 'Broadcast sent to ' + sent + ' user(s)')
    res.json({ status: 'Real', sent, compliance })
  } catch (e) {
    res.status(502).json({ status: 'Error', error: 'Broadcast failed: ' + String((e && e.message) || ''), compliance })
  }
})

app.post('/api/admin/users', requireAdmin, requireRole('admin'), async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim().slice(0, 80)
  const email = String((req.body && req.body.email) || '').trim().toLowerCase()
  const password = String((req.body && req.body.password) || '')
  if (!name) return res.status(400).json({ status: 'Error', error: 'User name is required', compliance })
  if (!EMAIL_RE.test(email)) return res.status(400).json({ status: 'Error', error: 'Enter a valid email address', compliance })
  if (password.length < 8) return res.status(400).json({ status: 'Error', error: 'Password must be at least 8 characters', compliance })
  if (!supabaseReady()) return res.status(503).json({ status: 'Error', error: 'Server storage is not configured.', compliance })
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers: supaHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, created_by: req.adminEmail } })
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      return res.status(400).json({ status: 'Error', error: 'Could not create user: ' + body.slice(0, 200), compliance })
    }
    const data = await r.json()
    const uid = data && (data.id || (data.user && data.user.id))
    if (uid) {
      await fetch(SUPABASE_URL + '/rest/v1/profiles?on_conflict=id', {
        method: 'POST', headers: supaHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([{ id: uid, name, email }])
      }).catch(() => {})
    }
    auditLog(req.adminEmail, 'user_created', email, { uid }, clientIp(req))
    res.json({ status: 'Real', user: { id: uid, name, email }, compliance })
  } catch (e) {
    res.status(502).json({ status: 'Error', error: 'Could not create user: ' + String((e && e.message) || ''), compliance })
  }
})

// Delivery diagnostics + test send (admin only). Makes the real email
// configuration visible so failures are obvious instead of silent.
app.get('/api/admin/delivery', requireAdmin, async (req, res) => {
  res.json({
    status: 'Real',
    delivery: deliveryStatus(),
    env: {
      brevo: !!process.env.BREVO_API_KEY,
      resend: !!process.env.RESEND_API_KEY,
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      emailFrom: process.env.EMAIL_FROM || null
    },
    compliance
  })
})

app.post('/api/admin/delivery/test', requireAdmin, requireRole('admin'), async (req, res) => {
  const norm = normalizeOtpContact('email', (req.body && req.body.contact) || '')
  if (!EMAIL_RE.test(norm)) return res.status(400).json({ status: 'Error', error: 'Enter a valid email address.', compliance })
  if (!emailProviderConfigured()) {
    return res.status(503).json({ status: 'Error', error: 'No email provider is configured yet. Add BREVO_API_KEY (or Resend/SMTP).', compliance })
  }
  const sent = await sendRealOtp('email', norm, '123456', 'test')
  auditLog(req.adminEmail, 'delivery_test', 'email:' + maskContact('email', norm), { ok: sent.ok }, clientIp(req))
  if (!sent.ok) return res.status(502).json({ status: 'Error', error: sent.error || 'Delivery failed.', compliance })
  res.json({ status: 'Real', sent: true, channel: 'email', to: maskContact('email', norm), compliance })
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
      reply = 'I understood your question but live AI answering is temporarily unavailable. For now I can help with pricing, tools, the generator or contact info - or reach a human on WhatsApp ' + SUPPORT_WHATSAPP + '.'
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
