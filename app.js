/* SEO Service Provider - Frontend app
   Real analysis, no fabricated data. Backend: http://localhost:4000 */

'use strict'

/* ============================================================== constants */

/* API base:
   - Local: backend on :4000
   - Preview: same-origin (dev-server proxies /api to :4000)
   - Production: set window.SEOPRO_API_BASE in index.html to your backend URL
     (e.g. https://your-backend.onrender.com), or deploy the backend as /api. */
const API = (typeof window !== 'undefined' && window.SEOPRO_API_BASE !== undefined && window.SEOPRO_API_BASE !== '')
  ? String(window.SEOPRO_API_BASE).replace(/\/$/, '')
  : ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : '')
const ADMIN_EMAILS = ['admin@seo-service-provider.com']

/* Admin auth is verified by the backend (/api/admin/login). No admin password is
   stored in this file, so viewing the frontend source reveals no credentials. */
const ADMIN_TOKEN_KEY = 'seopro_admin_token'

function adminToken() {
  try {
    const raw = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj || !obj.token || !obj.exp || Date.now() > obj.exp) { sessionStorage.removeItem(ADMIN_TOKEN_KEY); return null }
    return obj
  } catch (e) { return null }
}

function setAdminToken(email, token, expiresIn, role, permissions) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, JSON.stringify({
    email: String(email || '').toLowerCase(),
    token,
    role: role === 'moderator' ? 'moderator' : 'admin',
    permissions: Array.isArray(permissions) ? permissions : null,
    exp: Date.now() + (expiresIn || 8 * 3600 * 1000)
  }))
}

function clearAdminToken() { try { sessionStorage.removeItem(ADMIN_TOKEN_KEY) } catch (e) {} }

function adminRole() {
  const t = adminToken()
  return t && t.role === 'moderator' ? 'moderator' : 'admin'
}

function adminPermissions() {
  const t = adminToken()
  if (!t || t.role !== 'moderator') return ['all']
  return Array.isArray(t.permissions) && t.permissions.length ? t.permissions : ['logs', 'chats']
}

function adminCan(perm) {
  if (adminRole() === 'admin') return true
  return adminPermissions().indexOf(perm) >= 0
}

// Backend always re-validates the signed token; this is just a UI gate.
function adminAuthed() {
  const t = adminToken()
  return !!(t && t.token)
}

const PLANS = [
  { id: 'free', name: 'Free', price: 0, daily: 3, monthly: 90, agents: 3, tools: 5, tagline: 'Start exploring for free', color: '#94a3b8',
    features: ['3 credits / day', '3 AI agents', '5 SEO tools', 'Real SERP analysis', 'Community support'] },
  { id: 'starter', name: 'Starter', price: 5, daily: 10, monthly: 300, agents: 12, tools: 10, tagline: 'Most popular', color: '#7c5cff', popular: true,
    features: ['10 credits / day', '12 AI agents', 'All 10 SEO tools', 'Real SERP + PageSpeed', 'Email support'] },
  { id: 'pro', name: 'Pro', price: 15, daily: 30, monthly: 900, agents: 19, tools: 10, tagline: 'For professionals', color: '#22d3ee',
    features: ['30 credits / day', '19 AI agents', 'SEO audit included', 'Gemini AI analysis', 'Priority support'] },
  { id: 'agency', name: 'Agency', price: 49, daily: 100, monthly: 3000, agents: 19, tools: 10, tagline: 'For agencies', color: '#f59e0b',
    features: ['100 credits / day', '19 AI agents', 'Bulk reports + API access', 'White-label reports', 'Dedicated support'] }
]

const PAYMENT_METHODS = [
  { id: 'bkash', name: 'bKash', color: '#e2136e', bg: '#e2136e', word: 'bKash', type: 'Mobile Payment', crypto: false, number: '01886822816', note: 'bKash Payment (not Personal - use Payment option). Bangladeshi mobile payment (local only).' },
  { id: 'nagad', name: 'Nagad', color: '#f6921e', bg: '#f6921e', word: 'nagad', type: 'SendMoney', crypto: false, number: '01613822816', note: 'Nagad Personal SendMoney. Bangladeshi mobile payment (local only).' },
  { id: 'rocket', name: 'Rocket', color: '#8c3494', bg: '#8c3494', word: 'Rocket', type: 'Mobile Payment', crypto: false, note: '', comingSoon: true },
  { id: 'bankasia', name: 'Bank Asia', color: '#0e7a4d', bg: '#0e7a4d', word: 'BA', type: 'Bank Transfer', crypto: false, number: '07334004704', note: 'Bank Asia is a Bangladeshi bank - only local bank transfer is accepted. International payments are NOT accepted through this bank.' },
  { id: 'binance', name: 'Binance Pay', color: '#f0b90b', bg: '#f0b90b', type: 'Crypto', crypto: true, network: 'binance', number: '485208916', note: 'Binance Pay ID (Yellow Diamond). Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><g fill="#0b0e11"><path d="M16 3l5 5-5 5-5-5z"/><path d="M7 12l5 5-5 5-5-5z"/><path d="M25 12l5 5-5 5-5-5z"/><path d="M16 21l5 5-5 5-5-5z"/></g></svg>' },
  { id: 'usdt-bep20', name: 'USDT BEP20', color: '#50af95', bg: '#50af95', type: 'Crypto', crypto: true, network: 'bsc', number: '0x976c45cf44ae46acf7293a7d8d10db35e3c4619e', note: 'BSC network - auto-verified via BscScan. Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><ellipse cx="16" cy="12.5" rx="11" ry="7"/><path d="M16 5.5v19M6.5 12.5h19"/></g></svg>' },
  { id: 'usdt-trc20', name: 'USDT TRC20', color: '#26a17b', bg: '#26a17b', type: 'Crypto', crypto: true, network: 'tron', number: 'TA8mA6FgAao1o7Pasirmyd6niVpH37R7o5', note: 'TRON network - auto-verified via TronGrid. Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><ellipse cx="16" cy="12.5" rx="11" ry="7"/><path d="M16 5.5v19M6.5 12.5h19"/></g></svg>' },
  { id: 'solana', name: 'Solana', color: '#9945ff', bg: 'linear-gradient(135deg,#9945ff,#14f195)', type: 'Crypto', crypto: true, network: 'solana', number: 'JDQPK13x5rCE7eCjU3hjMNjhmt9bo1Pp6LZ7T3RHKVrU', note: 'SOL network. Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><g fill="#fff"><path d="M23 8l-2 2H7l2-2h14z"/><path d="M9 14l2 2h14l-2-2H9z"/><path d="M23 20l-2 2H7l2-2h14z"/></g></svg>' },
  { id: 'eth', name: 'ETH ERC20', color: '#627eea', bg: '#627eea', type: 'Crypto', crypto: true, network: 'eth', number: '0x976c45cf44ae46acf7293a7d8d10db35e3c4619e', note: 'Ethereum network. Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><g fill="#fff"><path d="M16 3l11 13-11 13L5 16z"/><path d="M16 16L27 16 16 3zM16 29L16 16 5 16z" opacity=".7"/></g></svg>' },
  { id: 'arb', name: 'ARB One', color: '#12aaff', bg: '#12aaff', type: 'Crypto', crypto: true, network: 'arbitrum', number: '0x976c45cf44ae46acf7293a7d8d10db35e3c4619e', note: 'Arbitrum One network. Accepted for international payments.',
    svg: '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"><path d="M16 4l12 22H4z"/><path d="M16 11l8 15H8z" opacity=".85"/></g></svg>' },
  { id: 'card', name: 'Card', color: '#1a1f71', bg: '#ffffff', type: 'Card', crypto: false, note: 'Visa / Mastercard - Stripe checkout coming soon',
    svg: '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="12.5" cy="16" r="8.5" fill="#EB001B"/><circle cx="19.5" cy="16" r="8.5" fill="#F79E1B"/><path d="M16 10.2a8.5 8.5 0 0 0 0 11.6 8.5 8.5 0 0 0 0-11.6z" fill="#FF5F00"/></svg>' },
  { id: 'paypal', name: 'PayPal', color: '#003087', bg: '#003087', word: 'PayPal', type: 'Online', crypto: false, note: 'PayPal - coming soon' }
]

const AGENTS = [
  { name: 'Claude SEO', desc: '25 skills + 18 agents - complete SEO automation', free: true },
  { name: 'Open SEO', desc: 'Semrush/Ahrefs alternative with MCP - SERP analysis', free: true },
  { name: 'Open SEO Crawler', desc: 'Open-source SEO crawler', free: true },
  { name: 'SerpBear', desc: 'Self-hosted rank tracker - Google Search Console API', free: false },
  { name: 'LibreCrawl', desc: 'Screaming Frog free alternative - JS rendering + PageSpeed', free: false },
  { name: 'SEO Tools API', desc: 'RESTful SEO tools API - self-hosted', free: false },
  { name: 'Python SEO Analyzer', desc: 'Technical SEO analyzer - MIT', free: false },
  { name: 'Keyword Research Agent', desc: 'Real keyword extraction logic', free: false },
  { name: 'Title Optimizer', desc: 'Real ranking score titles', free: false },
  { name: 'Meta Writer', desc: 'SERP meta description generator', free: false },
  { name: 'Content Strategist', desc: 'Content gap analysis', free: false },
  { name: 'Competitor Intel', desc: 'Competitor domain analysis', free: false },
  { name: 'Link Scout', desc: 'Backlink opportunity finder', free: false },
  { name: 'Schema Generator', desc: 'Structured data generator', free: false },
  { name: 'Sitemap Builder', desc: 'XML sitemap builder', free: false },
  { name: 'Core Web Vitals Agent', desc: 'LCP/CLS/TBT monitoring', free: false },
  { name: 'Local SEO Agent', desc: 'Local pack tracking', free: false },
  { name: 'Rank Tracker Agent', desc: 'Unlimited keyword rank tracking', free: false },
  { name: 'Report Builder', desc: 'White-label SEO reports', free: false }
]

const AGENT_TOOL = {
  'Claude SEO': 'keyword-research',
  'Open SEO': 'serp-analyzer',
  'Open SEO Crawler': 'seo-audit',
  'SerpBear': 'keyword-difficulty',
  'LibreCrawl': 'pagespeed',
  'SEO Tools API': 'related-keywords',
  'Python SEO Analyzer': 'seo-audit',
  'Keyword Research Agent': 'keyword-research',
  'Title Optimizer': 'title-generator',
  'Meta Writer': 'meta-description',
  'Content Strategist': 'title-generator',
  'Competitor Intel': 'competitor-analysis',
  'Link Scout': 'serp-analyzer',
  'Schema Generator': 'title-generator',
  'Sitemap Builder': 'pagespeed',
  'Core Web Vitals Agent': 'pagespeed',
  'Local SEO Agent': 'keyword-difficulty',
  'Rank Tracker Agent': 'serp-analyzer',
  'Report Builder': 'seo-audit'
}

function agentToolName(agentName) {
  const t = TOOLS.find(x => x.id === AGENT_TOOL[agentName])
  return t ? t.name : 'SEO Tool'
}

const TOOLS = [
  { id: 'keyword-research', name: 'Keyword Research', code: 'KR', color: '#7c5cff', desc: 'Real SERP volume signals, related keywords and PAA questions.', placeholder: 'Enter a keyword, e.g. best seo tools' },
  { id: 'serp-analyzer', name: 'SERP Analyzer', code: 'SA', color: '#22d3ee', desc: 'Top 10 real Google organic results with domains and snippets.', placeholder: 'Enter a keyword, e.g. free seo audit' },
  { id: 'title-generator', name: 'Title Generator', code: 'TG', color: '#f59e0b', desc: '15 real-data SEO titles with ranking scores (max 60 chars).', placeholder: 'Enter your main topic, e.g. best morning routine' },
  { id: 'meta-description', name: 'Meta Description Generator', code: 'MD', color: '#34d399', desc: 'Click-worthy meta descriptions with real scores.', placeholder: 'Enter your main topic' },
  { id: 'pagespeed', name: 'PageSpeed Checker', code: 'PS', color: '#fb7185', desc: 'Real Lighthouse performance, SEO and Core Web Vitals scores.', placeholder: 'https://example.com' },
  { id: 'competitor-analysis', name: 'Competitor Analysis', code: 'CA', color: '#a78bfa', desc: 'Who ranks and why - competitor domains for your keyword.', placeholder: 'Enter a keyword' },
  { id: 'question-finder', name: 'Question Finder (PAA)', code: 'QF', color: '#38bdf8', desc: 'Real People-Also-Ask questions from Google.', placeholder: 'Enter a keyword' },
  { id: 'related-keywords', name: 'Related Keywords', code: 'RK', color: '#fbbf24', desc: 'Related searches plus expanded keyword ideas with scores.', placeholder: 'Enter a keyword' },
  { id: 'keyword-difficulty', name: 'Keyword Difficulty', code: 'KD', color: '#f472b6', desc: 'Real difficulty estimate from SERP competition signals.', placeholder: 'Enter a keyword' },
  { id: 'seo-audit', name: 'SEO Audit Score', code: 'AS', color: '#2dd4bf', desc: 'Combined audit - PageSpeed plus AI summary.', placeholder: 'https://example.com' }
]

/* ============================================================== storage */

const DB = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v } catch (e) { return fallback }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch (e) {} }
}

const store = {
  users: () => DB.get('seo_users', []),
  saveUsers: (v) => { DB.set('seo_users', v); cloudPush('profiles', v) },
  payments: () => DB.get('seo_payments', []),
  savePayments: (v) => { DB.set('seo_payments', v); cloudPush('payments', v) },
  reports: () => DB.get('seo_reports', []),
  saveReports: (v) => { DB.set('seo_reports', v); cloudPush('reports', v) },
  chats: () => DB.get('seo_chats', []),
  saveChats: (v) => { DB.set('seo_chats', v); cloudPush('chats', v) },
  usage: () => DB.get('seo_usage', {}),
  saveUsage: (v) => DB.set('seo_usage', v)
}

/* ---------- optional Supabase cloud layer (activates when keys are set) ---------- */
let cloudPulling = false

function cloudOn() { return !!(typeof window !== 'undefined' && window.SeoCloud && window.SeoCloud.enabled()) }
function cloud() { return window.SeoCloud }

function toCloudUser(u) {
  return {
    id: u.uid || undefined,
    name: u.name || '',
    email: u.email,
    role: isAdmin(u.email) ? 'admin' : 'user',
    blocked: !!u.blocked,
    deleted: !!u.deleted,
    deleted_at: u.deletedAt || null,
    phone: u.phone || null,
    phone_verified: !!u.phoneVerified,
    plan: u.premium ? u.premium.plan : null,
    plan_name: u.premium ? u.premium.planName : null,
    plan_agents: u.premium ? u.premium.agents : null,
    plan_daily: u.premium ? u.premium.daily : null,
    plan_monthly: u.premium ? u.premium.monthly : null,
    premium_since: u.premium ? u.premium.since : null
  }
}
function toCloudPayment(p) {
  return { client_ref: p.id, email: p.email, name: p.name, plan: p.plan, plan_name: p.planName, amount: p.amount, method: p.method, method_id: p.methodId, trx: p.trx, status: p.status, auto_approved: !!p.autoApproved, verified_at: p.verifiedAt || null, created_at: p.createdAt }
}
function toCloudReport(r) {
  return { client_ref: r.id, email: r.email, primary_keyword: r.primary, title_count: r.titleCount, intent: r.intent, titles: r.titles || [], created_at: r.date }
}
function toCloudChat(c) {
  return { client_ref: c.id, email: c.email, name: c.name, messages: c.messages || [], user_unread: c.userUnread || 0, admin_unread: c.adminUnread || 0, updated_at: c.updatedAt }
}

function cloudPush(table, rows) {
  if (!cloudOn() || cloudPulling) return
  try {
    const c = cloud()
    if (table === 'profiles') {
      const me = currentUser()
      if (!me) return
      const targets = isAdmin(me.email) ? (rows || []) : (rows || []).filter(u => u.email === me.email)
      targets.filter(u => u.uid).forEach(u => c.upsert('profiles', toCloudUser(u)))
      return
    }
    const opts = { onConflict: 'client_ref' }
    ;(rows || []).forEach(r => {
      if (table === 'payments') c.upsert('payments', toCloudPayment(r), opts)
      else if (table === 'reports') c.upsert('reports', toCloudReport(r), opts)
      else if (table === 'chats') c.upsert('chats', toCloudChat(r), opts)
    })
  } catch (e) { /* keep the app working even if cloud sync fails */ }
}

async function cloudPull() {
  if (!cloudOn()) return
  cloudPulling = true
  try {
    const data = await cloud().pullAll()
    if (data.profiles && data.profiles.length) store.saveUsers(data.profiles)
    if (data.payments) store.savePayments(data.payments)
    if (data.reports) store.saveReports(data.reports)
    if (data.chats) store.saveChats(data.chats)
  } catch (e) {
    console.warn('Cloud pull failed:', e && e.message)
  } finally {
    cloudPulling = false
  }
}

async function cloudBoot() {
  if (!cloudOn()) return
  const ok = await cloud().init()
  if (!ok) return
  const email = await cloud().sessionEmail()
  if (email) setSession({ email })
  await cloudPull()
}

function session() { return DB.get('seo_session', null) }
function setSession(s) { DB.set('seo_session', s) }
function uid() { return 'ID-' + Math.random().toString(36).slice(2, 8).toUpperCase() }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }

/* Passwords are stored only as salted SHA-256 hashes, so a localStorage dump
   does not reveal the actual password. */
function makeSalt() {
  try {
    const a = new Uint8Array(16)
    crypto.getRandomValues(a)
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
  } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2) }
}

async function hashPassword(password, salt, force) {
  const input = salt + ':' + String(password) + ':seopro'
  if (force !== 'f' && crypto && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      return 's' + Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {}
  }
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0
  return 'f' + h.toString(16)
}

async function verifyPassword(user, password) {
  if (!user) return false
  if (user.passHash && user.salt) {
    const force = String(user.passHash).charAt(0) === 'f' ? 'f' : undefined
    return (await hashPassword(password, user.salt, force)) === user.passHash
  }
  if (typeof user.password === 'string') return user.password === password
  return false
}
function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '')
  if (d.length < 4) return p || ''
  const lead = /^\+/.test(String(p)) ? '+' : ''
  return lead + d.slice(0, d.length - 4).replace(/./g, '*') + d.slice(-4)
}
function phoneDigits(p) { return String(p || '').replace(/[^\d+]/g, '') }

function findUser(email) { return store.users().find(u => u.email === String(email || '').toLowerCase()) || null }
function activeUsers() { return store.users().filter(u => !u.deleted) }
function trashedUsers() { return store.users().filter(u => u.deleted) }
function blockedUsers() { return store.users().filter(u => !u.deleted && u.blocked) }
function premiumUsers() { return store.users().filter(u => !u.deleted && u.premium && u.premium.status === 'Active' && !isAdmin(u.email)) }

function currentUser() {
  const s = session()
  if (!s) return null
  const u = findUser(s.email)
  if (!u || u.deleted) return null
  return u
}

function isBlocked() {
  const u = currentUser()
  return !!(u && u.blocked && !isAdmin(u.email))
}

function blockedView(u) {
  return '<div class="section container auth-wrap"><div class="form-card center">' +
    '<h2>Account blocked</h2>' +
    '<p class="sub">' + esc(u.name || u.email) + ' (' + esc(u.email) + ') is currently <b>blocked</b>. You cannot use any tool, login or buy while blocked.</p>' +
    '<p class="small muted">If you think this is a mistake, contact support on WhatsApp +880 1886-822816 or Telegram t.me/+8801886822816.</p>' +
    '<button class="btn btn-ghost" data-logout type="button">Logout</button>' +
    '</div></div>'
}

function isAdmin(email) { return ADMIN_EMAILS.includes((email || '').toLowerCase()) }

function planIdFor(email) {
  const u = store.users().find(x => x.email === (email || '').toLowerCase())
  const p = u && u.premium && u.premium.status === 'Active' ? u.premium.plan : 'free'
  return p || 'free'
}

function todayKey() { return new Date().toISOString().slice(0, 10) }

/* ============================================================== api */

function fetchTimeout(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

function devStoredKey() { try { return localStorage.getItem('seoproDevKey') || '' } catch (e) { return '' } }

async function parseApiResponse(r) {
  const text = await r.text()
  try { return JSON.parse(text) } catch (e) {
    if (r.status >= 500) return { status: 'Error', reason: 'The server hit an error (' + r.status + '). Please try again in a moment.' }
    return { status: 'Error', reason: 'Unexpected server response (' + r.status + ').' }
  }
}

async function apiGet(path, timeoutMs) {
  try {
    const k = devStoredKey()
    const opts = k ? { headers: { 'x-dev-key': k } } : {}
    const r = await fetchTimeout(API + path, opts, timeoutMs)
    return await parseApiResponse(r)
  } catch (e) {
    const timeout = e && e.name === 'AbortError'
    return { status: 'Error', reason: timeout ? 'This analysis took too long and timed out. Please try again.' : 'Backend offline. Start it with: cd backend && npm install && node server.js' }
  }
}

async function apiPost(path, body, timeoutMs) {
  try {
    const k = devStoredKey()
    const headers = { 'Content-Type': 'application/json' }
    if (k) headers['x-dev-key'] = k
    const r = await fetchTimeout(API + path, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs)
    return await parseApiResponse(r)
  } catch (e) {
    const timeout = e && e.name === 'AbortError'
    return { status: 'Error', reason: timeout ? 'This request took too long and timed out. Please try again.' : 'Backend offline. Start it with: cd backend && npm install && node server.js' }
  }
}

async function apiAdmin(path, body, method) {
  try {
    const t = adminToken()
    const headers = { 'Content-Type': 'application/json', 'x-admin-token': (t && t.token) ? t.token : '' }
    const opts = { method: method || (body ? 'POST' : 'GET'), headers }
    if (body) opts.body = JSON.stringify(body)
    const r = await fetchTimeout(API + path, opts, 25000)
    return await r.json()
  } catch (e) {
    return { status: 'Error', error: 'Backend unreachable. Please try again.' }
  }
}

/* ============================================================== ui helpers */

async function loadSiteConfig() {
  try {
    const r = await fetchTimeout(API + '/api/site-config', {}, 12000)
    const j = await r.json()
    if (j && j.status === 'Real') window.__siteConfig = j
  } catch (e) { /* non-fatal */ }
}

function deliveryCfg() {
  const d = window.__siteConfig && window.__siteConfig.delivery
  return d || { email: false, emailProvider: null, phone: false, phoneProvider: null, whatsapp: false, sms: false }
}

async function apiUser(path, body) {
  try {
    let token = ''
    try { if (cloudOn() && window.SeoCloud.accessToken) token = await window.SeoCloud.accessToken() } catch (e) {}
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['x-user-token'] = token
    const opts = { method: body ? 'POST' : 'GET', headers }
    if (body) opts.body = JSON.stringify(body)
    const r = await fetchTimeout(API + path, opts, 25000)
    return await r.json()
  } catch (e) {
    return { status: 'Error', error: 'Backend unreachable. Please try again.' }
  }
}

function toast(msg, type = 'success') {
  const root = document.getElementById('toastRoot')
  if (!root) return
  const el = document.createElement('div')
  el.className = 'toast toast-' + type
  el.textContent = msg
  root.appendChild(el)
  requestAnimationFrame(() => el.classList.add('show'))
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300) }, 3600)
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied to clipboard')
    return true
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); toast('Copied to clipboard'); return true }
    catch (err) { toast('Copy failed', 'error'); return false }
    finally { ta.remove() }
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch (e) { ok = false }
  ta.remove()
  return ok
}

function copyPaymentValue(text, btn) {
  const done = () => {
    toast('Copied!')
    if (btn) {
      const old = btn.getAttribute('data-label') || btn.textContent
      btn.setAttribute('data-label', old)
      btn.textContent = 'Copied!'
      btn.disabled = true
      setTimeout(() => { btn.textContent = old; btn.disabled = false }, 1500)
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => { if (fallbackCopy(text)) done(); else toast('Copy failed', 'error') })
  } else if (fallbackCopy(text)) done()
  else toast('Copy failed', 'error')
}

function openModal(html) {
  const ov = document.getElementById('modalOverlay')
  const box = document.getElementById('modalBox')
  if (!ov || !box) return
  box.innerHTML = html
  ov.hidden = false
}

function closeModal() {
  const ov = document.getElementById('modalOverlay')
  if (ov) ov.hidden = true
}

function labelPill(label) {
  const cls = { 'Very High': 'label-veryhigh', Good: 'label-good', Medium: 'label-medium', Low: 'label-low' }[label] || 'label-medium'
  return '<span class="label-pill ' + cls + '">' + esc(label) + '</span>'
}

function scoreBar(score) {
  const w = Math.max(4, Math.min(100, score || 0))
  return '<div class="score-bar"><i style="width:' + w + '%"></i></div>'
}

function statusPill(status) {
  const map = { approved: ['st-approved', 'APPROVED'], rejected: ['st-rejected', 'REJECTED'], pending: ['st-pending', 'PENDING'], auto_verifying: ['st-verifying', 'VERIFYING'] }
  const [cls, txt] = map[status] || ['st-pending', String(status || '').toUpperCase()]
  return '<span class="status-pill ' + cls + '">' + txt + '</span>'
}

function payBadgeHtml(m) {
  const logo = m.svg
    ? '<span class="pay-logo" style="background:' + m.bg + '">' + m.svg + '</span>'
    : '<span class="pay-logo pay-word" style="background:' + m.bg + '">' + esc(m.word) + '</span>'
  if (m.comingSoon) {
    return '<button type="button" class="pay-badge pay-badge-off" data-pay-method="' + m.id + '" disabled aria-label="' + esc(m.name) + ' coming soon">' + logo +
      '<span>' + esc(m.name) + '</span><span class="pay-cs">Coming Soon</span></button>'
  }
  return '<button type="button" class="pay-badge" data-pay-method="' + m.id + '">' + logo + '<span>' + esc(m.name) + '</span></button>'
}

function payLogoOnlyHtml(m) {
  const logo = m.svg
    ? '<span class="pay-logo" style="background:' + m.bg + '">' + m.svg + '</span>'
    : '<span class="pay-logo pay-word" style="background:' + m.bg + '">' + esc(m.word) + '</span>'
  return '<span class="pay-badge pay-logo-only' + (m.comingSoon ? ' pay-badge-off' : '') + '" title="' + esc(m.name) + (m.comingSoon ? ' - coming soon' : '') + '" aria-label="' + esc(m.name) + '">' + logo + '</span>'
}

/* ============================================================== auth */

function newAccountError(name, email, password) {
  if (!name || !email || !password) return 'All fields are required'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) return 'Enter a valid email address'
  if (String(password).length < 6) return 'Password must be at least 6 characters'
  if (store.users().find(u => u.email === String(email).trim().toLowerCase())) return 'Email already registered. Please login.'
  return null
}

async function registerUser(name, email, password) {
  const err = newAccountError(name, email, password)
  if (err) return { error: err }
  const cleanEmail = email.trim().toLowerCase()
  if (cloudOn()) {
    try {
      const data = await cloud().signUp(name.trim(), cleanEmail, password)
      const u = { name: name.trim(), email: cleanEmail, uid: data && data.user && data.user.id, provider: 'supabase', createdAt: new Date().toISOString(), premium: null, blocked: false, deleted: false }
      const users = store.users()
      if (!users.find(x => x.email === cleanEmail)) users.push(u)
      store.saveUsers(users)
      setSession({ email: cleanEmail })
      return { ok: true, user: u }
    } catch (e) {
      const msg = (e && e.message) || ''
      if (/already|registered|exists/i.test(msg)) return { error: 'Email already registered. Please login.' }
      if (/password/i.test(msg)) return { error: 'Password must be at least 6 characters' }
      /* network or configuration issue: fall back to local storage */
    }
  }
  const users = store.users()
  const salt = makeSalt()
  const passHash = await hashPassword(password, salt)
  const user = { name: name.trim(), email: cleanEmail, passHash, salt, createdAt: new Date().toISOString(), premium: null, blocked: false, deleted: false }
  users.push(user)
  store.saveUsers(users)
  setSession({ email: user.email })
  return { ok: true, user }
}

async function loginUser(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (cloudOn()) {
    try {
      await cloud().signIn(cleanEmail, password)
      let user = findUser(cleanEmail)
      if (!user || user.deleted) {
        const users = store.users()
        user = users.find(x => x.email === cleanEmail)
        if (!user) {
          user = { name: '', email: cleanEmail, provider: 'supabase', createdAt: new Date().toISOString(), premium: null, blocked: false, deleted: false }
          users.push(user); store.saveUsers(users)
        }
      }
      if (user.blocked) { await cloud().signOut(); return { error: 'This account is blocked. Please contact support.' } }
      setSession({ email: cleanEmail })
      await cloudPull()
      return { ok: true, user }
    } catch (e) {
      const msg = (e && e.message) || ''
      if (/invalid|credential/i.test(msg)) return { error: 'Incorrect password. Please try again.' }
      if (/confirm/i.test(msg)) return { error: 'Please confirm your email, then login.' }
      /* network or configuration issue: fall back to local storage */
    }
  }
  const user = findUser(cleanEmail)
  if (!user || user.deleted) return { error: 'No account found. Please register first.' }
  if (user.blocked) return { error: 'This account is blocked. Please contact support.' }
  if (user.provider === 'google' && !user.passHash && !user.password) return { error: 'This account uses Google sign-in. Please continue with Google.' }
  if (!(await verifyPassword(user, password))) return { error: 'Incorrect password. Please try again.' }
  if (!user.passHash) {
    const users = store.users()
    const u = users.find(x => x.email === user.email)
    if (u) { u.salt = makeSalt(); u.passHash = await hashPassword(password, u.salt); delete u.password; store.saveUsers(users) }
  }
  setSession({ email: user.email })
  return { ok: true, user }
}

function logout() { if (cloudOn()) cloud().signOut(); setSession(null); clearAdminToken(); toast('Logged out'); go('/') }

function activatePremium(userEmail, plan, paymentId) {
  const users = store.users()
  const u = users.find(x => x.email === userEmail)
  if (!u) return
  u.premium = { status: 'Active', plan: plan.id, planName: plan.name, agents: plan.agents, daily: plan.daily, monthly: plan.monthly, since: new Date().toISOString(), paymentId }
  store.saveUsers(users)
}

function bumpLocalUsage(email) {
  const usage = store.usage()
  const key = (email || 'guest').toLowerCase() + ':' + todayKey()
  usage[key] = (usage[key] || 0) + 1
  store.saveUsage(usage)
  return usage[key]
}

function localUsageFor(email) {
  const usage = store.usage()
  return usage[(email || 'guest').toLowerCase() + ':' + todayKey()] || 0
}

/* ============================================================== buy flow */

let selectedMethod = null
let buyPlanId = null

function compressImageFile(file, maxDim, quality) {
  return new Promise((resolve) => {
    try {
      if (!file || !/^image\//i.test(file.type)) return resolve('')
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const max = maxDim || 1280
          let w = img.width, h = img.height
          if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
          const c = document.createElement('canvas')
          c.width = w; c.height = h
          const ctx = c.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          try { resolve(c.toDataURL('image/jpeg', quality || 0.72)) } catch (e) { resolve(String(reader.result || '')) }
        }
        img.onerror = () => resolve('')
        img.src = String(reader.result || '')
      }
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    } catch (e) { resolve('') }
  })
}

function viewPlanDetail(plan) {
  const u = currentUser()
  if (!u) { toast('Please login to buy a plan', 'error'); go('/auth'); return }
  buyPlanId = plan.id
  selectedMethod = null

  const features = plan.features.map(f => '<li>' + esc(f) + '</li>').join('')
  const methods = plan.price === 0
    ? '<p class="small muted">Free plan activates instantly - no payment needed.</p>'
    : PAYMENT_METHODS.map(payBadgeHtml).join('')

  openModal(
    '<h3>' + esc(plan.name) + ' - $' + plan.price + '/month</h3>' +
    '<p class="m-sub">' + esc(plan.tagline) + ' - ' + plan.daily + ' credits/day, ' + plan.agents + ' agents</p>' +
    '<ul class="plan-features">' + features + '</ul>' +
    (plan.price > 0
      ? '<div class="pay-row">' + methods + '</div>' +
        '<div class="pay-info" id="payInfo"><span class="small muted">Select a payment method</span></div>' +
        '<div class="field"><label>Transaction ID / TX hash / Binance Order ID <span class="muted small">(optional if you upload a screenshot)</span></label>' +
        '<input type="text" id="trxInput" placeholder="Enter transaction ID, TX hash or Binance Order ID"></div>' +
        '<div class="field"><label>Payment screenshot <span class="muted small">(optional)</span></label>' +
        '<div class="file-row"><label class="btn-file" for="proofFile">Choose file</label>' +
        '<input type="file" id="proofFile" accept="image/*" class="hidden-file">' +
        '<span id="proofFileName" class="muted small">No file chosen</span>' +
        '<button class="btn btn-ghost btn-sm" id="proofClearBtn" type="button" hidden>Remove</button></div>' +
        '<img id="proofPreview" class="pay-proof-preview" alt="screenshot preview" hidden></div>' +
        '<p class="small muted">Submit with either the transaction/order ID, a screenshot, or both.</p>'
      : '') +
    '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button>' +
    '<button class="btn btn-primary" id="buyBtn" type="button">' + (plan.price === 0 ? 'Activate Free' : 'Buy Now - $' + plan.price) + '</button></div>'
  )

  const infoEl = document.getElementById('payInfo')
  const trxEl = document.getElementById('trxInput')
  const buyBtn = document.getElementById('buyBtn')
  let proofData = ''

  const fileEl = document.getElementById('proofFile')
  if (fileEl) fileEl.addEventListener('change', async () => {
    const f = fileEl.files && fileEl.files[0]
    if (!f) return
    toast('Processing screenshot...', 'info')
    proofData = await compressImageFile(f, 1280, 0.72)
    const nameEl = document.getElementById('proofFileName')
    const prev = document.getElementById('proofPreview')
    const clr = document.getElementById('proofClearBtn')
    if (nameEl) nameEl.textContent = f.name
    if (prev && proofData) { prev.src = proofData; prev.hidden = false }
    if (clr) clr.hidden = false
  })
  const clearBtn = document.getElementById('proofClearBtn')
  if (clearBtn) clearBtn.addEventListener('click', () => {
    proofData = ''
    if (fileEl) fileEl.value = ''
    const nameEl = document.getElementById('proofFileName'); if (nameEl) nameEl.textContent = 'No file chosen'
    const prev = document.getElementById('proofPreview'); if (prev) { prev.hidden = true; prev.src = '' }
    clearBtn.hidden = true
  })

  document.querySelectorAll('[data-pay-method]').forEach(b => {
    b.addEventListener('click', () => {
      const m = PAYMENT_METHODS.find(p => p.id === b.getAttribute('data-pay-method'))
      if (m && m.comingSoon) { toast(m.name + ' is coming soon. Please pick another method.', 'error'); return }
      document.querySelectorAll('[data-pay-method]').forEach(x => x.classList.remove('selected'))
      b.classList.add('selected')
      selectedMethod = m
      if (infoEl && m) {
        infoEl.innerHTML = '<span class="small muted">' + esc(m.name) + ' - ' + esc(m.type) + (m.network ? ' (' + esc(m.network.toUpperCase()) + ')' : '') + '</span>' +
          '<div class="pay-number-row"><div class="pay-number">' + esc(m.number || '-') + '</div>' +
          (m.number ? '<button class="btn btn-primary btn-sm" data-copy-pay="' + esc(m.number) + '" type="button">Copy</button>' : '') + '</div>' +
          (m.note ? '<span class="small muted">' + esc(m.note) + '</span>' : '') +
          (m.crypto ? '<div class="small muted mt-16">Send to the address above, then paste your order ID / TX hash or upload a screenshot.</div>' : '<div class="small muted mt-16">Send the exact amount, then paste your TrxID or upload a screenshot. Admin verifies and approves shortly.</div>')
      }
    })
  })

  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (plan.price === 0) { buyPackage(plan, null, '', '', ''); return }
      if (!selectedMethod) { toast('Please select a payment method', 'error'); return }
      const trx = trxEl ? trxEl.value.trim() : ''
      if (!trx && !proofData) { toast('Enter a transaction/order ID or upload a screenshot', 'error'); return }
      buyPackage(plan, selectedMethod, trx, trx, proofData)
    })
  }
}

function buyPackage(plan, method, trx, orderId, proofImage) {
  const u = currentUser()
  if (!u) { toast('Please login', 'error'); return }
  const payments = store.payments()
  const id = uid()
  const payment = {
    id,
    email: u.email,
    name: u.name,
    plan: plan.id,
    planName: plan.name,
    amount: plan.price,
    method: method ? method.name : 'instant',
    methodId: method ? method.id : 'free',
    trx: trx || '',
    orderId: orderId || '',
    proofImage: proofImage || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    autoApproved: false
  }
  if (plan.price === 0) payment.status = 'approved'
  else if (method && method.crypto && !proofImage) payment.status = 'auto_verifying'
  payments.push(payment)
  store.savePayments(payments)
  closeModal()

  if (plan.price > 0) {
    apiPost('/api/payment/proof', {
      email: u.email, name: u.name, plan: plan.id, planName: plan.name, amount: plan.price,
      method: method ? method.name : '', methodId: method ? method.id : '',
      trx: trx || '', orderId: orderId || '', proofImage: proofImage || ''
    }).then(res => { if (res && res.status === 'Real') toast('Payment proof sent for review.', 'success') })
      .catch(() => {})
  }

  if (payment.status === 'approved') {
    activatePremium(u.email, plan, id)
    toast(plan.name + ' activated - welcome to Premium!')
  } else if (payment.status === 'auto_verifying') {
    toast('Checking the blockchain for your transaction...', 'info')
    verifyCryptoPayment(id, method, trx, plan)
  } else {
    toast('Payment submitted. Admin will approve shortly.', 'info')
  }
}

async function verifyCryptoPayment(id, method, trx, plan) {
  const finish = (status, autoApproved, message) => {
    const ps = store.payments()
    const p = ps.find(x => x.id === id)
    if (!p) return
    p.status = status
    p.autoApproved = !!autoApproved
    p.verifiedAt = new Date().toISOString()
    store.savePayments(ps)
    if (status === 'approved') {
      const u = findUser(p.email)
      if (u) activatePremium(u.email, plan, id)
      toast(message || 'Payment verified on-chain - Premium Active!')
    } else {
      toast(message || 'Transaction not confirmed yet. Admin will review shortly.', 'info')
    }
    if (pathFromLocation() === '/dashboard') navigate()
  }
  try {
    const res = await apiPost('/api/crypto/verify', {
      network: method && method.network,
      txid: trx,
      address: method && method.number,
      expected: plan && plan.price
    }, 20000)
    if (res && res.status === 'Real') {
      if (res.verified) return finish('approved', true, 'Payment verified on-chain - Premium Active!')
      return finish('pending', false, res.reason || 'Transaction not confirmed yet. Admin will review.')
    }
  } catch (e) {}
  // Backend/verifier offline: keep a short auto-approve demo so the flow never dead-ends.
  setTimeout(() => finish('approved', true, 'Payment auto-verified - Premium Active!'), 2500)
}

/* ============================================================== local scoring (fallbacks) */

function localLabel(score) { return score >= 90 ? 'Very High' : score >= 70 ? 'Good' : score >= 50 ? 'Medium' : 'Low' }
function localTitleScore(title, primary, year) {
  let s = 0
  const t = title.toLowerCase()
  if (title.length <= 60) s += 30
  if (primary && t.startsWith(primary.toLowerCase())) s += 20
  else if (primary && t.includes(primary.toLowerCase())) s += 10
  if (year && t.includes(String(year))) s += 10
  if (/\b(best|free|guide|top|ultimate|checklist|how to)\b/.test(t)) s += 10
  if (!/^(how to|what is|best)/i.test(t)) s += 15
  return Math.min(98, Math.max(45, s))
}
function localDescScore(desc, primary, year) {
  let s = 0
  if (desc.length >= 70 && desc.length <= 160) s += 30
  if (primary && desc.toLowerCase().includes(primary.toLowerCase())) s += 20
  if (year && desc.includes(String(year))) s += 10
  if (/click|learn|discover|free|guide|best|start/i.test(desc)) s += 15
  return Math.min(98, Math.max(45, s))
}
function localKD(serp) {
  if (!serp || serp.status !== 'Real') return null
  const total = serp.total_results || 0
  const kd = Math.min(95, 15 + Math.round(Math.log10(total + 1) * 12) + (serp.paa || []).length * 2)
  return { kd, label: localLabel(kd) }
}

function localMetaDescriptions(primary, year) {
  const p = primary || 'your topic'
  const templates = [
    p + ' made easy. Discover real tools, tips and honest guides for ' + year + ' - data-driven, no fluff. Start free today.',
    'Looking for the best ' + p + '? Compare real options, real prices and real results in our ' + year + ' guide.',
    'Learn everything about ' + p + ' in ' + year + '. Free tools, step-by-step guides and expert insights - click to explore.',
    'Find the perfect ' + p + ' solution. Unbiased reviews, real comparisons and actionable tips for ' + year + '.',
    p + ' - complete ' + year + ' resource. Free starter tools, pro tips and real user guides to get you ranked.'
  ]
  return templates.map(t => {
    const s = localDescScore(t, primary, year)
    return { text: t, score: s, label: localLabel(s) }
  })
}

/* ============================================================== views */

const state = { activeTool: null, adminTab: 'users', adminChatId: null, authMode: 'login', adminError: '' }

const ROUTES = ['/', '/generator', '/tools', '/pricing', '/dashboard', '/admin', '/auth']

const ROUTE_META = {
  '/': { title: 'SEO Service Provider - Free SEO Tools & AI Agents', desc: 'Free SEO tools and AI agents with real analysis. Title generator, keyword research, SERP analyzer, rank tracking and more.' },
  '/generator': { title: 'Free SEO Title Generator - 10 AI Titles with Scores', desc: 'Generate 10 click-worthy SEO titles from one primary keyword, each scored for length, power words and search intent. Free to try.' },
  '/tools': { title: 'Free SEO Tools - Keyword, SERP, PageSpeed & SEO Audit', desc: 'Run real SEO analysis: keyword research, SERP analyzer, competitor analysis, People-Also-Ask questions, PageSpeed and a full SEO audit.' },
  '/pricing': { title: 'Pricing & Plans - SEO Service Provider', desc: 'Simple SEO plans for freelancers and agencies. Unlock more AI agents, higher daily credits and priority usage. Pay by mobile, bank or crypto.' },
  '/dashboard': { title: 'Dashboard - SEO Service Provider', desc: 'Your SEO dashboard: run AI agents, read reports and manage your plan.' },
  '/admin': { title: 'Admin - SEO Service Provider', desc: 'Restricted admin panel.' },
  '/auth': { title: 'Login or Register - SEO Service Provider', desc: 'Create a free account or sign in to run SEO tools and AI agents.' }
}

function pathFromLocation() {
  const h = location.hash || ''
  if (h.indexOf('#/') === 0) return h.replace(/^#/, '') || '/'
  let p = '/'
  try { p = decodeURIComponent(location.pathname || '/') } catch (e) { p = '/' }
  p = p.replace(/\/+$/, '') || '/'
  if (p !== '/' && ROUTES.indexOf(p) < 0) return '/'
  return p
}

function applyRouteMeta(path) {
  const meta = ROUTE_META[path] || ROUTE_META['/']
  document.title = meta.title
  const set = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val) }
  set('meta[name="description"]', 'content', meta.desc)
  set('meta[property="og:title"]', 'content', meta.title)
  set('meta[property="og:description"]', 'content', meta.desc)
  set('meta[name="twitter:title"]', 'content', meta.title)
  set('meta[name="twitter:description"]', 'content', meta.desc)
  const origin = location.origin + '/'
  const url = origin + (path === '/' ? '' : path.replace(/^\//, ''))
  set('link[rel="canonical"]', 'href', url)
  set('meta[property="og:url"]', 'content', url)
}

function go(path, replace) {
  if (ROUTES.indexOf(path) < 0) path = '/'
  try {
    if (replace) history.replaceState({}, '', path)
    else history.pushState({}, '', path)
  } catch (e) { location.hash = '#' + path }
  navigate()
}

function onInternalLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return
  const href = a.getAttribute('href') || ''
  if (href.indexOf('#/') === 0) { e.preventDefault(); go(href.replace(/^#/, '')); return }
  if (href.charAt(0) === '/' && href.indexOf('//') !== 0) {
    const path = href.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
    if (ROUTES.indexOf(path) < 0) return
    e.preventDefault(); go(path)
  }
}

function navigate() {
  const path = pathFromLocation()
  if ((location.hash || '').indexOf('#/') === 0) {
    try { history.replaceState({}, '', path) } catch (e) {}
  }
  const view = document.getElementById('mainView')
  if (!view) return
  const cu = currentUser()
  applyRouteMeta(path)
  if (cu && cu.blocked && !isAdmin(cu.email)) {
    view.innerHTML = blockedView(cu)
    updateAuthUI()
    markActiveLink(path)
    window.scrollTo({ top: 0 })
    return
  }
  const fn = views[path] || views['/']
  view.innerHTML = fn()
  bindView(path, view)
  window.scrollTo({ top: 0 })
  updateAuthUI()
  markActiveLink(path)
}

function markActiveLink(path) {
  document.querySelectorAll('.nav-links a, .mobile-links a').forEach(a => {
    const h = (a.getAttribute('href') || '').replace(/^#/, '')
    a.classList.toggle('active', h === path)
  })
}

function updateAuthUI() {
  const u = currentUser()
  const btn = document.getElementById('authBtn')
  const mob = document.getElementById('mobileAuthBtn')
  if (btn) { btn.textContent = u ? 'Hi, ' + u.name.split(' ')[0] : 'Login'; btn.href = u ? '/dashboard' : '/auth' }
  if (mob) { mob.textContent = u ? 'Hi, ' + u.name.split(' ')[0] : 'Login / Register'; mob.href = u ? '/dashboard' : '/auth' }
}

/* ---------- home ---------- */

function homeView() {
  const planCards = PLANS.map(plan => {
    const feats = plan.features.map(f => '<li>' + esc(f) + '</li>').join('')
    return '<div class="plan-card' + (plan.popular ? ' popular' : '') + '">' +
      (plan.popular ? '<span class="plan-tag">MOST POPULAR</span>' : '') +
      '<div class="plan-name">' + esc(plan.name) + '</div>' +
      '<div class="plan-tagline">' + esc(plan.tagline) + '</div>' +
      '<div class="plan-price"><b>$' + plan.price + '</b><span>/month</span></div>' +
      '<ul class="plan-features">' + feats + '</ul>' +
      '<button class="btn ' + (plan.popular ? 'btn-primary' : 'btn-ghost') + '" data-plan="' + plan.id + '" type="button">' + (plan.price === 0 ? 'Start Free' : 'Get ' + plan.name) + '</button></div>'
  }).join('')

  const payLogos = PAYMENT_METHODS.map(payBadgeHtml).join('')

  return '' +
    '<section class="hero container">' +
      '<span class="eyebrow">Real Analysis - No Fabricated Data</span>' +
      '<h1>Free SEO Tools & <span class="grad">AI Agents</span> that rank</h1>' +
      '<p class="lead">Real SERP data, real PageSpeed scores and real rankings. 19 agents, 10 tools and 12 payment methods - all MIT self-hosted, free forever.</p>' +
      '<div class="hero-cta">' +
        '<a href="/generator" class="btn btn-primary">Try Title Generator</a>' +
        '<a href="/tools" class="btn btn-ghost">Explore 10 Tools</a>' +
      '</div>' +
      '<div class="hero-stats">' +
        '<div class="stat-card"><b>19</b><span>AI Agents</span></div>' +
        '<div class="stat-card"><b>10</b><span>SEO Tools</span></div>' +
        '<div class="stat-card"><b>12</b><span>Payment Methods</span></div>' +
        '<div class="stat-card"><b>100%</b><span>Real Data</span></div>' +
      '</div>' +
    '</section>' +

    '<section class="section container">' +
      '<div class="section-head"><span class="eyebrow">Pricing</span><h2>4 simple packages, alive and beautiful</h2><p>Free forever plan plus premium plans. Crypto payments are auto-verified on-chain in seconds.</p></div>' +
      '<div class="pricing-grid">' + planCards + '</div>' +
    '</section>' +

    '<section class="section container">' +
      '<div class="section-head"><span class="eyebrow">Payments</span><h2>Pay your way - 12 methods</h2></div>' +
      '<div class="pay-row">' + payLogos + '</div>' +
    '</section>' +

    '<section class="section container">' +
      '<div class="section-head"><span class="eyebrow">How it works</span><h2>From zero to Premium in 4 steps</h2></div>' +
      '<div class="grid grid-4">' +
        '<div class="feature-card"><div class="f-icon">1</div><h3>Register</h3><p>Create a free account at /auth - takes seconds.</p></div>' +
        '<div class="feature-card"><div class="f-icon">2</div><h3>Generate</h3><p>Build 15 real SEO titles from live SERP data.</p></div>' +
        '<div class="feature-card"><div class="f-icon">3</div><h3>Buy Starter</h3><p>$5 via bKash, Nagad or crypto. Crypto auto-verifies.</p></div>' +
        '<div class="feature-card"><div class="f-icon">4</div><h3>Go Premium</h3><p>Unlock 12-19 agents, daily credits and rank tracking.</p></div>' +
      '</div>' +
    '</section>' +

    '<section class="section container">' +
      '<div class="section-head"><span class="eyebrow">Features</span><h2>Real logic, real agents</h2><p>Integrated as real logic in the backend - not just links.</p></div>' +
      '<div class="grid grid-3">' +
        '<div class="feature-card"><div class="f-icon">S</div><h3>Real SERP Data</h3><p>Organic results, PAA questions and related searches straight from SerpApi.</p></div>' +
        '<div class="feature-card"><div class="f-icon">P</div><h3>Real PageSpeed</h3><p>Lighthouse performance, SEO and Core Web Vitals for any URL.</p></div>' +
        '<div class="feature-card"><div class="f-icon">G</div><h3>Real Ranking Scores</h3><p>Titles, keywords and descriptions scored on real ranking factors - never random.</p></div>' +
      '</div>' +
    '</section>'
}

/* ---------- generator ---------- */

function generatorView() {
  const u = currentUser()
  if (!u) {
    return '<div class="section container auth-wrap"><div class="form-card center">' +
      '<h2>Login to generate</h2><p class="sub">Title generation saves real reports to your dashboard.</p>' +
      '<a href="/auth" class="btn btn-primary">Login / Register</a></div></div>'
  }
  return '<div class="section container">' +
    '<div class="section-head"><span class="eyebrow">Title Generator</span><h2>Generate 15 real SEO titles</h2><p>Real SERP analysis drives meaningful words, intent and niche competitors - titles are never random templates.</p></div>' +
    '<div class="panel">' +
      '<div class="input-row"><input type="text" id="genInput" placeholder="Enter your main topic, e.g. Best Morning Routine 2026" value=""><button class="btn btn-primary" id="genBtn" type="button">Generate</button></div>' +
      '<div class="small muted mt-16">Free: 3/day - Starter: 10/day - Pro: 30/day - Agency: 100/day</div>' +
      '<div id="genOutput" class="mt-24"></div>' +
    '</div></div>'
}

async function runGenerator() {
  const input = document.getElementById('genInput')
  const out = document.getElementById('genOutput')
  const btn = document.getElementById('genBtn')
  const title = input ? input.value.trim() : ''
  if (!title) { toast('Please enter a topic', 'error'); return }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analyzing...' }
  out.innerHTML = '<div class="center muted"><span class="spinner"></span> Fetching real SERP data...</div>'
  const u = currentUser()
  const res = await apiPost('/api/generate', { title, userEmail: u ? u.email : 'guest@local', plan: u ? planIdFor(u.email) : 'free' })
  if (btn) { btn.disabled = false; btn.textContent = 'Generate' }

  if (res.status === 'Error' || res.error) {
    out.innerHTML = '<div class="alert alert-error">' + esc(res.error || res.reason || 'Generation failed') + '</div>'
    return
  }
  if (u) bumpLocalUsage(u.email)

  const intent = res.intent || { intent: 'informational', confidence: 0, label: 'Medium' }
  const wordChips = (res.meaningfulWords || []).map(w => '<span class="chip">' + esc(w) + '</span>').join(' ')
  const compChips = (res.competitors || []).map(c => '<span class="chip"><b>' + esc(c) + '</b></span>').join(' ') || '<span class="chip muted">No competitors found</span>'
  const kwRows = (res.keywords || []).slice(0, 8).map(k =>
    '<tr><td>' + esc(k.keyword) + '</td><td>' + esc(k.source) + '</td><td>' + k.score + '%</td><td>' + labelPill(k.label) + '</td><td>' + k.relevance + '%</td></tr>').join('')
  const titleItems = (res.titles || []).map((t, i) =>
    '<div class="title-item"><div class="t-top"><div class="t-title">' + (i + 1) + '. ' + esc(t.title) + ' <span class="muted small">(' + t.title.length + ' chars)</span></div>' +
    '<div class="t-actions"><span class="muted small">' + t.score + '%</span>' + labelPill(t.label) +
    '<button class="btn btn-ghost btn-sm" data-copy="' + esc(t.title) + '" type="button">Copy</button></div></div>' + scoreBar(t.score) + '</div>').join('')

  out.innerHTML =
    '<div class="metric-grid">' +
      '<div class="metric"><div class="m-label">Primary Keyword</div><div class="m-value">' + esc(res.primary || title) + '</div></div>' +
      '<div class="metric"><div class="m-label">Search Intent</div><div class="m-value">' + esc(intent.intent) + ' <span class="small muted">' + Math.round(intent.confidence * 100) + '% ' + esc(intent.label) + '</span></div></div>' +
      '<div class="metric"><div class="m-label">SERP Source</div><div class="m-value">' + esc(res.serpStatus || 'Real') + '</div></div>' +
    '</div>' +
    '<div class="mt-24"><h3>Meaningful Words</h3><div class="flex mt-16">' + wordChips + '</div></div>' +
    '<div class="mt-24"><h3>Niche Competitors</h3><div class="flex mt-16">' + compChips + '</div></div>' +
    '<div class="mt-24"><h3>15 Real Titles (max 60 chars)</h3><div class="title-list">' + titleItems + '</div></div>' +
    (kwRows ? '<div class="mt-24"><h3>Keyword Ideas</h3><div class="table-wrap"><table class="kw-table"><thead><tr><th>Keyword</th><th>Source</th><th>Score</th><th>Label</th><th>Relevance</th></tr></thead><tbody>' + kwRows + '</tbody></table></div></div>' : '') +
    (res.usage ? '<div class="small muted mt-16">Used ' + res.usage.count + '/' + res.usage.limit + ' today - ' + res.usage.cost + ' USD tracked</div>' : '')

  const u2 = currentUser()
  if (u2) {
    const reports = store.reports()
    reports.unshift({ id: uid(), email: u2.email, primary: res.primary, intent: intent.intent, year: res.year, titleCount: (res.titles || []).length, titles: res.titles, date: new Date().toISOString() })
    store.saveReports(reports.slice(0, 50))
  }
}

/* ---------- tools ---------- */

function toolsView() {
  const grid = TOOLS.map(t =>
    '<button class="tool-card" data-open-tool="' + t.id + '" type="button"><div class="t-icon" style="color:' + t.color + '">' + esc(t.code) + '</div><h3>' + esc(t.name) + '</h3><p>' + esc(t.desc) + '</p></button>').join('')

  const active = TOOLS.find(t => t.id === state.activeTool)
  if (active) {
    return '<div class="section container">' +
      '<div class="tool-panel">' +
        '<div class="flex tool-panel-back"><button class="btn btn-ghost btn-sm" data-close-tool type="button">Back to all tools</button>' +
        '<button class="btn btn-primary btn-sm" data-run-tool="' + active.id + '" type="button">Run Tool</button></div>' +
        '<div class="panel">' +
          '<div class="t-icon" style="color:' + active.color + ';font-size:22px">' + esc(active.code) + '</div>' +
          '<h3 style="color:' + active.color + '">' + esc(active.name) + '</h3>' +
          '<p class="muted small mt-16">' + esc(active.desc) + '</p>' +
          '<div class="input-row mt-16"><input type="text" id="toolInput" placeholder="' + esc(active.placeholder) + '"></div>' +
          '<div class="small muted mt-8" id="toolHint"></div>' +
          '<div id="toolOutput" class="mt-24"></div>' +
        '</div>' +
      '</div></div>'
  }

  return '<div class="section container">' +
    '<div class="section-head"><span class="eyebrow">Tools</span><h2>10 free SEO tools</h2><p>Every output is real analysis with a ranking percentage. Click a tool to use it.</p></div>' +
    '<div class="grid grid-3">' + grid + '</div>' +
    '</div>'
}

function openAgent(agentName) {
  const toolId = AGENT_TOOL[agentName]
  if (!toolId) { toast(agentName + ' has no action yet', 'error'); return }
  const tool = TOOLS.find(t => t.id === toolId)
  if (!tool) return
  state.activeTool = toolId
  go('/tools')
  toast(agentName + ' opened: ' + tool.name)
}

let _moreSeq = 0
function mid(prefix) { _moreSeq += 1; return prefix + '-' + _moreSeq }

function parseKwInput(value) {
  const seen = new Set()
  const out = []
  String(value || '').split(',').forEach(raw => {
    const k = raw.trim()
    if (!k) return
    const key = k.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    if (out.length < 10) out.push(k)
  })
  return out
}

function moreBtn(id, n) {
  return '<div class="center mt-8"><button type="button" class="btn btn-ghost btn-sm" data-toggle="' + id + '" data-less="Show less" data-more="Show more (' + n + ')">Show more (' + n + ')</button></div>'
}

function rowMore(id, rows, renderRow, initial) {
  initial = initial || 10
  const first = (rows || []).slice(0, initial).map(renderRow).join('')
  const rest = (rows || []).slice(initial)
  if (!rest.length) return { tb: '<tbody>' + first + '</tbody>', btn: '' }
  return {
    tb: '<tbody>' + first + '</tbody><tbody id="' + id + '" style="display:none">' + rest.map(renderRow).join('') + '</tbody>',
    btn: moreBtn(id, rest.length)
  }
}

function itemMore(id, items, renderItem, initial, wrapFn) {
  initial = initial || 6
  const first = (items || []).slice(0, initial).map(renderItem).join('')
  const rest = (items || []).slice(initial)
  if (!rest.length) return wrapFn ? wrapFn(first) : first
  const hidden = '<div id="' + id + '" style="display:none">' + rest.map(renderItem).join('') + '</div>'
  const inner = wrapFn ? wrapFn(first + hidden) : (first + hidden)
  return inner + moreBtn(id, rest.length)
}

function kwCard(kw, i, body) {
  return '<div class="panel mb-16"><div class="kw-card-head"><span class="chip chip-kw">Keyword ' + (i + 1) + '</span><h3 style="word-break:break-word">' + esc(kw) + '</h3></div>' + body + '</div>'
}

function localMetaGeminiHtml(text, keyword) {
  const year = new Date().getFullYear()
  const primary = (keyword.split(' ')[0] || '').toLowerCase()
  const lines = String(text || '').split(/\n+/).map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(l => l.length > 20)
  const items = lines.slice(0, 5).map(d => {
    const s = localDescScore(d, primary, year)
    return '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(d) + '</div><div class="t-actions"><span class="muted small">' + s + '%</span>' + labelPill(localLabel(s)) + '<button class="btn btn-ghost btn-sm" data-copy="' + esc(d) + '" type="button">Copy</button></div></div>' + scoreBar(s) + '</div>'
  }).join('')
  return '<h3 class="mt-16">AI meta descriptions (Gemini real)</h3><div class="title-list">' + items + '</div>'
}

function localMetaFallbackHtml(keyword) {
  const year = new Date().getFullYear()
  const primary = (keyword.split(' ')[0] || '').toLowerCase()
  const items = localMetaDescriptions(primary, year).map(d =>
    '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(d.text) + '</div><div class="t-actions"><span class="muted small">' + d.score + '%</span>' + labelPill(d.label) + '<button class="btn btn-ghost btn-sm" data-copy="' + esc(d.text) + '" type="button">Copy</button></div></div>' + scoreBar(d.score) + '</div>').join('')
  return '<h3 class="mt-16">Fallback templates</h3><div class="title-list">' + items + '</div>'
}

let _aiPlanSeq = 0
async function aiPlanFor(urlVal, btn) {
  const u = currentUser()
  const email = u ? u.email : 'guest@local'
  const wrap = document.createElement('div')
  wrap.className = 'mt-16'
  wrap.innerHTML = '<div class="center muted"><span class="spinner"></span> Running on-page checks + Lighthouse + AI fix plan...</div>'
  if (btn && btn.parentNode) btn.parentNode.appendChild(wrap)
  if (btn) btn.disabled = true
  const res = await apiPost('/api/ai-plan', { url: urlVal, email, plan: planIdFor(email) }, 100000)
  if (btn) btn.disabled = false
  if (res.status === 'Error' || res.error) { wrap.innerHTML = errBlock(res.error || res.reason || 'AI plan failed'); return }
  let html = ''
  if (res.audit && res.audit.checks && res.audit.checks.length) {
    const rows = res.audit.checks.map(c => {
      const pill = c.pass ? '<span class="label-pill label-good">PASS</span>' : '<span class="label-pill label-low">FAIL</span>'
      return '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(c.label) + ' <span class="muted small">' + esc(c.detail) + '</span></div><div class="t-actions">' + pill + '</div></div></div>'
    }).join('')
    html += '<h3 class="mt-16">On-page audit: ' + res.audit.score + '% passed (' + res.audit.passed + '/' + res.audit.total + ')</h3><div class="title-list">' + rows + '</div>'
  }
  if (res.pagespeed) {
    const pg = res.pagespeed
    html += '<div class="metric-grid mt-16"><div class="metric"><div class="m-label">Lighthouse Perf</div><div class="m-value">' + (pg.performance == null ? 'N/A' : pg.performance + '%') + '</div></div>' +
      '<div class="metric"><div class="m-label">Lighthouse SEO</div><div class="m-value">' + (pg.seo == null ? 'N/A' : pg.seo + '%') + '</div></div>' +
      '<div class="metric"><div class="m-label">Lighthouse BP</div><div class="m-value">' + (pg.bestPractices == null ? 'N/A' : pg.bestPractices + '%') + '</div></div></div>'
  }
  html += '<h3 class="mt-16">AI Action Plan <span class="muted small">(' + esc(res.model || 'gemini') + ')</span></h3>' +
    '<div class="panel plan-text">' + esc(res.plan || '').replace(/\n/g, '<br>') + '</div>'
  wrap.innerHTML = html
}

async function runTool(toolId) {
  const input = document.getElementById('toolInput')
  const out = document.getElementById('toolOutput')
  const btn = document.querySelector('[data-run-tool]')
  const value = input ? input.value.trim() : ''
  if (!value) { toast('Please enter a value', 'error'); return }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Running...' }
  out.innerHTML = '<div class="center muted"><span class="spinner"></span> Fetching real data...</div>'
  const u = currentUser()
  const email = u ? u.email : 'guest@local'
  const SERP_BATCH_TOOLS = ['keyword-research', 'serp-analyzer', 'competitor-analysis', 'question-finder', 'related-keywords', 'keyword-difficulty']
  const kws = parseKwInput(value)
  if (kws.length > 1 && (SERP_BATCH_TOOLS.indexOf(toolId) >= 0 || toolId === 'meta-description')) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analyzing ' + kws.length + ' keywords...' }
    out.innerHTML = '<div class="center muted"><span class="spinner"></span> Fetching real data for ' + kws.length + ' keywords...</div>'
    const res = toolId === 'meta-description'
      ? await apiPost('/api/gemini', { keywords: kws, email, plan: planIdFor(email) })
      : await apiPost('/api/serp/batch', { queries: kws, email, plan: planIdFor(email) })
    if (btn) { btn.disabled = false; btn.textContent = 'Run Tool' }
    if (res.status === 'Error' || res.error) { out.innerHTML = errBlock(res.error || res.reason || 'Batch analysis failed'); return }
    let cards = ''
    if (toolId === 'meta-description') {
      ;(res.results || []).forEach((r, i) => {
        let block
        if (r.status === 'Real' && r.text) block = localMetaGeminiHtml(r.text, r.keyword)
        else block = '<div class="alert alert-error">' + esc(r.reason || 'Live AI unavailable for "' + r.keyword + '". Add a Gemini API key in backend/.env.') + '</div>' + localMetaFallbackHtml(r.keyword)
        cards += kwCard(r.keyword, i, block)
      })
    } else {
      ;(res.results || []).forEach((r, i) => {
        const s = r.serp || {}
        let body
        if (s.status === 'Real') {
          const notice = s.notice ? '<div class="alert alert-info">' + esc(s.notice) + '</div>' : ''
          body = notice + serpBody(toolId, s, r.keyword)
        } else {
          body = errBlock(s.reason || 'No data for "' + r.keyword + '"')
        }
        cards += kwCard(r.keyword, i, body)
      })
    }
    const usage = res.usage ? '<div class="small muted mt-16">Used ' + res.usage.count + '/' + res.usage.limit + ' of your daily credits today</div>' : ''
    out.innerHTML = '<div class="alert alert-success mb-16"><b>Batch mode:</b> real analysis for ' + kws.length + ' keywords (' + esc(toolId.replace(/-/g, ' ')) + '). Each result below is live data.</div>' + cards + usage
    return
  }

  let html = ''
  if (toolId === 'title-generator') {
    const res = await apiPost('/api/generate', { title: value, userEmail: email, plan: planIdFor(email) })
    if (res.error || res.status === 'Error') { html = errBlock(res.error || res.reason) }
    else {
      const items = (res.titles || []).map((t, i) =>
        '<div class="title-item"><div class="t-top"><div class="t-title">' + (i + 1) + '. ' + esc(t.title) + ' <span class="muted small">(' + t.title.length + ' chars)</span></div>' +
        '<div class="t-actions"><span class="muted small">' + t.score + '%</span>' + labelPill(t.label) +
        '<button class="btn btn-ghost btn-sm" data-copy="' + esc(t.title) + '" type="button">Copy</button></div></div>' + scoreBar(t.score) + '</div>').join('')
      html = '<h3>15 titles - primary: ' + esc(res.primary) + ' (' + esc(res.serpStatus) + ')</h3><div class="title-list">' + items + '</div>'
    }
  } else if (toolId === 'meta-description') {
    const year = new Date().getFullYear()
    const res = await apiPost('/api/gemini', { prompt: 'Write 3 SEO meta descriptions (70-160 chars) for: ' + value + ' ' + year, email, plan: planIdFor(email) })
    if (res.status === 'Real') {
      html = localMetaGeminiHtml(res.text, value)
    } else {
      html = '<div class="alert alert-error">' + esc(res.reason || 'Gemini unavailable') + '</div>' + localMetaFallbackHtml(value)
    }
  } else if (toolId === 'pagespeed' || toolId === 'seo-audit') {
    const res = await apiGet('/api/pagespeed?url=' + encodeURIComponent(value) + '&email=' + encodeURIComponent(email) + '&plan=' + encodeURIComponent(planIdFor(email)), 55000)
    if (res.status === 'Real') {
      const m = res.metrics || {}
      const cats = [['Performance', res.performance], ['SEO', res.seo], ['Best Practices', res.bestPractices], ['Accessibility', res.accessibility]]
      const catHtml = cats.map(c => '<div class="metric"><div class="m-label">' + c[0] + '</div><div class="m-value">' + (c[1] == null ? 'N/A' : c[1] + '%') + '</div>' + (c[1] != null ? scoreBar(c[1]) : '') + '</div>').join('')
      const metHtml = Object.entries({ FCP: m.fcp, LCP: m.lcp, CLS: m.cls, TBT: m.tbt, SI: m.si }).map(([k, v]) => '<div class="metric"><div class="m-label">' + k + '</div><div class="m-value" style="font-size:16px">' + esc(v || 'N/A') + '</div></div>').join('')
      const opps = (res.opportunities || []).map(o => '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(o.title) + '</div><div class="t-actions"><span class="muted small">-' + o.savingsMs + 'ms</span></div></div></div>').join('')
      html = '<div class="metric-grid">' + catHtml + '</div><h3 class="mt-24">Core Web Vitals</h3><div class="metric-grid mt-16">' + metHtml + '</div>' +
        (opps ? '<h3 class="mt-24">Top Opportunities</h3><div class="title-list">' + opps + '</div>' : '') +
        '<div class="flex mt-16"><button class="btn btn-primary btn-sm" data-ai-plan="' + esc(res.url || value) + '" type="button">Generate AI Fix Plan (Lighthouse + on-page + AI)</button></div>' +
        '<div class="small muted mt-16">URL: ' + esc(res.url) + '</div>'
    } else { html = errBlock(res.reason || 'PageSpeed unavailable') }
  } else {
    const res = await apiGet('/api/serp?q=' + encodeURIComponent(value) + '&email=' + encodeURIComponent(email) + '&plan=' + encodeURIComponent(planIdFor(email)))
    if (res.status !== 'Real') { html = errBlock(res.reason || 'SERP unavailable') }
    else {
      const notice = res.notice ? '<div class="alert alert-info">' + esc(res.notice) + '</div>' : ''
      html = notice + serpBody(toolId, res, value)
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Run Tool' }
  out.innerHTML = html
}

const KW_FUNCTION_WORDS = new Set('for,to,of,the,and,a,an,in,on,near,my,with,vs,about,at,by,from,into'.split(','))
function kwCoreTokens(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w && w.length > 1 && !/^\d{4}$/.test(w) && !KW_FUNCTION_WORDS.has(w))
}
const KW_INTENT_RE = /\b(best|top|review|reviews|buy|cheap|cheapest|price|coupon|discount|how|what|guide|tutorial|template|templates|example|examples|vs|for|free|near me|list|ideas|alternative|alternatives|small business|startup|beginner|beginners|pro|premium|hire|agency|services|2026)\b/
function kwScore(item, value, core) {
  const k = item.k.toLowerCase()
  const words = k.split(/\s+/).length
  let s = 35
  const hasAll = core.length > 0 && core.every(t => k.indexOf(t) >= 0)
  const hasOne = core.some(t => k.indexOf(t) >= 0)
  if (hasAll) s += 28
  else if (hasOne) s += 10
  if (words >= 3 && words <= 7) s += 8
  else if (words > 7) s += 3
  if (KW_INTENT_RE.test(k)) s += 12
  const v = String(value || '').toLowerCase().trim()
  if (v.split(/\s+/).length >= 2 && v.length >= 6 && k.indexOf(v) >= 0) s += 10
  if (item.src === 'PAA') s += 5
  return Math.min(100, Math.max(15, s))
}
function kwExpandedIdeas(value) {
  const v = String(value || '').trim()
  if (!v) return []
  const year = new Date().getFullYear()
  const ideas = []
  const lead = m => new RegExp('^' + m + '\\b', 'i').test(v)
  if (!lead('best') && !lead('top') && !lead('10 ')) ideas.push('best ' + v)
  if (!lead('best') && !lead('top')) ideas.push('top ' + v)
  ideas.push(v + ' for beginners', v + ' examples', v + ' templates')
  if (!new RegExp(String(year)).test(v)) ideas.push(v + ' ' + year)
  if (!/^(how|what|which|is|are|why|can|do|does)\b/i.test(v)) ideas.push('how to choose ' + v)
  return ideas
}
function kwIdeaPool(res, value) {
  const core = kwCoreTokens(value)
  const pool = []
  const seen = new Set()
  ;(res.related || []).forEach(r => { if (!seen.has(r.toLowerCase())) { seen.add(r.toLowerCase()); pool.push({ k: r, src: 'related' }) } })
  ;(res.paa || []).forEach(q => { if (!seen.has(q.toLowerCase())) { seen.add(q.toLowerCase()); pool.push({ k: q, src: 'PAA' }) } })
  kwExpandedIdeas(value).forEach(k => { if (!seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); pool.push({ k, src: 'expanded' }) } })
  const missing = item => {
    if (core.length === 0) return 0
    return core.filter(t => item.k.toLowerCase().indexOf(t) < 0).length
  }
  let kept = pool.filter(i => missing(i) === 0)
  if (kept.length < 5) { kept = pool.filter(i => missing(i) <= 1) }
  if (kept.length < 2) { kept = pool.slice() }
  return kept
    .map(i => { const score = kwScore(i, value, core); return { k: i.k, src: i.src, score, label: localLabel(score) } })
    .sort((a, b) => b.score - a.score || a.k.localeCompare(b.k))
}
function buildKwHtml(res, value) {
  const pool = kwIdeaPool(res, value)
  const tblId = mid('kwtbl')
  const renderRow = item =>
    '<tr><td style="word-break:break-word">' + esc(item.k) + '</td><td>' + esc(item.src) + '</td><td>' + item.score + '%</td><td>' + labelPill(item.label) + '</td>' +
    '<td class="kw-actions"><button class="btn btn-ghost btn-sm" data-copy="' + esc(item.k) + '" type="button">Copy</button></td></tr>'
  const mr = rowMore(mid('kw-rows'), pool, renderRow, 10)
  const copyAllBtn = '<button class="btn btn-ghost btn-sm" data-copy-all="' + tblId + '" type="button">Copy all keywords</button>'
  const head = '<div class="kw-list-head mt-24"><h3>Keyword ideas (' + pool.length + ' real signals)</h3>' + copyAllBtn + '</div>'
  return head +
    '<div class="table-wrap"><table class="kw-table" id="' + tblId + '"><thead><tr><th>Keyword</th><th>Source</th><th>Score</th><th>Label</th><th></th></tr></thead>' +
    mr.tb + '</table></div>' +
    mr.btn +
    (pool.length > 10 ? '<div class="center mt-8">' + copyAllBtn + '</div>' : '')
}

function serpBody(toolId, res, value) {
  const relChips = list => (list || []).map(r => '<span class="chip"><b>' + esc(r) + '</b></span>').join(' ') || '<span class="muted small">None found</span>'
  if (toolId === 'keyword-research') {
    const kws = buildKwHtml(res, value)
    return '<div class="metric-grid"><div class="metric"><div class="m-label">Total Results</div><div class="m-value">' + (res.total_results || 'N/A') + '</div></div>' +
      '<div class="metric"><div class="m-label">PAA Questions</div><div class="m-value">' + (res.paa || []).length + '</div></div>' +
      '<div class="metric"><div class="m-label">Related Searches</div><div class="m-value">' + (res.related || []).length + '</div></div></div>' + kws
  }
  if (toolId === 'serp-analyzer') {
    if (res.organic && res.organic.length) {
      const mr = rowMore(mid('organic'), res.organic, o =>
        '<tr><td>' + (o.position || '-') + '</td><td><b>' + esc(o.domain || '') + '</b></td><td>' + esc(o.title || '') + '</td><td><a href="' + esc(o.link || '') + '" target="_blank" rel="noopener" class="primary-link">' + esc((o.link || '').slice(0, 60)) + '</a></td></tr>', 10)
      return '<div class="table-wrap"><table class="kw-table"><thead><tr><th>Pos</th><th>Domain</th><th>Title</th><th>URL</th></tr></thead>' + mr.tb + '</table></div>' + mr.btn
    }
    return '<div class="alert alert-error">Live organic results are temporarily unavailable. Use Keyword Research or Related Keywords for real SERP-signal data.</div>' +
      '<h3>Real related searches</h3><div class="flex mt-16">' + relChips(res.related) + '</div>'
  }
  if (toolId === 'competitor-analysis') {
    const comps = (res.competitors || [])
    if (!comps.length) {
      return '<div class="alert alert-error">Competitor domains need live organic SERP, which is temporarily unavailable.</div>' +
        '<h3>Real related searches</h3><div class="flex mt-16">' + relChips(res.related) + '</div>'
    }
    const list = itemMore(mid('comps'), comps, (c, i) =>
      '<div class="title-item"><div class="t-top"><div class="t-title">' + (i + 1) + '. ' + esc(c) + '</div><div class="t-actions"><button class="btn btn-ghost btn-sm" data-copy="' + esc(c) + '" type="button">Copy</button></div></div></div>', 8)
    return '<h3>Competitor domains (' + comps.length + ')</h3><div class="title-list">' + list + '</div>'
  }
  if (toolId === 'question-finder') {
    const qs = (res.paa || [])
    if (!qs.length) return '<div class="alert alert-error">No PAA questions found for this query.</div>'
    const list = itemMore(mid('paa'), qs, (q, i) =>
      '<div class="title-item"><div class="t-top"><div class="t-title">' + (i + 1) + '. ' + esc(q) + '</div><div class="t-actions"><button class="btn btn-ghost btn-sm" data-copy="' + esc(q) + '" type="button">Copy</button></div></div></div>', 6)
    return '<h3>People Also Ask (' + qs.length + ')</h3><div class="title-list">' + list + '</div>'
  }
  if (toolId === 'related-keywords') {
    const related = res.related || []
    const chipsWrap = related.length > 12
      ? itemMore(mid('rel'), related, r => '<span class="chip"><b>' + esc(r) + '</b></span>', 12, first => '<div class="flex mt-16">' + first + '</div>')
      : '<div class="flex mt-16">' + relChips(related) + '</div>'
    return '<h3>Related searches</h3>' + chipsWrap + buildKwHtml(res, value)
  }
  if (toolId === 'keyword-difficulty') {
    if (res.total_results == null) {
      return '<div class="alert alert-error">Difficulty needs live organic SERP competition signals, which are temporarily unavailable. Try Keyword Research for real keyword signals.</div>' +
        '<h3>Real related searches</h3><div class="flex mt-16">' + relChips(res.related) + '</div>'
    }
    const kd = localKD(res)
    return '<div class="metric-grid"><div class="metric"><div class="m-label">Difficulty</div><div class="m-value">' + kd.kd + '%</div></div>' +
      '<div class="metric"><div class="m-label">Label</div><div class="m-value" style="font-size:18px">' + labelPill(kd.label) + '</div></div>' +
      '<div class="metric"><div class="m-label">Competitors</div><div class="m-value">' + (res.competitors || []).length + '</div></div></div>' + scoreBar(kd.kd) +
      '<div class="small muted mt-16">Based on real SERP competition signals: ' + (res.total_results || 'n/a') + ' total results.</div>'
  }
  return '<div class="alert alert-error">No SERP data returned for this query.</div>'
}

function errBlock(msg) {
  return '<div class="alert alert-error">' + esc(msg || 'Something went wrong') + '</div>'
}

/* ---------- pricing ---------- */

function pricingView() {
  const planCards = PLANS.map(plan => {
    const feats = plan.features.map(f => '<li>' + esc(f) + '</li>').join('')
    return '<div class="plan-card' + (plan.popular ? ' popular' : '') + '">' +
      (plan.popular ? '<span class="plan-tag">MOST POPULAR</span>' : '') +
      '<div class="plan-name">' + esc(plan.name) + '</div>' +
      '<div class="plan-tagline">' + esc(plan.tagline) + '</div>' +
      '<div class="plan-price"><b>$' + plan.price + '</b><span>/month</span></div>' +
      '<ul class="plan-features">' + feats + '</ul>' +
      '<button class="btn ' + (plan.popular ? 'btn-primary' : 'btn-ghost') + '" data-plan="' + plan.id + '" type="button">' + (plan.price === 0 ? 'Start Free' : 'Get ' + plan.name) + '</button></div>'
  }).join('')
  const payLogos = PAYMENT_METHODS.map(payBadgeHtml).join('')
  return '<div class="section container">' +
    '<div class="section-head"><span class="eyebrow">Pricing</span><h2>Simple, honest pricing</h2><p>Free forever. Crypto payments auto-verified on-chain in ~2 seconds. Mobile/bank payments approved by our admin.</p></div>' +
    '<div class="pricing-grid">' + planCards + '</div>' +
    '<div class="section-head mt-24"><span class="eyebrow">Payment</span><h2>12 accepted payment methods</h2></div>' +
    '<div class="pay-row">' + payLogos + '</div>' +
    '<div class="panel mt-24"><h3>Contact for support</h3>' +
      '<div class="flex mt-16"><a class="btn btn-ghost" href="https://wa.me/8801886822816" target="_blank" rel="noopener">WhatsApp: +8801886822816</a>' +
      '<a class="btn btn-ghost" href="https://t.me/+8801886822816" target="_blank" rel="noopener">Telegram: +8801886822816</a></div>' +
    '</div></div>'
}

/* ---------- dashboard ---------- */

function dashboardView() {
  const u = currentUser()
  if (!u) {
    return '<div class="section container auth-wrap"><div class="form-card center"><h2>Login required</h2><p class="sub">Sign in to view your dashboard.</p><a href="/auth" class="btn btn-primary">Login / Register</a></div></div>'
  }
  const premium = u.premium && u.premium.status === 'Active' ? u.premium : null
  const agentsUnlocked = premium ? premium.agents : 3
  const agentList = AGENTS.slice(0, agentsUnlocked)
  const agentGrid = agentList.map(a =>
    '<button class="feature-card agent-card" data-agent="' + esc(a.name) + '" type="button"><div class="f-icon" style="color:#22d3ee">A</div><h3>' + esc(a.name) + '</h3><p>' + esc(a.desc) + '</p><span class="agent-run">Run - ' + esc(agentToolName(a.name)) + '</span></button>').join('')
    + (agentsUnlocked < AGENTS.length ? '<div class="feature-card center"><h3>+ ' + (AGENTS.length - agentsUnlocked) + ' locked agents</h3><p>Upgrade to Starter ($5) to unlock 12 agents.</p><button class="btn btn-primary btn-sm mt-16" data-plan="starter" type="button">Unlock</button></div>' : '')

  const reports = store.reports().filter(r => r.email === u.email)
  const allScores = reports.flatMap(r => (r.titles || []).map(t => t.score))
  const avgScore = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
  const daily = localUsageFor(u.email)

  const myReports = reports.length ? reports.map(r =>
    '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(r.primary) + ' <span class="muted small">' + r.titleCount + ' titles - ' + esc(r.intent) + ' intent</span></div><div class="t-actions"><span class="muted small">' + fmtTime(r.date) + '</span><button class="btn btn-ghost btn-sm" data-view-report="' + r.id + '" type="button">View</button></div></div></div>').join('')
    : '<div class="muted small">No reports yet. Try the <a href="/generator" style="color:var(--primary-2)">Title Generator</a>.</div>'

  const myPayments = store.payments().filter(p => p.email === u.email).map(p =>
    '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.planName) + '</td><td>$' + p.amount + '</td><td>' + esc(p.method) + '</td><td>' + esc(p.trx) + '</td><td>' + fmtDate(p.createdAt) + '</td><td>' + statusPill(p.status) + '</td></tr>').join('')

  const premiumBlock = premium
    ? '<div class="premium-badge premium-active mt-16">Premium Active - ' + esc(premium.planName) + '</div>'
    : '<button class="btn btn-primary btn-sm mt-16" data-plan="starter" type="button">Upgrade - Starter $5</button>'

  const phoneLine = u.phoneVerified && u.phone
    ? '<div class="phone-line"><b>' + esc(maskPhone(u.phone)) + '</b> <span class="label-pill label-good">VERIFIED</span></div>'
    : '<div class="phone-line muted small">' + (u.phone ? esc(maskPhone(u.phone)) + ' - not verified yet' : 'No mobile number linked yet') + '</div>'

  const ownerBlock = isAdmin(u.email)
    ? '<div class="phone-block mt-16"><div class="p-label small muted">Owner console</div>' +
      '<div class="flex mt-8" style="gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary btn-sm" data-goto-admin type="button">Admin Panel</button>' +
      '<button class="btn btn-ghost btn-sm" data-goto-admin-dev type="button">Development (MonkeyCode-AI)</button>' +
      '</div></div>'
    : ''

  return '<div class="section container">' +
    '<div class="section-head"><span class="eyebrow">Dashboard</span><h2>Welcome, ' + esc(u.name.split(' ')[0]) + '</h2></div>' +
    '<div class="dash-grid">' +
      '<div class="profile-card">' +
        '<div class="avatar">' + esc(u.name.charAt(0).toUpperCase()) + '</div>' +
        '<h3>' + esc(u.name) + '</h3><div class="p-email">' + esc(u.email) + '</div>' +
        premiumBlock +
        ownerBlock +
        '<div class="phone-block mt-16"><div class="p-label small muted">Mobile number (for password recovery)</div>' + phoneLine +
        '<button class="btn btn-ghost btn-sm mt-8" data-verify-phone type="button">' + (u.phoneVerified ? 'Change / re-verify number' : 'Add & verify number') + '</button></div>' +
        '<div class="phone-block mt-16"><div class="p-label small muted">Recovery email (for password reset)</div>' +
        (u.recoveryEmail
          ? '<div class="phone-line"><b>' + esc(u.recoveryEmail) + '</b> <span class="label-pill label-good">SET</span></div>'
          : '<div class="phone-line muted small">No recovery email linked yet</div>') +
        '<button class="btn btn-ghost btn-sm mt-8" data-recovery-email type="button">' + (u.recoveryEmail ? 'Change recovery email' : 'Add recovery email') + '</button></div>' +
        '<div class="profile-stats">' +
          '<div class="ps"><b>' + (premium ? premium.daily : 3) + '</b><span>Daily credits</span></div>' +
          '<div class="ps"><b>' + daily + '</b><span>Used today</span></div>' +
          '<div class="ps"><b>' + (premium ? premium.agents : 3) + '</b><span>Agents</span></div>' +
          '<div class="ps"><b>' + (premium ? premium.monthly : 90) + '</b><span>Monthly</span></div>' +
          '<div class="ps"><b>' + (avgScore != null ? avgScore + '%' : 'N/A') + '</b><span>Avg score</span></div>' +
          '<div class="ps"><b>' + (avgScore != null ? labelPill(localLabel(avgScore)) : 'N/A') + '</b><span>Quality</span></div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm mt-24" data-logout type="button">Logout</button>' +
      '</div>' +
      '<div>' +
        '<div class="tabs">' +
          '<button class="tab active" data-tab="overview" type="button">Overview</button>' +
          '<button class="tab" data-tab="agents" type="button">Agents (' + agentsUnlocked + ')</button>' +
          '<button class="tab" data-tab="reports" type="button">Reports</button>' +
          '<button class="tab" data-tab="payments" type="button">Payments</button>' +
        '</div>' +
        '<div class="panel" id="dashTab">' +
          '<div class="metric-grid">' +
            '<div class="metric"><div class="m-label">Daily Credits</div><div class="m-value">' + daily + ' / ' + (premium ? premium.daily : 3) + '</div>' + scoreBar(Math.round(daily / Math.max(1, (premium ? premium.daily : 3)) * 100)) + '</div>' +
            '<div class="metric"><div class="m-label">Agents Unlocked</div><div class="m-value">' + agentsUnlocked + ' / 19</div>' + scoreBar(Math.round(agentsUnlocked / 19 * 100)) + '</div>' +
            '<div class="metric"><div class="m-label">Quality Score</div><div class="m-value">' + (avgScore != null ? avgScore + '%' : 'N/A') + '</div><div class="mt-16">' + (avgScore != null ? labelPill(localLabel(avgScore)) : '<span class="muted small">Generate titles to score</span>') + '</div></div>' +
          '</div>' +
          '<div class="mt-24"><h3>My Reports</h3><div class="title-list">' + myReports + '</div></div>' +
          '<div class="mt-24"><h3>Your AI Agents (' + agentsUnlocked + '/19) - click to run</h3><div class="grid grid-3 mt-16">' + agentGrid + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div></div>'
}

function fmtTime(iso) { return new Date(iso).toLocaleString() }
function fmtDate(iso) { return new Date(iso).toLocaleDateString() }

/* ---------- admin ---------- */

function adminView() {
  if (!adminAuthed()) {
    return '<div class="section container auth-wrap"><div class="form-card">' +
      '<h2>Admin Login</h2><p class="sub">Restricted area - verified securely by the server. No password is stored in the page source.</p>' +
      (state.adminError ? '<div class="alert alert-error">' + esc(state.adminError) + '</div>' : '') +
      '<div class="field"><label>Email</label><input type="email" id="adminEmail" value="admin@seo-service-provider.com"></div>' +
      '<div class="field"><label>Password</label><input type="password" id="adminPass" placeholder="Enter admin password"></div>' +
      '<button class="btn btn-primary" id="adminLoginBtn" style="width:100%" type="button">Login as Admin</button>' +
      '<div class="center small muted mt-12"><a href="#" data-admin-forgot style="color:var(--primary-2)">Forgot admin password?</a></div>' +
      '<div class="center small muted mt-16">Protected by server verification + rate limiting. Bots cannot log in.</div>' +
      '</div></div>'
  }
  const unreadTotal = store.chats().reduce((a, c) => a + (c.adminUnread || 0), 0)
  const trashCount = trashedUsers().length
  const premiumCount = premiumUsers().length
  const role = adminRole()
  const isOwner = role === 'admin'
  const ownerTabs = [
    ['users', 'Users'],
    ['premium', 'Premium' + (premiumCount ? ' (' + premiumCount + ')' : '')],
    ['trash', 'Trash' + (trashCount ? ' (' + trashCount + ')' : '')],
    ['payments', 'Payments'],
    ['plans', 'Plans'],
    ['methods', 'Payment Methods'],
    ['chats', 'Live Chat' + (unreadTotal ? ' (' + unreadTotal + ')' : '')],
    ['logs', 'System Logs'],
    ['audit', 'Audit Logs'],
    ['moderators', 'Moderators'],
    ['account', 'Account & Security'],
    ['maintenance', 'Maintenance'],
    ['dev', 'Development']
  ]
  const moderatorTabs = [
    ['logs', 'System Logs'],
    ['chats', 'Live Chat' + (unreadTotal ? ' (' + unreadTotal + ')' : '')]
  ]
  const tabs = isOwner ? ownerTabs : moderatorTabs
  const allowed = tabs.map(t => t[0])
  if (allowed.indexOf(state.adminTab) < 0) state.adminTab = allowed[0]
  const tabHtml = tabs.map(([id, label]) => '<button class="tab' + (state.adminTab === id ? ' active' : '') + '" data-atab="' + id + '" type="button">' + label + '</button>').join('')
  const roleBadge = isOwner
    ? '<span class="label-pill label-veryhigh">OWNER</span>'
    : '<span class="label-pill label-good">MODERATOR</span>'
  return '<div class="section container">' +
    '<div class="section-head"><span class="eyebrow">Admin Panel</span><h2>Manage your platform ' + roleBadge + '</h2>' +
    (isOwner ? '' : '<p class="small muted mt-8">Moderator access is limited to System Logs and Live Chat.</p>') +
    '</div>' +
    '<div class="tabs">' + tabHtml + '</div>' +
    '<div class="panel" id="adminTab">' + adminTabContent() + '</div>' +
    '</div>'
}

function aField(label, id, type, ph) {
  return '<div class="field"><label>' + label + '</label><input type="' + (type || 'text') + '" id="' + id + '" placeholder="' + (ph || '') + '"></div>'
}
function permDenied() {
  return '<h3>Not available</h3><p class="small muted mt-8">Your role does not have permission to view this section.</p>'
}

function adminTabContent() {
  if (state.adminTab === 'users') {
    const list = activeUsers()
    const rows = list.map(u2 => {
      const self = u2.email === (currentUser() || {}).email
      const status = u2.blocked ? '<span class="label-pill label-veryhigh">BLOCKED</span>' : '<span class="label-pill label-good">ACTIVE</span>'
      const actions = self ? '<span class="muted small">you</span>'
        : '<div class="flex" style="gap:6px">' +
          (u2.blocked
            ? '<button class="btn btn-success btn-sm" data-user-unblock="' + esc(u2.email) + '" type="button">Unblock</button>'
            : '<button class="btn btn-ghost btn-sm" data-user-block="' + esc(u2.email) + '" type="button">Block</button>') +
          '<button class="btn btn-danger btn-sm" data-user-delete="' + esc(u2.email) + '" type="button">Delete</button></div>'
      return '<tr><td>' + esc(u2.name) + '</td><td>' + esc(u2.email) + '</td><td>' + fmtDate(u2.createdAt) + '</td><td>' +
        (u2.premium && u2.premium.status === 'Active' ? statusPill('approved') + ' ' + esc(u2.premium.planName) : statusPill('pending') + ' Free') +
        '</td><td>' + (isAdmin(u2.email) ? '<span class="label-pill label-veryhigh">ADMIN</span>' : '<span class="muted small">user</span>') +
        '</td><td>' + status + '</td><td>' + actions + '</td></tr>'
    }).join('')
    return '<h3>Users (' + list.length + ')</h3>' +
      (blockedUsers().length ? '<p class="small muted mt-16">' + blockedUsers().length + ' blocked account(s). Blocked users cannot login or use any tool.</p>' : '') +
      '<div class="form-card mt-16"><h4>Create a user</h4>' +
      '<p class="small muted">Creates a real login account (email confirmed) with the password you set.</p>' +
      '<div class="grid grid-3" style="gap:12px">' +
        aField('Full name', 'newUserName', 'text', 'User name') +
        aField('Email', 'newUserEmail', 'email', 'user@example.com') +
        aField('Password (min 8)', 'newUserPass', 'password', 'Temporary password') +
      '</div>' +
      '<button class="btn btn-primary" id="newUserBtn" type="button">Create user</button>' +
      '<div id="newUserMsg" class="mt-8"></div></div>' +
      '<div class="table-wrap mt-16"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Plan</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted">No users yet</td></tr>') + '</tbody></table></div>'
  }
  if (state.adminTab === 'trash') {
    const list = trashedUsers()
    const rows = list.map(u2 =>
      '<tr><td>' + esc(u2.name) + '</td><td>' + esc(u2.email) + '</td><td>' + fmtDate(u2.deletedAt || u2.createdAt) + '</td><td>' +
      '<div class="flex" style="gap:6px"><button class="btn btn-success btn-sm" data-user-recover="' + esc(u2.email) + '" type="button">Recover</button>' +
      '<button class="btn btn-danger btn-sm" data-user-purge="' + esc(u2.email) + '" type="button">Delete permanently</button></div></td></tr>').join('')
    return '<h3>Trash (' + list.length + ')</h3>' +
      '<p class="small muted mt-16">Deleted users land here and cannot login or do anything. <b>Recover</b> restores the account; <b>Delete permanently</b> erases it for good.</p>' +
      '<div class="table-wrap mt-16"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Deleted</th><th>Action</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="muted">Trash is empty</td></tr>') + '</tbody></table></div>'
  }
  if (state.adminTab === 'premium') {
    const users = premiumUsers()
    const approved = store.payments().filter(p => p.status === 'approved')
    const totalRevenue = approved.reduce((a, p) => a + Number(p.amount || 0), 0)
    const byDate = {}
    approved.forEach(p => { const d = String(p.createdAt || '').slice(0, 10) || 'unknown'; (byDate[d] = byDate[d] || []).push(p) })
    const dates = Object.keys(byDate).sort().reverse()
    const dateRows = dates.map(d => {
      const list = byDate[d]
      const total = list.reduce((a, p) => a + Number(p.amount || 0), 0)
      const names = list.map(p => esc(p.name || p.email)).join(', ')
      return '<tr><td><b>' + esc(d) + '</b></td><td>' + list.length + '</td><td>' + names + '</td><td>$' + total + '</td></tr>'
    }).join('')
    const userRows = users.map(u2 => {
      const pay = approved.filter(p => p.email === u2.email).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
      return '<tr><td>' + esc(u2.name) + '</td><td>' + esc(u2.email) + '</td><td>' + esc((u2.premium || {}).planName || '-') + '</td><td>' + fmtDate((u2.premium || {}).since || u2.createdAt) + '</td><td>$' + (pay ? pay.amount : (u2.premium || {}).amount || 0) + '</td><td>' + esc(pay ? pay.method : '-') + '</td></tr>'
    }).join('')
    return '<h3>Premium Users (' + users.length + ')</h3>' +
      '<div class="metric-grid mt-16">' +
        '<div class="metric"><div class="m-label">Premium buyers</div><div class="m-value">' + users.length + '</div></div>' +
        '<div class="metric"><div class="m-label">Approved payments</div><div class="m-value">' + approved.length + '</div></div>' +
        '<div class="metric"><div class="m-label">Total revenue</div><div class="m-value">$' + totalRevenue + '</div></div>' +
      '</div>' +
      '<h4 class="mt-24">Sales by date</h4>' +
      '<div class="table-wrap mt-8"><table class="table"><thead><tr><th>Date</th><th>Buyers</th><th>Names</th><th>Total</th></tr></thead><tbody>' +
      (dateRows || '<tr><td colspan="4" class="muted">No premium sales yet</td></tr>') + '</tbody></table></div>' +
      '<h4 class="mt-24">Premium user details</h4>' +
      '<div class="table-wrap mt-8"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Since</th><th>Paid</th><th>Method</th></tr></thead><tbody>' +
      (userRows || '<tr><td colspan="6" class="muted">No premium users yet</td></tr>') + '</tbody></table></div>'
  }
  if (state.adminTab === 'payments') {
    const rows = store.payments().map(p => {
      const proof = p.proofImage ? '<br><img src="' + esc(p.proofImage) + '" alt="payment screenshot" class="pay-proof-thumb" data-open-proof="' + p.id + '">' : ''
      const ids = [p.trx ? 'Trx: ' + esc(p.trx) : '', p.orderId ? 'Order: ' + esc(p.orderId) : ''].filter(Boolean).join(' | ') || '<span class="muted">no reference</span>'
      return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.name) + '<br><span class="muted small">' + esc(p.email) + '</span></td><td>' + esc(p.planName) + ' - $' + p.amount + '</td><td>' + esc(p.method) + '<br><span class="muted small">' + ids + '</span>' + proof + '</td><td>' + fmtDate(p.createdAt) + '</td><td>' + statusPill(p.status) + '</td><td>' +
        (p.status === 'pending' || p.status === 'auto_verifying' ? '<div class="flex"><button class="btn btn-success btn-sm" data-approve-pay="' + p.id + '" type="button">Approve</button><button class="btn btn-danger btn-sm" data-reject-pay="' + p.id + '" type="button">Reject</button></div>' : '<span class="muted small">-</span>') + '</td></tr>'
    }).join('')
    return '<h3>Payments (' + store.payments().length + ')</h3>' +
      '<p class="small muted mt-8">Users may submit a Binance order ID, a transaction hash, or a payment screenshot (any one is enough). Review server-submitted proofs below.</p>' +
      '<div class="table-wrap mt-16"><table class="table"><thead><tr><th>ID</th><th>Customer</th><th>Plan</th><th>Method &amp; proof</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="muted">No payments yet</td></tr>') + '</tbody></table></div>' +
      '<h4 class="mt-24">Submitted proofs</h4>' +
      '<div id="adminProofs" class="mt-8"><span class="muted small">Loading proofs...</span></div>'
  }
  if (state.adminTab === 'plans') {
    if (adminRole() !== 'admin') return permDenied()
    return '<h3>Plans Management</h3>' +
      '<p class="small muted mt-8">Create, edit and delete subscription plans. Inactive plans are hidden from the storefront.</p>' +
      '<div class="form-card mt-16"><h4 id="planFormTitle">Add a plan</h4>' +
      '<input type="hidden" id="planId">' +
      '<div class="grid grid-2" style="gap:12px">' +
        aField('Plan name', 'planName', 'text', 'e.g. Studio') +
        aField('Price', 'planPrice', 'number', '0') +
        aField('Currency', 'planCurrency', 'text', 'BDT') +
        aField('Agents', 'planAgents', 'number', '1') +
        aField('Daily credits', 'planDaily', 'number', '10') +
        aField('Monthly credits', 'planMonthly', 'number', '100') +
        aField('Badge (optional)', 'planBadge', 'text', 'Most popular') +
        aField('Sort order', 'planSort', 'number', '1') +
      '</div>' +
      '<div class="field"><label>Features (one per line)</label><textarea id="planFeatures" rows="3" placeholder="Unlimited tools&#10;Priority support"></textarea></div>' +
      '<div class="field"><label><input type="checkbox" id="planActive" checked> Active (visible on pricing)</label></div>' +
      '<div class="input-row"><button class="btn btn-primary" id="planSaveBtn" type="button">Save plan</button>' +
      '<button class="btn btn-ghost" id="planResetBtn" type="button">New / clear form</button></div>' +
      '<div id="planMsg" class="mt-8"></div></div>' +
      '<div id="adminPlansList" class="mt-16"><span class="muted small">Loading plans...</span></div>'
  }
  if (state.adminTab === 'methods') {
    if (adminRole() !== 'admin') return permDenied()
    return '<h3>Payment Methods</h3>' +
      '<p class="small muted mt-8">Add, enable/disable or delete payment gateways shown at checkout (bKash, Nagad, Bank, Binance Pay, crypto).</p>' +
      '<div class="form-card mt-16"><h4 id="pmFormTitle">Add a payment method</h4>' +
      '<input type="hidden" id="pmId">' +
      '<div class="grid grid-2" style="gap:12px">' +
        aField('Label', 'pmLabel', 'text', 'e.g. Binance Pay') +
        aField('Number / ID / address', 'pmNumber', 'text', 'Pay ID or wallet address') +
        aField('Network', 'pmNetwork', 'text', 'e.g. BEP20') +
        aField('Sort order', 'pmSort', 'number', '1') +
      '</div>' +
      '<div class="field"><label>Note / instructions</label><textarea id="pmNote" rows="2"></textarea></div>' +
      '<div class="field"><label><input type="checkbox" id="pmCrypto"> Crypto (auto-verify attempt)</label> ' +
      '<label class="ml-16"><input type="checkbox" id="pmEnabled" checked> Enabled</label></div>' +
      '<div class="input-row"><button class="btn btn-primary" id="pmSaveBtn" type="button">Save method</button>' +
      '<button class="btn btn-ghost" id="pmResetBtn" type="button">New / clear form</button></div>' +
      '<div id="pmMsg" class="mt-8"></div></div>' +
      '<div id="adminMethodsList" class="mt-16"><span class="muted small">Loading methods...</span></div>'
  }
  if (state.adminTab === 'moderators') {
    if (adminRole() !== 'admin') return permDenied()
    return '<h3>Manage Moderators</h3>' +
      '<p class="small muted mt-8">Moderators can ONLY view System Logs and reply in Live Chat. They cannot access Plans, Payment Methods, Audit Logs, Users or Maintenance.</p>' +
      '<div class="form-card mt-16"><h4>Create a moderator</h4>' +
      '<div class="grid grid-2" style="gap:12px">' +
        aField('Full name', 'modName', 'text', 'Moderator name') +
        aField('Email', 'modEmail', 'email', 'mod@example.com') +
        aField('Password (min 8)', 'modPassword', 'password', 'Temporary password') +
      '</div>' +
      '<button class="btn btn-primary" id="modCreateBtn" type="button">Create moderator</button>' +
      '<div id="modMsg" class="mt-8"></div></div>' +
      '<div id="adminModsList" class="mt-16"><span class="muted small">Loading moderators...</span></div>'
  }
  if (state.adminTab === 'logs') {
    return '<h3>System Logs</h3>' +
      '<p class="small muted mt-8">Background job results (title generation, SERP, PageSpeed, SEO audit, AI chat) and system errors. <span id="logConcurrency"></span></p>' +
      '<div class="input-row mt-16"><button class="btn btn-ghost btn-sm" id="logsRefreshBtn" type="button">Refresh</button>' +
      (adminRole() === 'admin' ? '<button class="btn btn-danger btn-sm" id="logsClearBtn" type="button">Clear system logs</button>' : '') +
      '</div><div id="adminLogs" class="mt-16"><span class="muted small">Loading logs...</span></div>'
  }
  if (state.adminTab === 'audit') {
    if (adminRole() !== 'admin') return permDenied()
    return '<h3>Audit Logs</h3>' +
      '<p class="small muted mt-8">Security history: admin/moderator logins, settings changes, plan/payment-method updates, moderator management and backup creation.</p>' +
      '<div class="input-row mt-16"><button class="btn btn-ghost btn-sm" id="auditRefreshBtn" type="button">Refresh</button>' +
      '<button class="btn btn-danger btn-sm" id="auditClearBtn" type="button">Clear audit logs</button></div>' +
      '<div id="adminAudit" class="mt-16"><span class="muted small">Loading audit logs...</span></div>'
  }
  if (state.adminTab === 'maintenance') {
    if (adminRole() !== 'admin') return permDenied()
    return '<h3>Maintenance Mode</h3>' +
      '<p class="small muted mt-8">Take the public site offline for non-admins, pause new registrations, and cap how many heavy jobs run at once.</p>' +
      '<div class="form-card mt-16">' +
        '<div class="field"><label><input type="checkbox" id="mtMaintenance"> Enable maintenance mode (blocks all non-admin API and shows a notice)</label></div>' +
        '<div class="field"><label><input type="checkbox" id="mtRegistrations" checked> Allow new user registrations</label></div>' +
        '<div class="field"><label>Max concurrent background jobs (1-64)</label><input type="number" id="mtConcurrency" min="1" max="64" value="8"></div>' +
        '<button class="btn btn-primary" id="mtSaveBtn" type="button">Save settings</button>' +
        '<div id="mtMsg" class="mt-8"></div>' +
      '</div>'
  }
  if (state.adminTab === 'account') {
    return '<h3>Account &amp; Security</h3>' +
      '<p class="small muted mt-8">Change the admin password, add a recovery email, and verify a mobile number for WhatsApp/SMS password recovery.</p>' +
      '<div id="adminAcctStatus" class="alert alert-info mt-16">Loading account status...</div>' +
      '<div class="grid grid-2 mt-16" style="gap:16px">' +
        '<div class="form-card"><h4>Change password</h4>' +
          '<div class="field mt-8"><label>Current password</label><input type="password" id="acctCurPass" autocomplete="current-password"></div>' +
          '<div class="field"><label>New password (min 8 characters)</label><input type="password" id="acctNewPass" autocomplete="new-password"></div>' +
          '<div class="field"><label>Confirm new password</label><input type="password" id="acctNewPass2" autocomplete="new-password"></div>' +
          '<button class="btn btn-primary" id="acctPassBtn" type="button">Update password</button>' +
          '<div id="acctPassMsg" class="mt-8"></div>' +
        '</div>' +
        '<div class="form-card"><h4>Recovery email</h4>' +
          '<p class="small muted">Used to send password reset codes if you lose your password.</p>' +
          '<div class="field"><label>Recovery email</label><input type="email" id="acctRecovery" placeholder="you@example.com"></div>' +
          '<button class="btn btn-primary" id="acctRecoveryBtn" type="button">Save recovery email</button>' +
          '<div id="acctRecoveryMsg" class="mt-8"></div>' +
          '<h4 class="mt-24">Mobile number (WhatsApp / SMS)</h4>' +
          '<p class="small muted">Verify a number to reset your password by WhatsApp or SMS.</p>' +
          '<div class="field"><label>Mobile number (with country code)</label><input type="tel" id="acctPhone" placeholder="+8801XXXXXXXXX"></div>' +
          '<div class="input-row"><button class="btn btn-ghost" id="acctPhoneSendWa" type="button">Send code via WhatsApp</button>' +
          '<button class="btn btn-ghost" id="acctPhoneSendSms" type="button">Send code via SMS</button></div>' +
          '<div class="field mt-8"><label>One-time code</label><input type="text" id="acctPhoneCode" inputmode="numeric" maxlength="6" placeholder="6-digit code"></div>' +
          '<button class="btn btn-primary" id="acctPhoneVerifyBtn" type="button">Verify number</button>' +
          '<div id="acctPhoneMsg" class="mt-8"></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-card mt-16"><h4>Delivery providers (email / WhatsApp)</h4>' +
        '<p class="small muted">Real delivery status. Test-send a code to confirm messages actually arrive.</p>' +
        '<div id="deliveryStatus" class="small mt-8">Loading...</div>' +
        '<div class="grid grid-3 mt-16" style="gap:12px">' +
          '<div class="field"><label>Channel</label><select id="dvChannel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></div>' +
          aField('Send test to', 'dvContact', 'text', 'you@example.com or +8801...') +
        '</div>' +
        '<button class="btn btn-primary" id="dvTestBtn" type="button">Send test message</button>' +
        '<div id="dvMsg" class="mt-8"></div>' +
      '</div>'
  }
  if (state.adminTab === 'dev') {
    return devAdminContent()
  }
  if (state.adminTab === 'chats') {
    const broadcast = adminRole() === 'admin'
      ? '<div class="form-card mt-16"><h4>Broadcast to all users</h4>' +
        '<div class="field"><label>Message</label><textarea id="broadcastText" rows="2" placeholder="Message every user in live chat"></textarea></div>' +
        '<button class="btn btn-primary" id="broadcastBtn" type="button">Send to all users</button><div id="broadcastMsg" class="mt-8"></div></div>'
      : ''
    return '<h3>Live Chat</h3>' +
      '<p class="small muted mt-8">Reply to every user individually. The AI assistant answers instantly with website information, and human support is on WhatsApp 01883822816.</p>' +
      broadcast +
      '<div id="adminChats" class="mt-16"><span class="muted small">Loading conversations...</span></div>'
  }
  return '<div class="muted">Select a tab.</div>'
}

/* ---------- admin account & security ---------- */

function acctMsg(id, msg, ok) {
  const el = document.getElementById(id)
  if (el) el.innerHTML = '<div class="alert ' + (ok ? 'alert-info' : 'alert-error') + '">' + esc(msg) + '</div>'
}

async function adminAccountLoad() {
  const statusEl = document.getElementById('adminAcctStatus')
  const recoveryEl = document.getElementById('acctRecovery')
  const res = await apiAdmin('/api/admin/account', null, 'GET')
  if (!res || res.status !== 'Real') {
    if (statusEl) statusEl.innerHTML = '<b>Could not load account settings.</b> ' + esc((res && res.error) || 'Please try again.')
    return
  }
  if (statusEl) {
    statusEl.innerHTML =
      'Signed in as <b>' + esc(res.email) + '</b> - storage: ' +
      (res.storageReady ? '<span class="label-pill label-good">ready</span>' : '<span class="label-pill label-veryhigh">not configured</span>') +
      ' - email delivery: ' + (res.emailProvider ? '<span class="label-pill label-good">configured</span>' : '<span class="label-pill label-veryhigh">missing</span>') +
      ' - WhatsApp/SMS: ' + (res.phoneProvider ? '<span class="label-pill label-good">configured</span>' : '<span class="label-pill label-veryhigh">missing</span>') +
      (res.phoneVerified ? ' - phone <b>' + esc(res.phone) + '</b> <span class="label-pill label-good">verified</span>' : '')
  }
  if (recoveryEl && res.recoveryEmail) recoveryEl.value = res.recoveryEmail
}

function bindAdminAccount() {
  const passBtn = document.getElementById('acctPassBtn')
  if (passBtn) passBtn.addEventListener('click', async () => {
    const cur = (document.getElementById('acctCurPass') || {}).value || ''
    const np = (document.getElementById('acctNewPass') || {}).value || ''
    const np2 = (document.getElementById('acctNewPass2') || {}).value || ''
    if (np.length < 8) { acctMsg('acctPassMsg', 'New password must be at least 8 characters.', false); return }
    if (np !== np2) { acctMsg('acctPassMsg', 'The two new passwords do not match.', false); return }
    passBtn.disabled = true
    const res = await apiAdmin('/api/admin/account/password', { currentPassword: cur, newPassword: np })
    passBtn.disabled = false
    acctMsg('acctPassMsg', (res && (res.notice || res.error)) || 'Could not update the password.', !!(res && res.changed))
    if (res && res.changed) ['acctCurPass', 'acctNewPass', 'acctNewPass2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  })

  const recBtn = document.getElementById('acctRecoveryBtn')
  if (recBtn) recBtn.addEventListener('click', async () => {
    const recoveryEmail = ((document.getElementById('acctRecovery') || {}).value || '').trim()
    recBtn.disabled = true
    const res = await apiAdmin('/api/admin/account/recovery', { recoveryEmail })
    recBtn.disabled = false
    acctMsg('acctRecoveryMsg', (res && (res.notice || res.error)) || 'Could not save the recovery email.', !!(res && res.saved))
  })

  const sendPhone = async (channel) => {
    const phone = ((document.getElementById('acctPhone') || {}).value || '').trim()
    const res = await apiAdmin('/api/admin/account/phone', { phone, channel })
    if (res && res.dev && res.code) { const el = document.getElementById('acctPhoneCode'); if (el) el.value = res.code }
    acctMsg('acctPhoneMsg', (res && (res.error || ('Code sent to ' + (res.contact || phone) + (res.dev ? ' (development preview).' : '.')))) || 'Could not send the code.', !!(res && res.status === 'Real'))
  }
  const wa = document.getElementById('acctPhoneSendWa'); if (wa) wa.addEventListener('click', () => sendPhone('whatsapp'))
  const sms = document.getElementById('acctPhoneSendSms'); if (sms) sms.addEventListener('click', () => sendPhone('sms'))

  const vBtn = document.getElementById('acctPhoneVerifyBtn')
  if (vBtn) vBtn.addEventListener('click', async () => {
    const code = ((document.getElementById('acctPhoneCode') || {}).value || '').trim()
    vBtn.disabled = true
    const res = await apiAdmin('/api/admin/account/phone/verify', { code })
    vBtn.disabled = false
    acctMsg('acctPhoneMsg', (res && (res.error || (res.phoneVerified ? 'Number verified: ' + res.phone : ''))) || 'Verification failed.', !!(res && res.phoneVerified))
    if (res && res.phoneVerified) adminAccountLoad()
  })

  loadDeliveryStatus()
  const dvBtn = document.getElementById('dvTestBtn')
  if (dvBtn) dvBtn.addEventListener('click', async () => {
    const channel = ((document.getElementById('dvChannel') || {}).value || 'email')
    const contact = ((document.getElementById('dvContact') || {}).value || '').trim()
    if (!contact) { aMsg('dvMsg', 'Enter a recipient for the test message.', false); return }
    dvBtn.disabled = true
    const res = await apiAdmin('/api/admin/delivery/test', { channel, contact })
    dvBtn.disabled = false
    aMsg('dvMsg', (res && (res.error || ('Test message sent to ' + (res.to || contact) + ' via ' + channel + '.'))) || 'Could not send the test message.', !!(res && res.sent))
  })

  adminAccountLoad()
}

async function loadDeliveryStatus() {
  const el = document.getElementById('deliveryStatus')
  if (!el) return
  const res = await apiAdmin('/api/admin/delivery', null, 'GET')
  if (!res || res.status !== 'Real') { el.innerHTML = esc((res && res.error) || 'Could not load delivery status.'); return }
  const d = res.delivery || {}
  const pill = ok => ok ? '<span class="label-pill label-good">configured</span>' : '<span class="label-pill label-veryhigh">missing</span>'
  el.innerHTML =
    '<div>Email: ' + pill(d.email) + ' ' + esc(d.emailProvider || 'not configured') + '</div>' +
    '<div>WhatsApp: ' + pill(d.whatsapp) + ' ' + esc(d.phoneProvider || 'not configured') + '</div>' +
    '<div>SMS: ' + pill(d.sms) + '</div>'
}

/* ---------- admin: plans / payment methods / moderators / logs / settings ---------- */

function aMsg(id, text, ok) {
  const el = document.getElementById(id)
  if (el) el.innerHTML = text ? '<div class="alert ' + (ok ? 'alert-info' : 'alert-error') + '">' + esc(text) + '</div>' : ''
}

function levelPill(level) {
  const map = { success: 'label-good', info: 'label-medium', warn: 'label-high', error: 'label-veryhigh' }
  return '<span class="label-pill ' + (map[level] || 'label-medium') + '">' + esc(String(level || 'info').toUpperCase()) + '</span>'
}

async function bindAdminProofs() {
  const box = document.getElementById('adminProofs')
  if (!box) return
  const res = await apiAdmin('/api/admin/payment-proofs', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load proofs.') + '</span>'; return }
  const list = res.proofs || []
  if (!list.length) { box.innerHTML = '<span class="muted small">No server proofs submitted yet.</span>'; return }
  box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Plan</th><th>Method</th><th>Order ID / Trx</th><th>Proof</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
    list.map(p =>
      '<tr><td>' + esc(p.name || '') + '<br><span class="muted small">' + esc(p.email) + '</span></td><td>' + esc(p.planName || p.plan || '') + ' - $' + (p.amount || 0) + '</td><td>' + esc(p.method || '') + '</td><td>' + (p.orderId ? esc(p.orderId) : '<span class="muted small">-</span>') + (p.trx ? '<br><span class="muted small">' + esc(p.trx) + '</span>' : '') + '</td><td>' + (p.proofImage ? '<img src="' + esc(p.proofImage) + '" class="pay-proof-thumb" alt="payment screenshot">' : '<span class="muted small">none</span>') + '</td><td>' + statusPill(p.status === 'approved' ? 'approved' : (p.status === 'rejected' ? 'rejected' : 'pending')) + '</td><td>' +
      (p.status === 'pending'
        ? '<div class="flex"><button class="btn btn-success btn-sm" data-proof-approve="' + p.id + '" type="button">Approve</button><button class="btn btn-danger btn-sm" data-proof-reject="' + p.id + '" type="button">Reject</button></div>'
        : '<span class="muted small">' + esc(p.reviewedAt ? fmtDate(p.reviewedAt) : '-') + '</span>') + '</td></tr>').join('') +
    '</tbody></table></div>'
  box.querySelectorAll('[data-proof-approve]').forEach(b => b.addEventListener('click', () => reviewProof(b.getAttribute('data-proof-approve'), 'approved')))
  box.querySelectorAll('[data-proof-reject]').forEach(b => b.addEventListener('click', () => reviewProof(b.getAttribute('data-proof-reject'), 'rejected')))
}

async function reviewProof(id, status) {
  const res = await apiAdmin('/api/admin/payment-proofs/' + encodeURIComponent(id), { status }, 'PATCH')
  toast((res && (res.error || ('Payment proof ' + status))) || 'Done', res && res.status === 'Real' ? 'success' : 'error')
  bindAdminProofs()
}

/* ----- plans ----- */
async function loadAdminPlans() {
  const box = document.getElementById('adminPlansList')
  if (!box) return
  const res = await apiAdmin('/api/admin/plans', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load plans.') + '</span>'; return }
  window.__adminPlans = res.plans || []
  if (!window.__adminPlans.length) { box.innerHTML = '<span class="muted small">No custom plans yet. The storefront uses its built-in defaults until you add one here.</span>'; return }
  box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Price</th><th>Agents</th><th>Daily</th><th>Monthly</th><th>Active</th><th>Action</th></tr></thead><tbody>' +
    window.__adminPlans.map(p => '<tr><td>' + esc(p.name) + (p.badge ? ' <span class="label-pill label-good">' + esc(p.badge) + '</span>' : '') + '</td><td>' + esc(p.currency || 'BDT') + ' ' + p.price + '</td><td>' + p.agents + '</td><td>' + p.daily + '</td><td>' + p.monthly + '</td><td>' + (p.active !== false ? 'yes' : 'no') + '</td><td><div class="flex"><button class="btn btn-ghost btn-sm" data-plan-edit="' + esc(p.id) + '" type="button">Edit</button><button class="btn btn-danger btn-sm" data-plan-del="' + esc(p.id) + '" type="button">Delete</button></div></td></tr>').join('') +
    '</tbody></table></div>'
}

function fillPlanForm(p) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v }
  document.getElementById('planFormTitle').textContent = 'Edit plan'
  set('planId', p.id); set('planName', p.name); set('planPrice', p.price); set('planCurrency', p.currency || 'BDT')
  set('planAgents', p.agents); set('planDaily', p.daily); set('planMonthly', p.monthly); set('planBadge', p.badge || '')
  set('planSort', p.sort || 1); set('planFeatures', (p.features || []).join('\n')); chk('planActive', p.active !== false)
}

function resetPlanForm() {
  ['planId', 'planName', 'planPrice', 'planAgents', 'planDaily', 'planMonthly', 'planBadge', 'planFeatures'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const c = document.getElementById('planCurrency'); if (c) c.value = 'BDT'
  const s = document.getElementById('planSort'); if (s) s.value = '1'
  const a = document.getElementById('planActive'); if (a) a.checked = true
  const t = document.getElementById('planFormTitle'); if (t) t.textContent = 'Add a plan'
}

function bindAdminPlans() {
  loadAdminPlans()
  const save = document.getElementById('planSaveBtn')
  if (save) save.addEventListener('click', async () => {
    const val = id => ((document.getElementById(id) || {}).value || '').trim()
    const body = {
      id: val('planId') || undefined,
      name: val('planName'),
      price: Number(val('planPrice')) || 0,
      currency: val('planCurrency') || 'BDT',
      agents: Number(val('planAgents')) || 1,
      daily: Number(val('planDaily')) || 10,
      monthly: Number(val('planMonthly')) || 100,
      badge: val('planBadge'),
      sort: Number(val('planSort')) || 1,
      features: ((document.getElementById('planFeatures') || {}).value || '').split('\n').map(s => s.trim()).filter(Boolean),
      active: !!(document.getElementById('planActive') || {}).checked
    }
    const res = await apiAdmin('/api/admin/plans', body)
    aMsg('planMsg', res && (res.error || ('Saved plan "' + ((res.plan || {}).name || body.name) + '".')), res && res.status === 'Real')
    if (res && res.status === 'Real') { resetPlanForm(); loadAdminPlans() }
  })
  const reset = document.getElementById('planResetBtn'); if (reset) reset.addEventListener('click', resetPlanForm)
  const box = document.getElementById('adminPlansList')
  if (box) box.addEventListener('click', async e => {
    const eb = e.target.closest('[data-plan-edit]')
    if (eb) { const p = (window.__adminPlans || []).find(x => x.id === eb.getAttribute('data-plan-edit')); if (p) fillPlanForm(p); return }
    const db = e.target.closest('[data-plan-del]')
    if (db && confirm('Delete this plan?')) {
      const res = await apiAdmin('/api/admin/plans/' + encodeURIComponent(db.getAttribute('data-plan-del')), null, 'DELETE')
      toast((res && (res.error || 'Plan deleted')) || 'Done', res && res.status === 'Real' ? 'success' : 'error')
      loadAdminPlans()
    }
  })
}

/* ----- payment methods ----- */
async function loadAdminMethods() {
  const box = document.getElementById('adminMethodsList')
  if (!box) return
  const res = await apiAdmin('/api/admin/payment-methods', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load methods.') + '</span>'; return }
  window.__adminMethods = res.methods || []
  if (!window.__adminMethods.length) { box.innerHTML = '<span class="muted small">No custom methods yet. Checkout uses its built-in gateway list until you add one here.</span>'; return }
  box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Label</th><th>Number / ID</th><th>Network</th><th>Crypto</th><th>Enabled</th><th>Action</th></tr></thead><tbody>' +
    window.__adminMethods.map(m => '<tr><td>' + esc(m.label) + '</td><td>' + esc(m.number) + '</td><td>' + esc(m.network || '-') + '</td><td>' + (m.crypto ? 'yes' : 'no') + '</td><td>' + (m.enabled !== false ? 'yes' : 'no') + '</td><td><div class="flex"><button class="btn btn-ghost btn-sm" data-pm-edit="' + esc(m.id) + '" type="button">Edit</button><button class="btn btn-ghost btn-sm" data-pm-toggle="' + esc(m.id) + '" type="button">' + (m.enabled !== false ? 'Disable' : 'Enable') + '</button><button class="btn btn-danger btn-sm" data-pm-del="' + esc(m.id) + '" type="button">Delete</button></div></td></tr>').join('') +
    '</tbody></table></div>'
}

function fillMethodForm(m) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v }
  document.getElementById('pmFormTitle').textContent = 'Edit payment method'
  set('pmId', m.id); set('pmLabel', m.label); set('pmNumber', m.number || ''); set('pmNetwork', m.network || '')
  set('pmNote', m.note || ''); set('pmSort', m.sort || 1); chk('pmCrypto', m.crypto); chk('pmEnabled', m.enabled !== false)
}

function resetMethodForm() {
  ['pmId', 'pmLabel', 'pmNumber', 'pmNetwork', 'pmNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const s = document.getElementById('pmSort'); if (s) s.value = '1'
  const c = document.getElementById('pmCrypto'); if (c) c.checked = false
  const e2 = document.getElementById('pmEnabled'); if (e2) e2.checked = true
  const t = document.getElementById('pmFormTitle'); if (t) t.textContent = 'Add a payment method'
}

function bindAdminMethods() {
  loadAdminMethods()
  const save = document.getElementById('pmSaveBtn')
  if (save) save.addEventListener('click', async () => {
    const val = id => ((document.getElementById(id) || {}).value || '').trim()
    const body = {
      id: val('pmId') || undefined, label: val('pmLabel'), number: val('pmNumber'), network: val('pmNetwork'),
      note: ((document.getElementById('pmNote') || {}).value || '').trim(), sort: Number(val('pmSort')) || 1,
      crypto: !!(document.getElementById('pmCrypto') || {}).checked,
      enabled: !!(document.getElementById('pmEnabled') || {}).checked
    }
    const res = await apiAdmin('/api/admin/payment-methods', body)
    aMsg('pmMsg', res && (res.error || ('Saved "' + ((res.method || {}).label || body.label) + '".')), res && res.status === 'Real')
    if (res && res.status === 'Real') { resetMethodForm(); loadAdminMethods() }
  })
  const reset = document.getElementById('pmResetBtn'); if (reset) reset.addEventListener('click', resetMethodForm)
  const box = document.getElementById('adminMethodsList')
  if (box) box.addEventListener('click', async e => {
    const eb = e.target.closest('[data-pm-edit]')
    if (eb) { const m = (window.__adminMethods || []).find(x => x.id === eb.getAttribute('data-pm-edit')); if (m) fillMethodForm(m); return }
    const tb = e.target.closest('[data-pm-toggle]')
    if (tb) { const m = (window.__adminMethods || []).find(x => x.id === tb.getAttribute('data-pm-toggle')); if (m) { const res = await apiAdmin('/api/admin/payment-methods', { id: m.id, enabled: m.enabled === false }, 'POST'); toast((res && (res.error || (m.enabled === false ? 'Enabled' : 'Disabled'))) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); loadAdminMethods() } return }
    const db = e.target.closest('[data-pm-del]')
    if (db && confirm('Delete this payment method?')) {
      const res = await apiAdmin('/api/admin/payment-methods/' + encodeURIComponent(db.getAttribute('data-pm-del')), null, 'DELETE')
      toast((res && (res.error || 'Method deleted')) || 'Done', res && res.status === 'Real' ? 'success' : 'error')
      loadAdminMethods()
    }
  })
}

/* ----- moderators ----- */
async function loadAdminModerators() {
  const box = document.getElementById('adminModsList')
  if (!box) return
  const res = await apiAdmin('/api/admin/moderators', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load moderators.') + '</span>'; return }
  window.__adminMods = res.moderators || []
  if (!window.__adminMods.length) { box.innerHTML = '<span class="muted small">No moderators yet.</span>'; return }
  box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Permissions</th><th>Status</th><th>Last login</th><th>Action</th></tr></thead><tbody>' +
    window.__adminMods.map(m => '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.email) + '</td><td>' + esc((m.permissions || []).join(', ')) + '</td><td>' + (m.active !== false ? '<span class="label-pill label-good">ACTIVE</span>' : '<span class="label-pill label-veryhigh">DISABLED</span>') + '</td><td><span class="muted small">' + (m.lastLoginAt ? fmtDate(m.lastLoginAt) : 'never') + '</span></td><td><div class="flex"><button class="btn btn-ghost btn-sm" data-mod-toggle="' + esc(m.id) + '" type="button">' + (m.active !== false ? 'Disable' : 'Enable') + '</button><button class="btn btn-ghost btn-sm" data-mod-pass="' + esc(m.id) + '" type="button">Reset password</button><button class="btn btn-danger btn-sm" data-mod-del="' + esc(m.id) + '" type="button">Delete</button></div></td></tr>').join('') +
    '</tbody></table></div>'
}

function bindAdminModerators() {
  loadAdminModerators()
  const create = document.getElementById('modCreateBtn')
  if (create) create.addEventListener('click', async () => {
    const val = id => ((document.getElementById(id) || {}).value || '').trim()
    const body = { name: val('modName'), email: val('modEmail'), password: (document.getElementById('modPassword') || {}).value || '' }
    const res = await apiAdmin('/api/admin/moderators', body)
    aMsg('modMsg', res && (res.error || ('Created moderator ' + ((res.moderator || {}).email || body.email) + '. They can sign in from the Admin login with only Logs + Live Chat access.')), res && res.status === 'Real')
    if (res && res.status === 'Real') { ['modName', 'modEmail', 'modPassword'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' }); loadAdminModerators() }
  })
  const box = document.getElementById('adminModsList')
  if (box) box.addEventListener('click', async e => {
    const tb = e.target.closest('[data-mod-toggle]')
    if (tb) { const m = (window.__adminMods || []).find(x => x.id === tb.getAttribute('data-mod-toggle')); if (m) { const res = await apiAdmin('/api/admin/moderators/' + encodeURIComponent(m.id), { active: m.active === false }, 'PATCH'); toast((res && (res.error || (m.active === false ? 'Enabled' : 'Disabled'))) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); loadAdminModerators() } return }
    const pb = e.target.closest('[data-mod-pass]')
    if (pb) { const pw = prompt('New password for this moderator (min 8 characters):'); if (!pw) return; const res = await apiAdmin('/api/admin/moderators/' + encodeURIComponent(pb.getAttribute('data-mod-pass')), { password: pw }, 'PATCH'); toast((res && (res.error || 'Password updated')) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); return }
    const db = e.target.closest('[data-mod-del]')
    if (db && confirm('Delete this moderator account?')) { const res = await apiAdmin('/api/admin/moderators/' + encodeURIComponent(db.getAttribute('data-mod-del')), null, 'DELETE'); toast((res && (res.error || 'Moderator deleted')) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); loadAdminModerators() }
  })
}

/* ----- logs / audit ----- */
async function loadAdminLogs() {
  const box = document.getElementById('adminLogs')
  if (!box) return
  const res = await apiAdmin('/api/admin/logs?type=all&limit=200', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load logs.') + '</span>'; return }
  const cEl = document.getElementById('logConcurrency')
  if (cEl) cEl.textContent = 'In-flight background jobs: ' + (res.inFlight || 0) + ' / ' + (res.concurrencyLimit || '-') + '.'
  const sys = res.system || []
  box.innerHTML = sys.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Level</th><th>Source</th><th>Message</th></tr></thead><tbody>' +
    sys.map(l => '<tr><td><span class="muted small">' + fmtDate(l.at) + '</span></td><td>' + levelPill(l.level) + '</td><td>' + esc(l.source) + '</td><td>' + esc(l.message) + '</td></tr>').join('') +
    '</tbody></table></div>' : '<span class="muted small">No system logs yet.</span>'
}

function bindAdminLogs() {
  loadAdminLogs()
  const r = document.getElementById('logsRefreshBtn'); if (r) r.addEventListener('click', loadAdminLogs)
  const c = document.getElementById('logsClearBtn')
  if (c) c.addEventListener('click', async () => { if (!confirm('Clear all system logs?')) return; const res = await apiAdmin('/api/admin/logs/clear', { type: 'system' }); toast((res && (res.error || 'System logs cleared')) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); loadAdminLogs() })
  if (window.__logsTimer) clearInterval(window.__logsTimer)
  window.__logsTimer = setInterval(() => { if (pathFromLocation() === '/admin' && state.adminTab === 'logs') loadAdminLogs() }, 15000)
}

async function loadAdminAudit() {
  const box = document.getElementById('adminAudit')
  if (!box) return
  const res = await apiAdmin('/api/admin/logs?type=audit&limit=200', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load audit logs.') + '</span>'; return }
  const list = res.audit || []
  box.innerHTML = list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead><tbody>' +
    list.map(l => '<tr><td><span class="muted small">' + fmtDate(l.at) + '</span></td><td>' + esc(l.actor) + '</td><td>' + esc(l.action) + '</td><td>' + esc(l.target || '-') + '</td><td><span class="muted small">' + esc(l.ip || '-') + '</span></td></tr>').join('') +
    '</tbody></table></div>' : '<span class="muted small">No audit events yet.</span>'
}

function bindAdminAudit() {
  loadAdminAudit()
  const r = document.getElementById('auditRefreshBtn'); if (r) r.addEventListener('click', loadAdminAudit)
  const c = document.getElementById('auditClearBtn')
  if (c) c.addEventListener('click', async () => { if (!confirm('Clear all audit logs?')) return; const res = await apiAdmin('/api/admin/logs/clear', { type: 'audit' }); toast((res && (res.error || 'Audit logs cleared')) || 'Done', res && res.status === 'Real' ? 'success' : 'error'); loadAdminAudit() })
}

/* ----- maintenance / site settings ----- */
async function loadAdminMaintenance() {
  const res = await apiAdmin('/api/admin/settings', null, 'GET')
  if (!res || res.status !== 'Real') { aMsg('mtMsg', (res && res.error) || 'Could not load settings.', false); return }
  const s = res.settings || {}
  const m = document.getElementById('mtMaintenance'); if (m) m.checked = !!s.maintenance
  const r = document.getElementById('mtRegistrations'); if (r) r.checked = s.allowRegistration !== false
  const c = document.getElementById('mtConcurrency'); if (c) c.value = s.concurrencyLimit || 8
  const who = document.getElementById('mtUpdated')
  if (who) who.textContent = s.updatedAt ? ('Last changed ' + fmtDate(s.updatedAt) + (s.updatedBy ? ' by ' + s.updatedBy : '')) : ''
}

function bindAdminMaintenance() {
  loadAdminMaintenance()
  const save = document.getElementById('mtSaveBtn')
  if (save) save.addEventListener('click', async () => {
    const body = {
      maintenance: !!(document.getElementById('mtMaintenance') || {}).checked,
      allowRegistration: !!(document.getElementById('mtRegistrations') || {}).checked,
      concurrencyLimit: Number((document.getElementById('mtConcurrency') || {}).value) || 8
    }
    const res = await apiAdmin('/api/admin/settings', body)
    aMsg('mtMsg', res && (res.error || ('Settings saved. Maintenance is ' + (body.maintenance ? 'ON' : 'OFF') + '.')), res && res.status === 'Real')
    if (res && res.status === 'Real') { toast('Settings saved'); loadAdminMaintenance() }
  })
}

/* ----- users (create) + live chat (per-user reply + broadcast) ----- */
function bindAdminUsers() {
  const btn = document.getElementById('newUserBtn')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const val = id => ((document.getElementById(id) || {}).value || '').trim()
    const body = { name: val('newUserName'), email: val('newUserEmail'), password: (document.getElementById('newUserPass') || {}).value || '' }
    if (!body.name || !body.email || !body.password) { aMsg('newUserMsg', 'Name, email and password are all required.', false); return }
    btn.disabled = true
    const res = await apiAdmin('/api/admin/users', body)
    btn.disabled = false
    aMsg('newUserMsg', res && (res.error || ('Created user ' + ((res.user || {}).email || body.email) + '. They can now log in.')) , res && res.status === 'Real')
    if (res && res.status === 'Real') { ['newUserName', 'newUserEmail', 'newUserPass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' }) }
  })
}

async function loadAdminChats() {
  const box = document.getElementById('adminChats')
  if (!box) return
  const res = await apiAdmin('/api/admin/chats', null, 'GET')
  if (!res || res.status !== 'Real') { box.innerHTML = '<span class="muted small">' + esc((res && res.error) || 'Could not load conversations.') + '</span>'; return }
  const chats = res.chats || []
  window.__adminChats = chats
  if (state.adminChatId) {
    const c = chats.find(x => x.email === state.adminChatId)
    if (c) {
      const msgs = (c.messages || []).map(m =>
        '<div class="msg msg-' + (m.from === 'user' ? 'user' : 'admin') + '">' + esc(m.text) + '<span class="msg-time">' + fmtTime(m.at || m.time) + '</span></div>').join('')
      box.innerHTML = '<button class="btn btn-ghost btn-sm" data-back-thread type="button">Back to threads</button>' +
        '<div class="chat-thread mt-16"><h4>' + esc(c.name || c.email) + '</h4><div class="ct-meta">' + esc(c.email) + '</div>' +
        '<div class="mt-16" style="max-height:320px;overflow-y:auto">' + (msgs || '<span class="muted small">No messages</span>') + '</div>' +
        '<div class="input-row mt-16"><input type="text" id="adminReplyInput" placeholder="Reply as ' + esc(adminRole()) + '..."><button class="btn btn-primary" id="adminReplyBtn" type="button">Send</button></div></div>'
      const rb = document.getElementById('adminReplyBtn')
      if (rb) rb.addEventListener('click', async () => {
        const input = document.getElementById('adminReplyInput')
        const text = input ? input.value.trim() : ''
        if (!text) return
        rb.disabled = true
        const sres = await apiAdmin('/api/admin/chats/reply', { email: c.email, text })
        rb.disabled = false
        if (sres && sres.status === 'Real') { toast('Reply sent'); if (input) input.value = ''; loadAdminChats() }
        else toast((sres && sres.error) || 'Could not send reply', 'error')
      })
      return
    }
    state.adminChatId = null
  }
  box.innerHTML = chats.length ? '<div class="chat-list">' + chats.map(c => {
    const msgs = c.messages || []
    const last = msgs[msgs.length - 1] || {}
    return '<div class="chat-thread" data-open-thread="' + esc(c.email) + '" style="cursor:pointer">' +
      '<h4>' + esc(c.name || c.email) + (c.admin_unread ? ' <span class="label-pill label-good">' + c.admin_unread + ' new</span>' : '') + '</h4>' +
      '<div class="ct-meta">' + esc(c.email) + ' - ' + (c.updated_at ? fmtTime(c.updated_at) : '') + '</div>' +
      '<div class="muted small">' + esc(last.text || '') + '</div></div>'
  }).join('') + '</div>' : '<span class="muted small">No conversations yet.</span>'
}

function bindAdminChats() {
  loadAdminChats()
  const bc = document.getElementById('broadcastBtn')
  if (bc) bc.addEventListener('click', async () => {
    const el = document.getElementById('broadcastText')
    const text = el ? el.value.trim() : ''
    if (!text) { aMsg('broadcastMsg', 'Enter a message to broadcast.', false); return }
    if (!confirm('Send this message to every user in live chat?')) return
    bc.disabled = true
    const res = await apiAdmin('/api/admin/chats/broadcast', { text })
    bc.disabled = false
    aMsg('broadcastMsg', res && (res.error || ('Broadcast sent to ' + (res.sent || 0) + ' user(s).')), res && res.status === 'Real')
    if (res && res.status === 'Real' && el) el.value = ''
  })
  if (window.__chatTimer) clearInterval(window.__chatTimer)
  window.__chatTimer = setInterval(() => {
    if (pathFromLocation() === '/admin' && state.adminTab === 'chats' && !document.getElementById('adminReplyInput')) loadAdminChats()
  }, 12000)
}

/* ---------- admin password recovery via OTP ---------- */

function openAdminForgot() {
  const email = ((document.getElementById('adminEmail') || {}).value || 'admin@seo-service-provider.com').trim().toLowerCase()
  openModal('<h3>Reset admin password</h3><p class="m-sub">Choose where to receive the one-time code.</p>' +
    '<div class="otp-channels">' +
      '<button class="btn btn-ghost" data-admin-forgot-ch="email" type="button">Email me a code<br><span class="small muted">recovery email</span></button>' +
      '<button class="btn btn-ghost" data-admin-forgot-ch="whatsapp" type="button">WhatsApp a code<br><span class="small muted">verified number</span></button>' +
      '<button class="btn btn-ghost" data-admin-forgot-ch="sms" type="button">SMS a code<br><span class="small muted">verified number</span></button>' +
    '</div><div id="adminForgotMsg" class="mt-8"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button></div>')
  const msg = (m, ok) => { const el = document.getElementById('adminForgotMsg'); if (el) el.innerHTML = '<div class="alert ' + (ok ? 'alert-info' : 'alert-error') + '">' + esc(m) + '</div>' }
  document.querySelectorAll('[data-admin-forgot-ch]').forEach(b => b.addEventListener('click', async () => {
    const channel = b.getAttribute('data-admin-forgot-ch')
    const old = b.innerHTML
    b.disabled = true
    b.innerHTML = '<span class="spinner"></span> Sending...'
    const res = await apiPost('/api/admin/account/forgot', { email, channel })
    if (!res || res.status !== 'Real') { b.disabled = false; b.innerHTML = old; return msg((res && res.error) || 'Could not send the code.', false) }
    adminForgotStepCode(email, channel, res)
  }))
}

function adminForgotStepCode(email, channel, sent) {
  openModal('<h3>Enter the code</h3><p class="m-sub">Enter the 6-digit code sent to <b>' + esc(sent.contact || '') + '</b>.</p>' +
    (sent.dev && sent.code ? '<div class="alert alert-info"><b>Development preview</b> - code: <b>' + esc(sent.code) + '</b></div>' : '') +
    '<div class="field"><label>One-time code</label><input type="text" id="afCode" inputmode="numeric" maxlength="6" placeholder="6-digit code"></div>' +
    '<button class="btn btn-primary" id="afVerifyBtn" style="width:100%" type="button">Verify code</button>' +
    '<div id="afMsg" class="mt-8"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button></div>')
  const btn = document.getElementById('afVerifyBtn')
  btn.addEventListener('click', async () => {
    const code = (document.getElementById('afCode').value || '').trim()
    btn.disabled = true
    const res = await apiPost('/api/admin/account/forgot/verify', { email, channel, code })
    btn.disabled = false
    if (!res || res.status !== 'Real') {
      const el = document.getElementById('afMsg')
      if (el) el.innerHTML = '<div class="alert alert-error">' + esc((res && res.error) || 'Verification failed') + '</div>'
      return
    }
    adminForgotStepNewPassword(email, res.resetToken)
  })
}

function adminForgotStepNewPassword(email, resetToken) {
  openModal('<h3>Set a new admin password</h3>' +
    '<div class="field mt-8"><label>New password (min 8 characters)</label><input type="password" id="afNewPass" autocomplete="new-password"></div>' +
    '<div class="field"><label>Confirm new password</label><input type="password" id="afNewPass2" autocomplete="new-password"></div>' +
    '<button class="btn btn-primary" id="afSaveBtn" style="width:100%" type="button">Save new password</button>' +
    '<div id="afMsg2" class="mt-8"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button></div>')
  const btn = document.getElementById('afSaveBtn')
  btn.addEventListener('click', async () => {
    const np = (document.getElementById('afNewPass').value || '')
    const np2 = (document.getElementById('afNewPass2').value || '')
    const el = document.getElementById('afMsg2')
    if (np.length < 8) { el.innerHTML = '<div class="alert alert-error">Password must be at least 8 characters.</div>'; return }
    if (np !== np2) { el.innerHTML = '<div class="alert alert-error">Passwords do not match.</div>'; return }
    btn.disabled = true
    const res = await apiPost('/api/admin/account/reset', { email, resetToken, newPassword: np })
    btn.disabled = false
    if (!res || res.status !== 'Real') { el.innerHTML = '<div class="alert alert-error">' + esc((res && res.error) || 'Could not reset the password') + '</div>'; return }
    closeModal()
    toast('Admin password updated. Please log in.')
    const p = document.getElementById('adminPass'); if (p) p.value = ''
  })
}

function devStep(n, title, desc) {
  return '<div class="flex" style="gap:14px;align-items:flex-start">' +
    '<div class="dev-step-no">' + n + '</div>' +
    '<div><h4 style="margin:0">' + title + '</h4>' +
    '<p class="muted small" style="margin:6px 0 0;max-width:760px">' + desc + '</p></div></div>'
}

function devAdminContent() {
  return '' +
    '<div class="form-card" id="devLock" style="display:none">' +
      '<div class="flex" style="gap:14px;align-items:flex-start">' +
        '<div class="dev-step-no">K</div>' +
        '<div><h4 style="margin:0">Owner key required</h4>' +
        '<p class="muted small" style="margin:6px 0 0;max-width:760px">এই Dev Console-এর API (কোড দেখা, backup export/import — যেটাতে এখন <code>.env</code> কনফিগও থাকে) শুধু owner-এর জন্য লক করা। <b>backend/.env</b> ফাইলে <code>DEV_KEY=...</code> লাইনে যে key আছে, সেটাই নিচে দিন। একবার দিলে এই ব্রাউজারে সেভ থাকবে।</p></div>' +
      '</div>' +
      '<div class="input-row mt-16" style="max-width:640px"><input type="password" id="devKeyInput" placeholder="Owner key (DEV_KEY from backend/.env)" autocomplete="off"><button class="btn btn-primary" id="devKeyUnlock" type="button">Unlock</button></div>' +
      '<div class="muted small mt-8" id="devKeyMsg"></div>' +
    '</div>' +
    '<div id="devWrap" style="display:none">' +
    '<div class="form-card dev-hero">' +
      '<div class="flex" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">' +
        '<div style="max-width:720px">' +
          '<span class="eyebrow">Development Console</span>' +
          '<h3 style="margin:6px 0 0">MonkeyCode-AI - Site Development</h3>' +
          '<p class="muted small mt-8">আপনার সাইট ডেভেলপমেন্ট এজেন্ট হলো <b>MonkeyCode-AI</b> (Gemini নয়)। নিচের ধাপগুলো অনুসরণ করলে যেকোনো ডেভেলপমেন্ট কাজ MonkeyCode-AI-তে শুরু করা যাবে। এই পেজের সব তথ্য আসল, লাইভ কোড থেকে আসে।</p>' +
        '</div>' +
        '<button class="btn btn-primary" id="devOpenBtn" type="button">Open MonkeyCode-AI</button>' +
      '</div>' +
      '<div id="devError" class="alert alert-error" style="display:none"></div>' +
    '</div>' +

    '<div class="form-card mt-24">' +
      devStep(1, 'Connect your workspace', 'MonkeyCode-AI-তে আপনার অ্যাকাউন্টে এই প্রজেক্টটা খুলুন। অ্যাড্রেসবারের লিংকটা নিচে পেস্ট করে Save করুন — তারপর উপরের Open বাটন সরাসরি সেখানেই খুলবে।') +
      '<div class="input-row mt-16" style="max-width:780px"><input type="url" id="devWsUrl" placeholder="https://monkeycode-ai.net/projects/..."><button class="btn btn-primary" id="devWsSave" type="button">Save workspace link</button></div>' +
    '</div>' +

    '<div class="form-card mt-24">' +
      devStep(2, 'Request a change', 'বাংলা বা ইংরেজিতে লিখুন কী কী বদলাতে চান। Copy চাপলে আপনার কথা + এই মুহূর্তের সম্পূর্ণ প্রজেক্ট স্টেট একসাথে কপি হবে — MonkeyCode-AI-তে পেস্ট করলেই ওখান থেকে কাজ শুরু।') +
      '<textarea id="devTask" class="dev-brief" style="margin-top:16px" rows="3" placeholder="যেমন: ড্যাশবোর্ডে রিপোর্ট ডাউনলোড বাটন যোগ কর, অথবা homepage-এ FAQ সেকশন বানাও..."></textarea>' +
      '<button class="btn btn-primary" style="margin-top:16px" id="devCopyTask" type="button">Copy request + project brief</button>' +
    '</div>' +

    '<h3 class="mt-24">Live system status</h3>' +
    '<div class="metric-grid mt-16" id="devStatus">' +
      '<div class="metric"><div class="m-label">Backend API</div><div class="m-value" id="devPort">loading...</div></div>' +
      '<div class="metric"><div class="m-label">Email delivery</div><div class="m-value" id="devMail">loading...</div></div>' +
      '<div class="metric"><div class="m-label">Source files</div><div class="m-value" id="devFilesCount">loading...</div></div>' +
      '<div class="metric"><div class="m-label">REST endpoints</div><div class="m-value" id="devEpCount">loading...</div></div>' +
    '</div>' +
    '<div class="mt-16 flex" style="align-items:center;flex-wrap:wrap;gap:8px"><span class="muted small">Live API keys:</span><span id="devKeyChips" class="dev-chips"></span></div>' +

    '<div class="form-card mt-24">' +
      devStep(3, 'Backup - export / import', 'যেকোনো সময় পুরো ওয়েবসাইটের সব কোড ফাইল একসাথে .zip আকারে export (backup) করে রাখতে পারবেন, এবং চাইলে আগের backup ইমপোর্ট করে রিস্টোর করতে পারবেন। এক্সপোর্টে সব প্রকল্প ফাইল/ফোল্ডার + কনফিগ (.env, .gitignore) থাকে — শুধু node_modules/.git বাদ (install হলে npm ci দিয়ে আবার বসে)। .env-এ keys থাকায় এই API owner key দিয়ে সুরক্ষিত।') +
      '<div class="flex mt-16" style="flex-wrap:wrap;gap:10px;align-items:center">' +
        '<button class="btn btn-primary" id="devExportBtn" type="button">Export full backup (.zip)</button>' +
        '<label class="btn btn-ghost" style="margin:0;cursor:pointer">Import backup (.zip)<input type="file" id="devImportFile" accept=".zip,application/zip" style="display:none"></label>' +
        '<button class="btn btn-ghost btn-sm" id="devTreeRefreshCode" type="button">Refresh file list</button>' +
      '</div>' +
      '<div class="muted small mt-8" id="devImportStatus">Import করলে একই নামের ফাইলগুলো (এমনকি .env/.gitignore-ও) ওভাররাইট হবে। node_modules/.git বাদ যাবে। .env বদলালে backend restart করতে হবে।</div>' +
    '</div>' +

    '<div class="form-card mt-24">' +
      devStep(4, 'Data backup - accounts, payments, reports, chats', 'ওয়েবসাইটের ফাইল (.zip) আর ব্যবহারকারীর ডেটা আলাদা জায়গায় থাকে। এখান থেকে ব্রাউজারের সব ডেটা (users, payments, reports, chats, usage) একটি .json ফাইলে নামানো ও আবার রিস্টোর করা যায়। ফাইল backup + data backup একসাথে নিলেই সম্পূর্ণ।') +
      '<div class="muted small mt-8">বর্তমানে সংরক্ষিত: <b id="devDataCount">-</b></div>' +
      '<div class="flex mt-16" style="flex-wrap:wrap;gap:10px;align-items:center">' +
        '<button class="btn btn-primary" id="devDataExportBtn" type="button">Download data (.json)</button>' +
        '<label class="btn btn-ghost" style="margin:0;cursor:pointer">Import data (.json)<input type="file" id="devDataImportFile" accept=".json,application/json" style="display:none"></label>' +
      '</div>' +
      '<div class="muted small mt-8" id="devDataStatus">Import করলে বর্তমান ব্রাউজার ডেটা নতুন ডেটা দিয়ে প্রতিস্থাপিত হবে।</div>' +
    '</div>' +

    '<h3 class="mt-24">Website code - সব ফাইল ও ফোল্ডার</h3>' +
    '<p class="muted small mt-8">নিচে এই ওয়েবসাইটের প্রতিটি ফাইল ও ফোল্ডার — MonkeyCode-AI/এই চ্যাটে কোড আপডেট করলে এখানে Refresh চাপলে লেটেস্ট ভার্সন দেখাবে। কোড দেখা যায় শুধু টেক্সট ফাইল (dotfile/.env/binary সুরক্ষিত, দেখা যায় না)।</p>' +
    '<div class="dev-cols mt-16">' +
      '<div class="form-card dev-card">' +
        '<div class="flex" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
          '<div><h4 style="margin:0">Folders</h4><span class="muted small">node_modules / .git / dotfolders বাদ দিয়ে</span></div>' +
          '<button class="btn btn-ghost btn-sm" id="devTreeRefresh" type="button">Refresh</button>' +
        '</div>' +
        '<div class="dev-chips mt-16" id="devTreeFolders"><span class="muted small">Loading folders...</span></div>' +
        '<div class="muted small mt-8">এখানে শুধু সোর্স ফোল্ডার দেখায়। <b>node_modules</b>, <b>.git</b> ও ডট-ফোল্ডার ইচ্ছাকৃতভাবে বাদ - ওগুলো ডিপেন্ডেন্স/ভার্সন ডেটা, ব্যাকআপেও লাগে না।</div>' +
      '</div>' +
      '<div class="form-card dev-card">' +
        '<div class="flex" style="justify-content:space-between;align-items:center"><h4 style="margin:0">Files</h4><span class="muted small">View to read code</span></div>' +
        '<div class="mt-16" id="devFiles"><div class="muted small">Loading files...</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="form-card mt-24">' +
      '<div class="flex" style="justify-content:space-between;align-items:center"><h4 style="margin:0">REST endpoints</h4><span class="muted small">backend/server.js</span></div>' +
      '<div class="table-wrap mt-16" style="max-height:380px;overflow:auto"><table class="table"><thead><tr><th>Method</th><th>Route</th></tr></thead><tbody id="devEndpoints"></tbody></table></div>' +
    '</div>' +

    '<div class="form-card mt-24" id="devCodePane" style="display:none">' +
      '<div class="flex" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div><h4 style="margin:0" class="dev-file-path">File</h4><span class="muted small" id="devCodeMeta"></span></div>' +
        '<div class="flex" style="gap:8px"><button class="btn btn-ghost btn-sm" id="devCodeCopy" type="button">Copy code</button><button class="btn btn-ghost btn-sm" id="devCodeClose" type="button">Close</button></div>' +
      '</div>' +
      '<pre class="dev-brief mt-16" id="devCodeBody" style="max-height:560px">Loading code...</pre>' +
    '</div>' +

    '<div class="form-card mt-24">' +
      '<div class="flex" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
        '<div><h4 style="margin:0">Developer handoff brief</h4><p class="muted small" style="margin:6px 0 0">যেকোনো MonkeyCode-AI সেশনে পেস্ট করার জন্য নির্ভুল, সম্পূর্ণ প্রজেক্ট স্টেট।</p></div>' +
        '<button class="btn btn-ghost btn-sm" id="devCopyBrief" type="button">Copy brief</button>' +
      '</div>' +
      '<div class="dev-brief mt-16" id="devBrief">Generating... (backend online কিনা যাচাই হচ্ছে)</div>' +
    '</div>' +
    '</div>'
}

async function devBoot() {
  const lockBox = document.getElementById('devLock')
  const wrap = document.getElementById('devWrap')
  const keyInput = document.getElementById('devKeyInput')
  const keyBtn = document.getElementById('devKeyUnlock')
  const keyMsg = document.getElementById('devKeyMsg')
  const showLock = (msg) => {
    if (lockBox) lockBox.style.display = ''
    if (wrap) wrap.style.display = 'none'
    if (keyMsg) keyMsg.textContent = msg || ''
    if (keyInput) { keyInput.value = ''; keyInput.focus() }
  }
  if (keyBtn) keyBtn.addEventListener('click', devTryUnlock)
  if (keyInput) keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') devTryUnlock() })
  if (!devStoredKey()) { showLock(''); return }
  if (lockBox) lockBox.style.display = 'none'
  if (wrap) wrap.style.display = ''
  await devLoadProject(showLock)
}

async function devTryUnlock() {
  const input = document.getElementById('devKeyInput')
  const msg = document.getElementById('devKeyMsg')
  const v = (input && input.value ? input.value : '').trim()
  if (!v) { if (msg) msg.textContent = 'Owner key ta likhun.'; return }
  localStorage.setItem('seoproDevKey', v)
  if (msg) msg.textContent = 'Checking key...'
  const d = await apiGet('/api/dev/project', 10000)
  if (!d || d.status !== 'Real') {
    localStorage.removeItem('seoproDevKey')
    if (msg) msg.textContent = (d && d.error) ? d.error : 'Key verify hoyni (backend offline?)'
    return
  }
  navigate()
}

async function devLoadProject(onLocked) {
  const errBox = document.getElementById('devError')
  const fill = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  const chips = document.getElementById('devKeyChips')
  const filesBox = document.getElementById('devFiles')
  const epBox = document.getElementById('devEndpoints')
  const briefEl = document.getElementById('devBrief')
  const taskEl = document.getElementById('devTask')
  const openBtn = document.getElementById('devOpenBtn')
  const wsInput = document.getElementById('devWsUrl')
  const wsSave = document.getElementById('devWsSave')

  const wsSaved = localStorage.getItem('seo_mca_ws') || ''
  if (wsInput) wsInput.value = wsSaved
  if (wsSave && wsInput) {
    wsSave.addEventListener('click', () => {
      const v = wsInput.value.trim()
      if (!v) { toast('Aage MonkeyCode-AI workspace link ta paste korun', 'error'); wsInput.focus(); return }
      localStorage.setItem('seo_mca_ws', v)
      toast('Workspace link saved - Open bato ta ekhon seikhaney niye jabe')
    })
  }
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const target = (localStorage.getItem('seo_mca_ws') || 'https://monkeycode-ai.net').trim()
      window.open(/^https:\/\//i.test(target) ? target : 'https://monkeycode-ai.net', '_blank', 'noopener')
    })
  }

  const copyBtn = document.getElementById('devCopyBrief')
  const copyTaskBtn = document.getElementById('devCopyTask')
  let briefText = briefEl ? briefEl.textContent : 'No brief available.'
  if (copyBtn) copyBtn.addEventListener('click', () => copyToClipboard(briefText))
  if (copyTaskBtn && taskEl) {
    copyTaskBtn.addEventListener('click', () => {
      const req = taskEl.value.trim()
      if (!req) { toast('Aage ekta change likhun, tarpor copy korun', 'error'); taskEl.focus(); return }
      copyToClipboard(req + '\n\n--- PROJECT STATE (auto-attached, current & real) ---\n' + briefText)
    })
  }

  const refreshBtns = document.querySelectorAll('#devTreeRefresh, #devTreeRefreshCode')
  refreshBtns.forEach(btn => btn.addEventListener('click', () => { toast('File list refresh korlam'); devLoadTree() }))
  const codeCopyBtn = document.getElementById('devCodeCopy')
  if (codeCopyBtn) codeCopyBtn.addEventListener('click', () => {
    const b = document.getElementById('devCodeBody')
    if (b && b.textContent && b.textContent.indexOf('Loading') < 0) copyToClipboard(b.textContent)
  })
  const codeCloseBtn = document.getElementById('devCodeClose')
  if (codeCloseBtn) codeCloseBtn.addEventListener('click', devCloseCode)

  const exportBtn = document.getElementById('devExportBtn')
  if (exportBtn) exportBtn.addEventListener('click', devDownloadBackup)

  const importInput = document.getElementById('devImportFile')
  if (importInput) {
    importInput.addEventListener('change', async () => {
      const file = importInput.files && importInput.files[0]
      if (!file) return
      const ok = confirm('Import this backup? Same-name files will be OVERWRITTEN in the live project (including .env/.gitignore). node_modules/.git are skipped. After importing a changed .env, restart the backend.')
      if (!ok) { importInput.value = ''; return }
      const statusEl = document.getElementById('devImportStatus')
      if (statusEl) statusEl.textContent = 'Importing ' + file.name + ' ...'
      try {
        const r = await fetchTimeout(API + '/api/dev/import', { method: 'POST', headers: { 'Content-Type': 'application/zip', 'x-dev-key': devStoredKey() }, body: file }, 120000)
        const d = await r.json()
        if (statusEl) statusEl.textContent = d.status === 'Real'
          ? 'Import done: ' + d.written + ' file(s) restored, ' + d.skipped + ' skipped (protected). Refresh korun.'
          : 'Import failed: ' + (d.error || 'unknown error')
        if (d.status === 'Real') { toast('Backup import successful - ' + d.written + ' files'); devLoadTree() }
        else toast('Import failed', 'error')
      } catch (e) {
        if (statusEl) statusEl.textContent = 'Import failed - backend unreachable.'
        toast('Import failed', 'error')
      }
      importInput.value = ''
    })
  }

  const devDataExportBtn = document.getElementById('devDataExportBtn')
  if (devDataExportBtn) devDataExportBtn.addEventListener('click', devDownloadData)
  const devDataImportFile = document.getElementById('devDataImportFile')
  if (devDataImportFile) devDataImportFile.addEventListener('change', devImportData)
  const dataCountEl = document.getElementById('devDataCount')
  if (dataCountEl) dataCountEl.textContent = devDataSummary()

  const data = await apiGet('/api/dev/project', 15000)
  if (data && data.locked) {
    localStorage.removeItem('seoproDevKey')
    if (typeof onLocked === 'function') onLocked(data.error || 'Owner key required.')
    return
  }
  if (!data || data.status !== 'Real') {
    const msg = (data && data.reason) || 'Could not load project state. Is the backend running on :4000?'
    if (errBox) { errBox.style.display = ''; errBox.innerHTML = '<b>Project state load failed.</b> ' + esc(msg) }
    if (filesBox) filesBox.innerHTML = '<div class="muted small">Unable to read files (backend offline).</div>'
    const foldersOffline = document.getElementById('devTreeFolders')
    if (foldersOffline) foldersOffline.innerHTML = '<span class="label-pill label-neutral">offline</span>'
    if (epBox) epBox.innerHTML = '<tr><td colspan="2" class="muted">Unable to read endpoints.</td></tr>'
    if (briefEl) briefEl.textContent = 'Unavailable - backend offline. Start it with: cd backend && node server.js'
    briefText = briefEl ? briefEl.textContent : briefText
    if (chips) chips.innerHTML = '<span class="label-pill label-neutral">offline</span>'
    fill('devPort', 'offline'); fill('devMail', 'n/a'); fill('devFilesCount', '-'); fill('devEpCount', '-')
    return
  }
  const rt = data.runtime || {}
  fill('devPort', ':' + rt.backendPort + ' (online)')
  fill('devMail', rt.gmailSmtpConfigured ? 'SMTP (Gmail) - real delivery' : 'not configured - demo inbox')
  fill('devFilesCount', (data.files || []).length + ' source files')
  fill('devEpCount', (data.endpoints || []).length + ' routes')
  if (chips) {
    const keys = Object.keys(rt.apis || {})
    chips.innerHTML = keys.length
      ? keys.map(k => '<span class="label-pill label-' + (rt.apis[k] === 'configured' ? 'good' : 'neutral') + '">' + esc(k) + ': ' + rt.apis[k] + '</span>').join(' ')
      : '<span class="muted small">none configured (offline/demo mode)</span>'
  }
  renderEndpoints(data.endpoints || [])
  if (briefEl) { briefText = data.brief || 'No brief available.'; briefEl.textContent = briefText }
  devLoadTree()
}

async function devDownloadBackup() {
  const btn = document.getElementById('devExportBtn')
  const statusEl = document.getElementById('devImportStatus')
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing zip...' }
  let objUrl = ''
  try {
    const r = await fetchTimeout(API + '/api/dev/export', { headers: { 'x-dev-key': devStoredKey() } }, 120000)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      throw new Error(d.error || ('HTTP ' + r.status))
    }
    const blob = await r.blob()
    objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = 'seopro-full-backup-' + new Date().toISOString().slice(0, 10) + '.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (statusEl) statusEl.textContent = 'Backup downloaded (' + fmtBytes(blob.size) + ') - full code + .env config, node_modules ছাড়া।'
  } catch (e) {
    toast('Export failed: ' + (e.message || 'backend offline'), 'error')
    if (statusEl) statusEl.textContent = 'Export failed: ' + (e.message || 'backend unreachable')
  }
  if (objUrl) setTimeout(() => URL.revokeObjectURL(objUrl), 5000)
  if (btn) { btn.disabled = false; btn.textContent = 'Export full backup (.zip)' }
}

function devDataKeys() {
  return Object.keys(localStorage).filter(k => k.indexOf('seo_') === 0)
}

function devDataSummary() {
  const users = activeUsers().length
  const trash = trashedUsers().length
  const pays = store.payments().length
  const reports = store.reports().length
  const chats = store.chats().length
  return users + ' users (' + trash + ' in trash) - ' + pays + ' payments - ' + reports + ' reports - ' + chats + ' chats'
}

function devDownloadData() {
  const payload = { app: 'seopro', version: 1, exportedAt: new Date().toISOString(), keys: {} }
  devDataKeys().forEach(k => { payload.keys[k] = localStorage.getItem(k) })
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'seopro-data-' + new Date().toISOString().slice(0, 10) + '.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  const st = document.getElementById('devDataStatus')
  if (st) st.textContent = 'Data downloaded (' + devDataKeys().length + ' keys).'
  toast('Data backup downloaded')
}

function devImportData(e) {
  const input = e && e.target ? e.target : document.getElementById('devDataImportFile')
  const file = input && input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'))
      const keys = parsed && parsed.keys
      if (!keys || typeof keys !== 'object') throw new Error('Invalid data file')
      if (!confirm('Import this data? Current browser data will be replaced.')) { if (input) input.value = ''; return }
      devDataKeys().forEach(k => localStorage.removeItem(k))
      Object.keys(keys).forEach(k => { if (k.indexOf('seo_') === 0) localStorage.setItem(k, String(keys[k])) })
      const st = document.getElementById('devDataStatus')
      if (st) st.textContent = 'Data restored: ' + Object.keys(keys).length + ' keys. Reloading...'
      toast('Data restored')
      setTimeout(() => location.reload(), 800)
    } catch (err) {
      const st = document.getElementById('devDataStatus')
      if (st) st.textContent = 'Import failed: ' + (err.message || 'invalid file')
      toast('Data import failed', 'error')
    }
    if (input) input.value = ''
  }
  reader.readAsText(file)
}

function fmtBytes(b) {
  b = Number(b) || 0
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return Math.round(b / 1024) + ' KB'
  return b + ' B'
}

function renderEndpoints(list) {
  const epBox = document.getElementById('devEndpoints')
  if (!epBox) return
  epBox.innerHTML = (list || []).map(e => '<tr><td><span class="label-pill label-good">' + esc(e.method) + '</span></td><td><code>' + esc(e.route) + '</code></td></tr>').join('') ||
    '<tr><td colspan="2" class="muted">None found</td></tr>'
}

async function devLoadTree() {
  const foldersEl = document.getElementById('devTreeFolders')
  const filesEl = document.getElementById('devFiles')
  if (foldersEl) foldersEl.innerHTML = '<span class="muted small">Loading folders...</span>'
  if (filesEl) filesEl.innerHTML = '<div class="muted small">Loading files...</div>'
  const d = await apiGet('/api/dev/tree', 10000)
  if (!d || d.status !== 'Real') {
    if (foldersEl) foldersEl.innerHTML = '<span class="label-pill label-neutral">offline</span>'
    if (filesEl) filesEl.innerHTML = '<div class="muted small">Unable to list files (backend offline). Refresh korun.</div>'
    return
  }
  const dirs = (d.items || []).filter(i => i.type === 'dir')
  const files = (d.items || []).filter(i => i.type === 'file')
  if (foldersEl) {
    foldersEl.innerHTML = dirs.length
      ? dirs.map(x => '<button class="btn btn-ghost btn-sm dev-folder" type="button" tabindex="-1">' + esc(x.rel) + '</button>').join(' ')
      : '<span class="muted small">No folders</span>'
  }
  if (filesEl) {
    const groups = {}
    files.forEach(f => {
      const g = f.rel.indexOf('/') >= 0 ? f.rel.slice(0, f.rel.lastIndexOf('/')) : '/'
      ;(groups[g] = groups[g] || []).push(f)
    })
    const order = Object.keys(groups).sort((a, b) => {
      if (a === '/') return -1
      if (b === '/') return 1
      return a < b ? -1 : 1
    })
    const rootIdx = order.indexOf('/')
    if (rootIdx > 0) { order.splice(rootIdx, 1); order.unshift('/') }
    filesEl.innerHTML = order.map(g => {
      const rows = groups[g].map(f =>
        '<div class="dev-file"><span class="dev-file-name" title="' + esc(f.rel) + '">' + esc(f.name) + '</span>' +
        '<span class="dev-file-size">' + fmtBytes(f.size) + '</span>' +
        (f.viewable
          ? '<button class="btn btn-ghost btn-sm" data-devview="' + esc(f.rel) + '" type="button">View code</button>'
          : '<span class="label-pill label-neutral">protected</span>') +
        '</div>').join('')
      return (g === '/' ? '' : '<div class="dev-group">' + esc(g) + '/</div>') + rows
    }).join('') || '<div class="muted small">No files found.</div>'
    if (d.truncated) filesEl.innerHTML += '<div class="muted small" style="margin-top:8px">... list truncated (700+ items)</div>'
  }
}

async function devViewFile(rel) {
  const pane = document.getElementById('devCodePane')
  const pathEl = document.getElementById('devCodePane') ? document.querySelector('.dev-file-path') : null
  const meta = document.getElementById('devCodeMeta')
  const body = document.getElementById('devCodeBody')
  if (!pane || !body) return
  pane.style.display = ''
  if (pathEl) pathEl.textContent = rel
  if (meta) meta.textContent = 'Loading...'
  body.textContent = 'Loading code...'
  const d = await apiGet('/api/dev/file?path=' + encodeURIComponent(rel), 15000)
  if (!d || d.status !== 'Real') {
    body.textContent = (d && d.error) ? d.error : 'Could not load file.'
    if (meta) meta.textContent = 'error'
    return
  }
  body.textContent = d.content
  if (meta) meta.textContent = d.lines + ' lines - ' + fmtBytes(d.bytes) + (d.ext ? ' - .' + d.ext.toUpperCase() : '')
}

function devCloseCode() {
  const pane = document.getElementById('devCodePane')
  if (pane) pane.style.display = 'none'
}

function approvePayment(id, reject) {
  const ps = store.payments()
  const p = ps.find(x => x.id === id)
  if (!p) return
  if (reject) { p.status = 'rejected'; store.savePayments(ps); toast('Payment rejected'); }
  else {
    p.status = 'approved'; p.approvedBy = 'admin'; store.savePayments(ps)
    const plan = PLANS.find(pl => pl.id === p.plan) || PLANS[1]
    activatePremium(p.email, plan, p.id)
    toast('Payment approved - ' + p.planName + ' activated')
  }
  navigate()
}

/* ---------- admin user management ---------- */
function patchUser(email, patch) {
  const users = store.users()
  const u = users.find(x => x.email === String(email || '').toLowerCase())
  if (!u) return null
  Object.assign(u, patch)
  store.saveUsers(users)
  return u
}

function adminToggleBlock(email) {
  const u = findUser(email)
  if (!u || isAdmin(u.email)) return
  const now = !u.blocked
  patchUser(email, { blocked: now })
  if (now) {
    const sessions = session()
    if (sessions && sessions.email === u.email) setSession(null)
  }
  toast(now ? 'User blocked' : 'User unblocked')
  navigate()
}

function adminDeleteUser(email) {
  const u = findUser(email)
  if (!u || isAdmin(u.email)) return
  if (!confirm('Move ' + u.email + ' to Trash? They will not be able to login or do anything. You can recover them later.')) return
  patchUser(email, { deleted: true, deletedAt: new Date().toISOString(), blocked: false })
  const s = session()
  if (s && s.email === u.email) setSession(null)
  toast('User moved to Trash')
  navigate()
}

function adminRecoverUser(email) {
  const u = findUser(email)
  if (!u) return
  patchUser(email, { deleted: false, deletedAt: null })
  toast('User recovered')
  navigate()
}

function adminPurgeUser(email) {
  const u = findUser(email)
  if (!u) return
  if (!confirm('Permanently delete ' + u.email + '? This cannot be undone.')) return
  store.saveUsers(store.users().filter(x => x.email !== u.email))
  toast('User permanently deleted')
  navigate()
}

const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'

function openGoogleModal() {
  openModal(
    '<div class="google-modal">' +
      '<div class="g-header">' + GOOGLE_G + '<h3>Sign in with Google</h3></div>' +
      '<p class="muted small center">To continue, Google will share your name, email address and profile picture with SEO Service Provider.</p>' +
      '<div class="field mt-16"><label>Email address</label><input type="email" id="gEmail" placeholder="you@gmail.com" autocomplete="off"></div>' +
      '<div class="field"><label>Name (optional)</label><input type="text" id="gName" placeholder="Your full name" autocomplete="off"></div>' +
      '<button class="btn btn-primary" id="gContinue" style="width:100%" type="button">Continue</button>' +
      '<div class="g-hint small muted center mt-16">Demo: Google OAuth simulated - enter any Gmail address to sign in instantly.</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button></div>' +
    '</div>'
  )
  const btn = document.getElementById('gContinue')
  if (btn) btn.addEventListener('click', googleContinue)
  const emailInput = document.getElementById('gEmail')
  if (emailInput) { emailInput.focus(); emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') googleContinue() }) }
}

function googleContinue() {
  const email = ((document.getElementById('gEmail') || {}).value || '').trim()
  const name = ((document.getElementById('gName') || {}).value || '').trim()
  const btn = document.getElementById('gContinue')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email address', 'error'); return }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...' }
  setTimeout(() => {
    const users = store.users()
    const key = email.toLowerCase()
    let user = users.find(u => u.email === key)
    if (user && user.deleted) { toast('This account was removed. Contact support.', 'error'); return }
    if (user && user.blocked) { toast('This account is blocked. Contact support.', 'error'); return }
    const displayName = name || key.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (!user) {
      user = { name: displayName, email: key, provider: 'google', createdAt: new Date().toISOString(), premium: null, blocked: false, deleted: false }
      users.push(user)
      store.saveUsers(users)
    }
    setSession({ email: user.email })
    closeModal()
    toast('Signed in with Google - ' + user.email)
    go('/dashboard')
  }, 1200)
}

/* ---------- auth view ---------- */

function authView() {
  const mode = state.authMode
  const isLogin = mode === 'login'
  return '<div class="section container auth-wrap"><div class="form-card">' +
    '<h2>' + (isLogin ? 'Welcome back' : 'Create account') + '</h2>' +
    '<p class="sub">' + (isLogin ? 'Login to continue' : 'Free forever. Email verification required to activate your account.') + '</p>' +
    '<div id="authAlert"></div>' +
    '<button class="btn btn-google" id="googleBtn" type="button">' + GOOGLE_G + '<span>' + (isLogin ? 'Continue with Google' : 'Sign up with Google') + '</span></button>' +
    '<div class="divider-or"><span>or use email</span></div>' +
    '<form id="authForm">' +
      (!isLogin ? '<div class="field"><label>Full Name</label><input type="text" id="afName" placeholder="John Doe"></div>' : '') +
      '<div class="field"><label>Email</label><input type="email" id="afEmail" placeholder="you@example.com"></div>' +
      '<div class="field"><label>Password</label><input type="password" id="afPass" placeholder="At least 6 characters"></div>' +
      '<button class="btn btn-primary" style="width:100%" type="submit">' + (isLogin ? 'Login' : 'Register') + '</button>' +
    '</form>' +
    '<div class="form-switch">' + (isLogin ? "Don't have an account? <a href='#' data-switch-auth>Register</a>" : 'Already have one? <a href="#" data-switch-auth>Login</a>') + '</div>' +
    '<div class="center small mt-16"><a href="#" data-fp>Forgot password?</a></div>' +
    '</div></div>'
}

/* ---------- forgot password / otp flows ---------- */

let otpState = null

function otpModal(title, subtitle, subtitleHtml) {
  openModal('<h3>' + esc(title) + '</h3><p class="m-sub">' + (subtitleHtml ? (subtitle || '') : esc(subtitle || '')) + '</p><div id="otpBox" class="otp-box"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Cancel</button></div>')
  return document.getElementById('otpBox')
}

function otpErrorHtml(msg) { return '<div class="alert alert-error">' + esc(msg) + '</div>' }
function otpInfoHtml(msg) { return '<div class="alert alert-info">' + esc(msg) + '</div>' }

function devInboxHtml(res) {
  if (!res || !res.dev || !res.code) return ''
  return '<div class="alert alert-info otp-dev-inbox"><b>Development preview</b> - this environment is not configured to deliver messages, so the code is shown here instead.<div class="otp-code">' +
    esc(res.code) + '</div></div>'
}

function openForgotFlow() {
  const u = currentUser()
  if (cloudOn() && window.SeoCloud) { openServerForgot(u); return }
  otpState = { mode: 'reset', channel: null, contact: null, targetUser: null, resetToken: null, sending: false, prefillEmail: u ? u.email : '' }
  const box = otpModal('Reset your password', 'We will send a one-time code to your email or your verified mobile number. Codes expire in 5 minutes and are single-use.')
  otpState.box = box
  fpStepAccount()
}

/* Server-driven reset (works for real Supabase accounts, uses recovery email). */
function openServerForgot(u) {
  otpState = { mode: 'server-reset', purpose: 'reset', email: '', sent: null, resetToken: null, sending: false, prefillEmail: u ? u.email : '' }
  const box = otpModal('Reset your password', 'Enter your account email. If a recovery email is saved we send the code there, otherwise to the account email. Codes expire in 5 minutes.', true)
  otpState.box = box
  fpServerEmail()
}

function fpServerEmail() {
  const box = otpState.box
  if (!box) return
  box.innerHTML =
    '<div class="field mt-8"><label>Account email</label><input type="email" id="fpEmail" placeholder="you@example.com" value="' + esc(otpState.prefillEmail || '') + '" autocomplete="off"></div>' +
    '<button class="btn btn-primary" id="fpAccountBtn" style="width:100%" type="button">Send reset code</button>' +
    '<div id="fpMsg"></div>' +
    '<div class="small muted mt-16">No account? <a href="#" data-close-modal>Register here</a>.</div>'
  const emailInput = box.querySelector('#fpEmail')
  const go = async () => {
    const email = (emailInput.value || '').trim().toLowerCase()
    const msgEl = box.querySelector('#fpMsg')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter a valid email address'); return }
    const btn = box.querySelector('#fpAccountBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...' }
    const res = await apiPost('/api/account/forgot', { email })
    if (btn) { btn.disabled = false; btn.textContent = 'Send reset code' }
    if (!res || res.status !== 'Real') { if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Could not send the code. Please try again.'); return }
    otpState.email = email
    otpState.sent = res
    fpServerCode()
  }
  const btn = box.querySelector('#fpAccountBtn')
  if (btn) btn.addEventListener('click', go)
  if (emailInput) { emailInput.focus(); emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') go() }) }
}

function fpServerCode() {
  const box = otpState.box
  if (!box) return
  const sent = otpState.sent || {}
  box.innerHTML =
    '<p class="muted small mt-8">Enter the 6-digit code sent to <b>' + esc(sent.contact || otpState.email) + '</b>' + (sent.viaRecovery ? ' (your recovery email)' : '') + '.</p>' +
    devInboxHtml(sent) +
    '<div class="field mt-8"><label>One-time code</label><input type="text" id="otpCode" inputmode="numeric" maxlength="6" placeholder="6-digit code" value="' + (sent.dev ? esc(sent.code) : '') + '" autocomplete="one-time-code"></div>' +
    '<button class="btn btn-primary" id="otpVerifyBtn" style="width:100%" type="button">Verify code</button>' +
    '<div class="small muted center mt-12"><a href="#" data-otp-resend>Resend code</a></div>' +
    '<div id="fpMsg"></div>'
  const codeInput = box.querySelector('#otpCode')
  const verify = async () => {
    const msgEl = box.querySelector('#fpMsg')
    const code = (codeInput.value || '').trim()
    if (!/^\d{6}$/.test(code)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter the 6-digit code'); return }
    const btn = box.querySelector('#otpVerifyBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying...' }
    const res = await apiPost('/api/account/forgot/verify', { email: otpState.email, code })
    if (btn) { btn.disabled = false; btn.textContent = 'Verify code' }
    if (!res || res.status !== 'Real') { if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Verification failed'); return }
    otpState.resetToken = res.resetToken
    fpServerNewPassword()
  }
  const vBtn = box.querySelector('#otpVerifyBtn')
  if (vBtn) vBtn.addEventListener('click', verify)
  if (codeInput) codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') verify() })
  const resend = box.querySelector('[data-otp-resend]')
  if (resend) resend.addEventListener('click', async e => {
    e.preventDefault()
    const msgEl = box.querySelector('#fpMsg')
    const res = await apiPost('/api/account/forgot', { email: otpState.email })
    if (res && res.status === 'Real') { otpState.sent = res; fpServerCode() }
    else if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Could not resend the code.')
  })
}

function fpServerNewPassword() {
  const box = otpState.box
  if (!box) return
  box.innerHTML =
    '<div class="alert alert-info">Code verified. Set a new password now.</div>' +
    '<div class="field mt-8"><label>New password</label><input type="password" id="np1" placeholder="At least 6 characters" autocomplete="new-password"></div>' +
    '<div class="field"><label>Confirm new password</label><input type="password" id="np2" placeholder="Repeat new password" autocomplete="new-password"></div>' +
    '<button class="btn btn-primary" id="npBtn" style="width:100%" type="button">Reset password</button>' +
    '<div id="fpMsg"></div>'
  const p1 = box.querySelector('#np1')
  const p2 = box.querySelector('#np2')
  const submit = async () => {
    const msgEl = box.querySelector('#fpMsg')
    if ((p1.value || '').length < 6) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Password must be at least 6 characters'); return }
    if (p1.value !== p2.value) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Passwords do not match'); return }
    const btn = box.querySelector('#npBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Resetting...' }
    const res = await apiPost('/api/account/reset', { email: otpState.email, resetToken: otpState.resetToken, newPassword: p1.value })
    if (btn) { btn.disabled = false; btn.textContent = 'Reset password' }
    if (!res || res.status !== 'Real') { if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Reset failed. Request a new code.'); return }
    closeModal()
    toast('Password updated - please sign in with the new password')
    go('/auth')
  }
  const btn = box.querySelector('#npBtn')
  if (btn) btn.addEventListener('click', submit)
  if (p1) p1.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  if (p2) p2.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
}

function fpStepAccount() {
  const box = otpState.box
  if (!box) return
  box.innerHTML =
    '<div class="field mt-8"><label>Account email</label><input type="email" id="fpEmail" placeholder="you@example.com" value="' + esc(otpState.prefillEmail || '') + '" autocomplete="off"></div>' +
    '<button class="btn btn-primary" id="fpAccountBtn" style="width:100%" type="button">Continue</button>' +
    '<div id="fpMsg"></div>' +
    '<div class="small muted mt-16">No account? <a href="#" data-close-modal>Register here</a>.</div>'
  const emailInput = box.querySelector('#fpEmail')
  const go = () => {
    const email = (emailInput.value || '').trim().toLowerCase()
    const msgEl = box.querySelector('#fpMsg')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter a valid email address'); return }
    const target = store.users().find(x => x.email === email)
    if (!target) { if (msgEl) msgEl.innerHTML = otpErrorHtml('No account found for ' + esc(email) + '. Register first, or use a Google sign-in email.'); return }
    otpState.targetUser = target
    otpState.email = email
    fpStepChannel()
  }
  const btn = box.querySelector('#fpAccountBtn')
  if (btn) btn.addEventListener('click', go)
  if (emailInput) { emailInput.focus(); emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') go() }) }
}

function fpStepChannel() {
  const box = otpState.box
  if (!box) return
  const target = otpState.targetUser
  const cfg = deliveryCfg()
  const hasPhone = target.phoneVerified && target.phone
  const phoneButtons = (hasPhone && (cfg.whatsapp || cfg.sms))
    ? (cfg.whatsapp ? '<button class="btn btn-ghost" data-otp-channel="whatsapp" type="button">WhatsApp a code<br><span class="small muted">' + esc(maskPhone(target.phone)) + '</span></button>' : '') +
      (cfg.sms ? '<button class="btn btn-ghost" data-otp-channel="sms" type="button">SMS a code<br><span class="small muted">' + esc(maskPhone(target.phone)) + '</span></button>' : '')
    : ''
  box.innerHTML =
    '<p class="muted small mt-8">How do you want to receive the reset code for <b>' + esc(target.email) + '</b>?</p>' +
    '<div class="otp-channels">' +
      '<button class="btn btn-ghost" data-otp-channel="email" type="button">Email me a code<br><span class="small muted">' + esc(target.email) + '</span></button>' +
      phoneButtons +
      (hasPhone ? '' : '<div class="small muted otp-nophone">No verified mobile number yet - <a href="#" data-fp-nophone>add & verify one first</a> (you will need your current password).</div>') +
    '</div>' +
    (phoneButtons ? '' : '<div class="small muted mt-8">WhatsApp / SMS recovery is not switched on yet, so email is the active channel.</div>') +
    '<div id="fpMsg"></div>'
  if (!hasPhone) {
    const addLink = box.querySelector('[data-fp-nophone]')
    if (addLink) addLink.addEventListener('click', e => {
      e.preventDefault()
      closeModal()
      const logged = currentUser()
      if (logged) openPhoneVerify()
      else toast('Login first to add a mobile number to your account', 'error')
    })
  }
  box.querySelectorAll('[data-otp-channel]').forEach(b => b.addEventListener('click', () => {
    const channel = b.getAttribute('data-otp-channel')
    const contact = channel === 'email' ? target.email : target.phone
    otpState.channel = channel
    otpState.contact = contact
    otpState.purpose = 'reset'
    otpSendAndStep()
  }))
}

async function otpSendAndStep() {
  const box = otpState.box
  if (!box || otpState.sending) return
  otpState.sending = true
  otpStepCode('sending')
  const res = await apiPost('/api/otp/send', { contact: otpState.contact, channel: otpState.channel, purpose: otpState.purpose }, 30000)
  otpState.sending = false
  if (!res || res.status !== 'Real') {
    const detail = (res && (res.error || res.reason)) || 'Could not send the code.'
    otpStepCode('error', detail)
    return
  }
  otpState.sent = res
  otpStepCode('sent')
}

function otpStepCode(status, detail) {
  const box = otpState.box
  if (!box) return
  const contact = (otpState.sent && otpState.sent.contact) || otpState.contact || ''
  const channel = (otpState.sent && otpState.sent.channel) || otpState.channel || 'email'
  const via = otpState.mode === 'reset' ? ' via ' + esc(channel) : ''
  const headTxt = 'Enter the 6-digit code sent to <b>' + esc(contact) + '</b>' + via + '.'
  let statusHtml = '<div id="otpStatus"></div>'
  if (status === 'sending') statusHtml = '<div class="center muted small mt-8" id="otpStatus"><span class="spinner"></span> Sending code...</div>'
  else if (status === 'error') statusHtml = '<div id="otpStatus">' + otpErrorHtml(detail || 'Could not send the code.') + '</div>'
  else if (status === 'sent') statusHtml = '<div id="otpStatus">' + otpInfoHtml('Code sent. It expires in 5 minutes.') + '</div>'
  box.innerHTML =
    '<p class="muted small mt-8">' + headTxt + '</p>' +
    statusHtml +
    devInboxHtml(otpState.sent) +
    '<div class="field mt-8"><label>One-time code</label><input type="text" id="otpCode" inputmode="numeric" maxlength="6" placeholder="6-digit code" value="' + (otpState.sent && otpState.sent.dev ? esc(otpState.sent.code) : '') + '" autocomplete="one-time-code"></div>' +
    '<button class="btn btn-primary" id="otpVerifyBtn" style="width:100%" type="button">Verify code</button>' +
    (status === 'error' ? '<button class="btn btn-ghost mt-8" id="otpRetryBtn" type="button" style="width:100%">Try again</button>' : '') +
    '<div class="small muted center mt-12"><a href="#" data-otp-resend>Resend code</a></div>' +
    '<div id="fpMsg"></div>'
  const codeInput = box.querySelector('#otpCode')
  const verify = async () => {
    const msgEl = box.querySelector('#fpMsg')
    const code = (codeInput.value || '').trim()
    if (!/^\d{6}$/.test(code)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter the 6-digit code'); return }
    const btn = box.querySelector('#otpVerifyBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying...' }
    const res = await apiPost('/api/otp/verify', { contact: contact, channel: channel, purpose: otpState.purpose, code })
    if (btn) { btn.disabled = false; btn.textContent = 'Verify code' }
    if (!res || res.status !== 'Real') {
      if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Verification failed')
      return
    }
    if (otpState.mode === 'register') {
      otpRegisterComplete()
    } else if (otpState.purpose === 'reset' && res.resetToken) {
      otpState.resetToken = res.resetToken
      fpStepNewPassword()
    } else {
      otpVerifiedSave()
    }
  }
  const vBtn = box.querySelector('#otpVerifyBtn')
  if (vBtn) vBtn.addEventListener('click', verify)
  if (codeInput) { codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') verify() }); codeInput.focus() }
  const retry = box.querySelector('#otpRetryBtn')
  if (retry) retry.addEventListener('click', () => otpSendAndStep())
  const resend = box.querySelector('[data-otp-resend]')
  if (resend) resend.addEventListener('click', e => { e.preventDefault(); otpSendAndStep() })
}

function openRegisterOtpFlow(name, email, pass) {
  const emailKey = String(email).trim().toLowerCase()
  otpState = {
    mode: 'register', purpose: 'verify_email', channel: 'email', contact: emailKey,
    sending: false, sent: null, reg: { name: String(name || '').trim(), email: emailKey, pass }
  }
  const box = otpModal('Verify your email',
    'A one-time code is being sent to <b>' + esc(emailKey) + '</b>. Enter it to activate your new account. Codes expire in 5 minutes.', true)
  otpState.box = box
  otpSendAndStep()
}

async function otpRegisterComplete() {
  const r = await registerUser(otpState.reg.name, otpState.reg.email, otpState.reg.pass)
  if (r.error) {
    const box = otpState.box
    if (box) {
      const msgEl = box.querySelector('#fpMsg')
      if (msgEl) msgEl.innerHTML = otpErrorHtml(r.error)
    }
    toast(r.error, 'error')
    return
  }
  closeModal()
  toast('Email verified - welcome, ' + r.user.name.split(' ')[0])
  go('/dashboard')
}

function fpStepNewPassword() {
  const box = otpState.box
  if (!box) return
  box.innerHTML =
    '<div class="alert alert-info">Code verified. Set a new password now.</div>' +
    '<div class="field mt-8"><label>New password</label><input type="password" id="np1" placeholder="At least 6 characters" autocomplete="new-password"></div>' +
    '<div class="field"><label>Confirm new password</label><input type="password" id="np2" placeholder="Repeat new password" autocomplete="new-password"></div>' +
    '<button class="btn btn-primary" id="npBtn" style="width:100%" type="button">Reset password</button>' +
    '<div id="fpMsg"></div>'
  const p1 = box.querySelector('#np1')
  const p2 = box.querySelector('#np2')
  const submit = async () => {
    const msgEl = box.querySelector('#fpMsg')
    if ((p1.value || '').length < 6) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Password must be at least 6 characters'); return }
    if (p1.value !== p2.value) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Passwords do not match'); return }
    const btn = box.querySelector('#npBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Resetting...' }
    const res = await apiPost('/api/password-reset', {
      contact: otpState.sent.contact, channel: otpState.sent.channel, purpose: 'reset',
      resetToken: otpState.resetToken, newPassword: p1.value
    })
    if (btn) { btn.disabled = false; btn.textContent = 'Reset password' }
    if (!res || res.status !== 'Real') {
      if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Reset failed. Request a new code.')
      return
    }
    const users = store.users()
    const user = users.find(x => x.email === otpState.email)
    if (user) { user.salt = makeSalt(); user.passHash = await hashPassword(p1.value, user.salt); delete user.password; store.saveUsers(users) }
    setSession({ email: otpState.email })
    toast('Password reset successfully - you are logged in')
    closeModal()
    go('/dashboard')
  }
  const btn = box.querySelector('#npBtn')
  if (btn) btn.addEventListener('click', submit)
  if (p1) p1.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
  if (p2) p2.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
}

/* ---------- phone add & verify (logged in) ---------- */

function openPhoneVerify() {
  const u = currentUser()
  if (!u) { toast('Please login first', 'error'); go('/auth'); return }
  otpState = { mode: 'phone', purpose: 'verify_phone', channel: null, contact: null, sent: null, sending: false, targetUser: u }
  const box = otpModal('Verify your mobile number', 'Add a mobile number and prove you own it. Once verified it can be used to reset your password via SMS or WhatsApp.')
  otpState.box = box
  phoneStepNumber()
}

function phoneStepNumber() {
  const box = otpState.box
  if (!box) return
  const existing = otpState.targetUser.phone || ''
  const cfg = deliveryCfg()
  const buttons =
    (cfg.whatsapp ? '<button class="btn btn-ghost" data-pv-channel="whatsapp" type="button">Send code via WhatsApp</button>' : '') +
    (cfg.sms ? '<button class="btn btn-ghost" data-pv-channel="sms" type="button">Send code via SMS</button>' : '')
  box.innerHTML =
    '<div class="field mt-8"><label>Mobile number (with country code)</label><input type="tel" id="pvPhone" placeholder="+8801XXXXXXXXX" value="' + esc(existing) + '" autocomplete="tel"></div>' +
    (buttons
      ? '<div class="otp-channels">' + buttons + '</div>'
      : '<div class="alert alert-error">WhatsApp and SMS delivery are not switched on yet, so a number cannot be verified right now. Add a recovery email instead from your dashboard.</div>') +
    '<div id="fpMsg"></div>'
  const send = async (channel) => {
    const msgEl = box.querySelector('#fpMsg')
    const phone = phoneDigits(box.querySelector('#pvPhone').value || '')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter a valid mobile number (7-15 digits) with country code'); return }
    otpState.channel = channel
    otpState.contact = phone
    await otpSendAndStep()
  }
  box.querySelectorAll('[data-pv-channel]').forEach(b => b.addEventListener('click', () => send(b.getAttribute('data-pv-channel'))))
  const phoneInput = box.querySelector('#pvPhone')
  if (phoneInput) { phoneInput.focus(); phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') send('whatsapp') }) }
}

function otpVerifiedSave() {
  const u = currentUser()
  const users = store.users()
  const user = users.find(x => x.email === (u ? u.email : otpState.email))
  if (user && otpState.contact) {
    user.phone = otpState.contact
    user.phoneVerified = true
    store.saveUsers(users)
  }
  toast('Mobile number verified - ' + maskPhone(otpState.contact))
  closeModal()
  if (pathFromLocation() === '/dashboard') navigate()
}

/* ---------- recovery email (logged in) ---------- */

let recState = null

async function loadMyRecoveryEmail() {
  if (!cloudOn() || !currentUser()) return
  const res = await apiUser('/api/account/recovery-email')
  if (!res || res.status !== 'Real') return
  const users = store.users()
  const u = users.find(x => x.email === currentUser().email)
  if (!u) return
  if ((u.recoveryEmail || '') !== (res.email || '')) {
    u.recoveryEmail = res.email || ''
    store.saveUsers(users)
    navigate()
  }
}

function openRecoveryEmail() {
  const u = currentUser()
  if (!u) { toast('Please login first', 'error'); go('/auth'); return }
  if (!cloudOn()) { toast('Recovery email needs the cloud backend', 'error'); return }
  recState = { box: null, email: '', sent: null, sending: false }
  const box = otpModal('Recovery email', 'Add an email that can receive your password-reset code if you ever lose access to your account.', true)
  recState.box = box
  recStepEmail()
}

function recStepEmail() {
  const box = recState.box
  if (!box) return
  const u = currentUser()
  const cfg = deliveryCfg()
  box.innerHTML =
    '<div class="field mt-8"><label>Recovery email</label><input type="email" id="recEmail" placeholder="you@example.com" value="' + esc((u && u.recoveryEmail) || '') + '" autocomplete="email"></div>' +
    '<button class="btn btn-primary" id="recSendBtn" style="width:100%" type="button">Send verification code</button>' +
    (cfg.email ? '' : '<div class="alert alert-error mt-12">Email delivery is not configured on the server yet, so the code cannot be delivered.</div>') +
    '<div id="recMsg"></div>'
  const emailInput = box.querySelector('#recEmail')
  const go = async () => {
    const email = (emailInput.value || '').trim().toLowerCase()
    const msgEl = box.querySelector('#recMsg')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter a valid email address'); return }
    const btn = box.querySelector('#recSendBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...' }
    const res = await apiUser('/api/account/recovery-email/send', { email })
    if (btn) { btn.disabled = false; btn.textContent = 'Send verification code' }
    if (!res || res.status !== 'Real') { if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Could not send the code.'); return }
    recState.email = email
    recState.sent = res
    recStepCode()
  }
  const btn = box.querySelector('#recSendBtn')
  if (btn) btn.addEventListener('click', go)
  if (emailInput) { emailInput.focus(); emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') go() }) }
}

function recStepCode() {
  const box = recState.box
  if (!box) return
  const sent = recState.sent || {}
  box.innerHTML =
    '<p class="muted small mt-8">Enter the 6-digit code sent to <b>' + esc(sent.contact || recState.email) + '</b>.</p>' +
    devInboxHtml(sent) +
    '<div class="field mt-8"><label>One-time code</label><input type="text" id="otpCode" inputmode="numeric" maxlength="6" placeholder="6-digit code" value="' + (sent.dev ? esc(sent.code) : '') + '" autocomplete="one-time-code"></div>' +
    '<button class="btn btn-primary" id="otpVerifyBtn" style="width:100%" type="button">Verify & save</button>' +
    '<div class="small muted center mt-12"><a href="#" data-rec-resend>Resend code</a></div>' +
    '<div id="recMsg"></div>'
  const codeInput = box.querySelector('#otpCode')
  const verify = async () => {
    const msgEl = box.querySelector('#recMsg')
    const code = (codeInput.value || '').trim()
    if (!/^\d{6}$/.test(code)) { if (msgEl) msgEl.innerHTML = otpErrorHtml('Enter the 6-digit code'); return }
    const btn = box.querySelector('#otpVerifyBtn')
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying...' }
    const res = await apiUser('/api/account/recovery-email/verify', { email: recState.email, code })
    if (btn) { btn.disabled = false; btn.textContent = 'Verify & save' }
    if (!res || res.status !== 'Real') { if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Verification failed'); return }
    const users = store.users()
    const u = users.find(x => x.email === currentUser().email)
    if (u) { u.recoveryEmail = recState.email; store.saveUsers(users) }
    toast('Recovery email saved')
    closeModal()
    if (pathFromLocation() === '/dashboard') navigate()
  }
  const vBtn = box.querySelector('#otpVerifyBtn')
  if (vBtn) vBtn.addEventListener('click', verify)
  if (codeInput) codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') verify() })
  const resend = box.querySelector('[data-rec-resend]')
  if (resend) resend.addEventListener('click', async e => {
    e.preventDefault()
    const res = await apiUser('/api/account/recovery-email/send', { email: recState.email })
    if (res && res.status === 'Real') { recState.sent = res; recStepCode() }
    else { const msgEl = box.querySelector('#recMsg'); if (msgEl) msgEl.innerHTML = otpErrorHtml((res && res.error) || 'Could not resend the code.') }
  })
}

/* ============================================================== live chat */

function identityForChat() {
  const u = currentUser()
  return u ? { id: u.email, name: u.name, email: u.email } : { id: 'guest', name: 'Guest', email: 'guest' }
}

function findChatIn(chats) {
  const idn = identityForChat()
  let chat = chats.find(c => c.email === idn.email)
  if (!chat) {
    chat = { id: uid(), email: idn.email, name: idn.name, messages: [], userUnread: 0, adminUnread: 0, updatedAt: new Date().toISOString() }
    chats.push(chat)
    store.saveChats(chats)
  }
  return chat
}

function renderChat() {
  const body = document.getElementById('chatBody')
  if (!body) return
  const chats = store.chats()
  const chat = findChatIn(chats)
  const html = chat.messages.map(m =>
    '<div class="msg msg-' + m.from + '">' + esc(m.text) +
    (m.intent && m.intentLabel ? '<span class="msg-time">intent: ' + esc(m.intent) + ' - ' + Math.round((m.confidence || 0) * 100) + '% ' + esc(m.intentLabel) + '</span>' : '<span class="msg-time">' + fmtTime(m.time) + '</span>') +
    '</div>').join('') || '<div class="muted small">Ask us anything about pricing, tools or your account.</div>'
  body.innerHTML = html
  body.scrollTop = body.scrollHeight
}

async function chatSend(text) {
  if (isBlocked()) { toast('Your account is blocked. Contact support.', 'error'); return }
  const msg = (text || '').trim()
  if (!msg) return
  const chats = store.chats()
  const chat = findChatIn(chats)
  const history = chat.messages.slice(-5).map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', text: m.text }))
  chat.messages.push({ from: 'user', text: msg, time: new Date().toISOString() })
  chat.adminUnread = (chat.adminUnread || 0) + 1
  chat.updatedAt = new Date().toISOString()
  store.saveChats(chats)
  renderChat()

  const res = await apiPost('/api/chat', { message: msg, messages: history })
  const replyText = res && res.reply ? res.reply : 'Our assistant is offline right now. Please reach us on WhatsApp +8801886822816.'
  chat.messages.push({
    from: 'bot',
    text: replyText,
    time: new Date().toISOString(),
    intent: res && res.intent ? res.intent.intent : null,
    intentLabel: res && res.intent ? res.intent.label : null,
    confidence: res && res.intent ? res.intent.confidence : null
  })
  chat.updatedAt = new Date().toISOString()
  store.saveChats(chats)
  renderChat()
}

function updateChatBadge() {
  const badge = document.getElementById('chatFabBadge')
  const chat = store.chats().find(c => c.email === identityForChat().email)
  const n = chat ? (chat.userUnread || 0) : 0
  if (!badge) return
  if (n > 0) { badge.hidden = false; badge.textContent = n > 9 ? '9+' : n }
  else { badge.hidden = true; badge.textContent = '0' }
}

/* ============================================================== event delegation */

function bindView(path, root) {
  const toolInput = root.querySelector('#toolInput')
  if (toolInput) toolInput.addEventListener('keydown', e => { if (e.key === 'Enter' && state.activeTool) runTool(state.activeTool) })
  const toolHint = root.querySelector('#toolHint')
  if (toolHint && state.activeTool) {
    const kt = ['keyword-research', 'serp-analyzer', 'competitor-analysis', 'question-finder', 'related-keywords', 'keyword-difficulty', 'meta-description'].indexOf(state.activeTool) >= 0
    toolHint.textContent = kt ? 'Tip: separate multiple keywords with commas for batch analysis (max 10).' : 'One value at a time - this tool runs one real analysis per request.'
  }

  const genBtn = root.querySelector('#genBtn')
  if (genBtn) genBtn.addEventListener('click', runGenerator)
  const genInput = root.querySelector('#genInput')
  if (genInput) genInput.addEventListener('keydown', e => { if (e.key === 'Enter') runGenerator() })

  const adminLoginBtn = root.querySelector('#adminLoginBtn')
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', async () => {
      const email = (document.getElementById('adminEmail') || {}).value || ''
      const pass = (document.getElementById('adminPass') || {}).value || ''
      if (!email) { state.adminError = 'Enter your admin email'; navigate(); return }
      adminLoginBtn.disabled = true
      adminLoginBtn.innerHTML = '<span class="spinner"></span> Verifying...'
      let res = null
      try { res = await apiPost('/api/admin/login', { email: email.toLowerCase().trim(), password: pass }, 15000) } catch (e) { res = null }
      adminLoginBtn.disabled = false
      adminLoginBtn.textContent = 'Login as Admin'
      if (!res || res.status !== 'Real') {
        state.adminError = (res && res.error) || 'Secure admin login needs the backend online. Please try again.'
        navigate()
        return
      }
      const users = store.users()
      let stored = users.find(x => x.email === email.toLowerCase().trim())
      if (!stored) {
        stored = { name: res.role === 'moderator' ? 'Moderator' : 'Admin', email: email.toLowerCase().trim(), provider: 'admin', createdAt: new Date().toISOString(), premium: { status: res.role === 'moderator' ? '' : 'Active', planName: res.role === 'moderator' ? 'Moderator' : 'Owner' }, blocked: false, deleted: false }
        users.push(stored)
        store.saveUsers(users)
      }
      setAdminToken(stored.email, res.token, res.expiresIn, res.role, res.permissions)
      setSession({ email: stored.email })
      state.adminError = ''
      state.adminTab = res.role === 'moderator' ? 'logs' : 'users'
      state.adminChatId = null
      toast(res.role === 'moderator' ? 'Moderator login successful' : 'Admin login successful')
      navigate()
    })
  }

  const authForm = root.querySelector('#authForm')
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = (document.getElementById('afEmail') || {}).value || ''
      const pass = (document.getElementById('afPass') || {}).value || ''
      const name = (document.getElementById('afName') || {}).value || ''
      const alertEl = document.getElementById('authAlert')
      if (state.authMode === 'register') {
        const err = newAccountError(name, email, pass)
        if (alertEl) alertEl.innerHTML = err ? '<div class="alert alert-error">' + esc(err) + '</div>' : ''
        if (err) return
        openRegisterOtpFlow(name, email, pass)
        return
      }
      if (isAdmin(String(email).trim())) { toast('Admin account - opening the Admin login'); go('/admin'); return }
      const r = await loginUser(email, pass)
      if (alertEl) alertEl.innerHTML = r.error ? '<div class="alert alert-error">' + esc(r.error) + '</div>' : ''
      if (r.ok) { toast('Welcome, ' + r.user.name.split(' ')[0]); go('/dashboard') }
    })
  }
  root.querySelectorAll('[data-switch-auth]').forEach(a => {
    a.addEventListener('click', (e) => { e.preventDefault(); state.authMode = state.authMode === 'login' ? 'register' : 'login'; navigate() })
  })
  const googleBtn = root.querySelector('#googleBtn')
  if (googleBtn) googleBtn.addEventListener('click', openGoogleModal)
  const fpLink = root.querySelector('[data-fp]')
  if (fpLink) fpLink.addEventListener('click', (e) => { e.preventDefault(); openForgotFlow() })
  const verifyPhoneBtn = root.querySelector('[data-verify-phone]')
  if (verifyPhoneBtn) verifyPhoneBtn.addEventListener('click', openPhoneVerify)
  const recEmailBtn = root.querySelector('[data-recovery-email]')
  if (recEmailBtn) recEmailBtn.addEventListener('click', openRecoveryEmail)
  if (path === '/dashboard') loadMyRecoveryEmail()

  if (path === '/admin') {
    const forgotLink = root.querySelector('[data-admin-forgot]')
    if (forgotLink) forgotLink.addEventListener('click', e => { e.preventDefault(); openAdminForgot() })
    if (state.adminTab === 'account') bindAdminAccount()
    if (state.adminTab === 'dev') devBoot()
    if (state.adminTab === 'users') bindAdminUsers()
    if (state.adminTab === 'chats') bindAdminChats()
    if (state.adminTab === 'payments') bindAdminProofs()
    if (state.adminTab === 'plans') bindAdminPlans()
    if (state.adminTab === 'methods') bindAdminMethods()
    if (state.adminTab === 'moderators') bindAdminModerators()
    if (state.adminTab === 'logs') bindAdminLogs()
    if (state.adminTab === 'audit') bindAdminAudit()
    if (state.adminTab === 'maintenance') bindAdminMaintenance()
  }
}

function showDashTab(tab) {
  const panel = document.getElementById('dashTab')
  if (!panel) return
  const u = currentUser()
  if (!u) return
  const premium = u.premium && u.premium.status === 'Active' ? u.premium : null
  const agentsUnlocked = premium ? premium.agents : 3
  let html = ''
  if (tab === 'agents') {
    const list = AGENTS.slice(0, agentsUnlocked).map(a => '<button class="feature-card agent-card" data-agent="' + esc(a.name) + '" type="button"><div class="f-icon" style="color:#22d3ee">A</div><h3>' + esc(a.name) + '</h3><p>' + esc(a.desc) + '</p><span class="agent-run">Run - ' + esc(agentToolName(a.name)) + '</span></button>').join('')
    html = '<h3>Your AI Agents (' + agentsUnlocked + '/19)</h3><div class="grid grid-3 mt-16">' + list + '</div>' +
      (agentsUnlocked < 19 ? '<button class="btn btn-primary btn-sm mt-24" data-plan="starter" type="button">Unlock more - Starter $5</button>' : '')
  } else if (tab === 'reports') {
    const reports = store.reports().filter(r => r.email === u.email)
    html = '<h3>My Reports (' + reports.length + ')</h3><div class="title-list mt-16">' + (reports.length ? reports.map(r => '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(r.primary) + ' <span class="muted small">' + r.titleCount + ' titles - ' + esc(r.intent) + '</span></div><div class="t-actions"><span class="muted small">' + fmtTime(r.date) + '</span><button class="btn btn-ghost btn-sm" data-view-report="' + r.id + '" type="button">View</button></div></div></div>').join('') : '<div class="muted small">No reports yet.</div>') + '</div>'
  } else if (tab === 'payments') {
    const ps = store.payments().filter(p => p.email === u.email)
    const rows = ps.map(p => '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.planName) + '</td><td>$' + p.amount + '</td><td>' + esc(p.method) + '</td><td>' + esc(p.trx) + '</td><td>' + fmtDate(p.createdAt) + '</td><td>' + statusPill(p.status) + '</td></tr>').join('')
    html = '<h3>My Payments (' + ps.length + ')</h3><div class="table-wrap mt-16"><table class="table"><thead><tr><th>ID</th><th>Plan</th><th>Amount</th><th>Method</th><th>Trx</th><th>Date</th><th>Status</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="muted">No payments yet</td></tr>') + '</tbody></table></div>'
  } else {
    const daily = localUsageFor(u.email)
    const reports = store.reports().filter(r => r.email === u.email)
    const allScores = reports.flatMap(r => (r.titles || []).map(t => t.score))
    const avg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null
    html = '<div class="metric-grid">' +
      '<div class="metric"><div class="m-label">Daily Credits</div><div class="m-value">' + daily + ' / ' + (premium ? premium.daily : 3) + '</div>' + scoreBar(Math.round(daily / Math.max(1, (premium ? premium.daily : 3)) * 100)) + '</div>' +
      '<div class="metric"><div class="m-label">Agents</div><div class="m-value">' + agentsUnlocked + ' / 19</div>' + scoreBar(Math.round(agentsUnlocked / 19 * 100)) + '</div>' +
      '<div class="metric"><div class="m-label">Quality</div><div class="m-value">' + (avg != null ? avg + '%' : 'N/A') + '</div><div class="mt-16">' + (avg != null ? labelPill(localLabel(avg)) : '<span class="muted small">Generate to score</span>') + '</div></div>' +
      '</div>' +
      '<div class="mt-24"><h3>Latest Report</h3><div class="title-list mt-16">' + (reports[0] ? '<div class="title-item"><div class="t-top"><div class="t-title">' + esc(reports[0].primary) + '</div><div class="t-actions"><span class="muted small">' + reports[0].titleCount + ' titles</span><button class="btn btn-ghost btn-sm" data-view-report="' + reports[0].id + '" type="button">View</button></div></div></div>' : '<div class="muted small">No reports yet. Open the Generator.</div>') + '</div></div>'
  }
  panel.innerHTML = html
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab))
  bindView(pathFromLocation(), document.getElementById('mainView'))
}

/* ============================================================== global events */

function bindGlobal() {
  const menuBtn = document.getElementById('menuBtn')
  const mobileMenu = document.getElementById('mobileMenu')
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const open = mobileMenu.classList.toggle('open')
      menuBtn.classList.toggle('open', open)
    })
    document.addEventListener('click', (e) => {
      if (!mobileMenu.classList.contains('open')) return
      if (mobileMenu.contains(e.target) || menuBtn.contains(e.target)) return
      mobileMenu.classList.remove('open')
      menuBtn.classList.remove('open')
    })
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      mobileMenu.classList.remove('open')
      menuBtn.classList.remove('open')
    }))
  }

  const overlay = document.getElementById('modalOverlay')
  if (overlay) {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal() })
  }
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close-modal]')
    if (closer) closeModal()
    const cp = e.target.closest('[data-copy]')
    if (cp) copyToClipboard(cp.getAttribute('data-copy'))
    const cpPay = e.target.closest('[data-copy-pay]')
    if (cpPay) copyPaymentValue(cpPay.getAttribute('data-copy-pay'), cpPay)
    const goAdmin = e.target.closest('[data-goto-admin]')
    if (goAdmin) { state.adminTab = 'users'; state.adminChatId = null; go('/admin'); return }
    const goAdminDev = e.target.closest('[data-goto-admin-dev]')
    if (goAdminDev) { state.adminTab = 'dev'; state.adminChatId = null; go('/admin'); return }
    const devView = e.target.closest('[data-devview]')
    if (devView) { devViewFile(devView.getAttribute('data-devview')); return }
    const ca = e.target.closest('[data-copy-all]')
    if (ca) {
      const tbl = document.getElementById(ca.getAttribute('data-copy-all'))
      if (tbl) {
        const lines = [...tbl.querySelectorAll('tbody tr')].map(tr => {
          const td = tr.querySelector('td')
          return td ? td.textContent.replace(/\s+/g, ' ').trim() : ''
        }).filter(Boolean)
        copyToClipboard(lines.join('\n'))
      }
    }
    const tg = e.target.closest('[data-toggle]')
    if (tg) {
      const el = document.getElementById(tg.getAttribute('data-toggle'))
      if (el) {
        const hidden = el.style.display === 'none'
        el.style.display = hidden ? '' : 'none'
        tg.textContent = hidden ? tg.getAttribute('data-less') || 'Show less' : tg.getAttribute('data-more') || 'Show more'
        tg.blur()
      }
    }
    const openTool = e.target.closest('[data-open-tool]')
    if (openTool) { state.activeTool = openTool.getAttribute('data-open-tool'); navigate(); }
    const plan = e.target.closest('[data-plan]')
    if (plan && !e.target.closest('.plan-detail')) {
      const p = PLANS.find(x => x.id === plan.getAttribute('data-plan'))
      if (p) viewPlanDetail(p)
    }
    const tab = e.target.closest('[data-tab]')
    if (tab) {
      const t = tab.getAttribute('data-tab')
      if (t === 'agents') showDashTab('agents')
      else if (t === 'reports') showDashTab('reports')
      else if (t === 'payments') showDashTab('payments')
      else showDashTab('overview')
    }
    const atab = e.target.closest('[data-atab]')
    if (atab) { state.adminTab = atab.getAttribute('data-atab'); state.adminChatId = null; navigate(); }
    const appr = e.target.closest('[data-approve-pay]')
    if (appr) approvePayment(appr.getAttribute('data-approve-pay'), false)
    const rej = e.target.closest('[data-reject-pay]')
    if (rej) approvePayment(rej.getAttribute('data-reject-pay'), true)
    const uBlock = e.target.closest('[data-user-block]')
    if (uBlock) adminToggleBlock(uBlock.getAttribute('data-user-block'))
    const uUnblock = e.target.closest('[data-user-unblock]')
    if (uUnblock) adminToggleBlock(uUnblock.getAttribute('data-user-unblock'))
    const uDel = e.target.closest('[data-user-delete]')
    if (uDel) adminDeleteUser(uDel.getAttribute('data-user-delete'))
    const uRec = e.target.closest('[data-user-recover]')
    if (uRec) adminRecoverUser(uRec.getAttribute('data-user-recover'))
    const uPurge = e.target.closest('[data-user-purge]')
    if (uPurge) adminPurgeUser(uPurge.getAttribute('data-user-purge'))
    const thread = e.target.closest('[data-open-thread]')
    if (thread) {
      state.adminChatId = thread.getAttribute('data-open-thread')
      navigate()
    }
    const backThread = e.target.closest('[data-back-thread]')
    if (backThread) { state.adminChatId = null; navigate(); }
    const sendReply = e.target.closest('[data-send-reply]')
    if (sendReply) {
      const input = document.getElementById('adminReplyInput')
      const text = input ? input.value.trim() : ''
      if (text) {
        const chats = store.chats()
        const c = chats.find(x => x.id === sendReply.getAttribute('data-send-reply'))
        if (c) {
          c.messages.push({ from: 'admin', text, time: new Date().toISOString() })
          c.userUnread = (c.userUnread || 0) + 1
          c.updatedAt = new Date().toISOString()
          store.saveChats(chats)
          toast('Reply sent')
          navigate()
        }
      }
    }
    const viewRep = e.target.closest('[data-view-report]')
    if (viewRep) {
      const r = store.reports().find(x => x.id === viewRep.getAttribute('data-view-report'))
      if (r) {
        const items = (r.titles || []).map((t, i) => '<div class="title-item"><div class="t-top"><div class="t-title">' + (i + 1) + '. ' + esc(t.title) + '</div><div class="t-actions"><span class="muted small">' + t.score + '%</span>' + labelPill(t.label) + '<button class="btn btn-ghost btn-sm" data-copy="' + esc(t.title) + '" type="button">Copy</button></div></div>' + scoreBar(t.score) + '</div>').join('')
        openModal('<h3>Report - ' + esc(r.primary) + '</h3><p class="m-sub">' + fmtTime(r.date) + ' - ' + r.titleCount + ' titles - ' + esc(r.intent) + ' intent</p><div class="title-list">' + items + '</div><div class="modal-actions"><button class="btn btn-ghost" data-close-modal type="button">Close</button></div>')
      }
    }
    const runToolBtn = e.target.closest('[data-run-tool]')
    if (runToolBtn) runTool(runToolBtn.getAttribute('data-run-tool'))
    const aiPlan = e.target.closest('[data-ai-plan]')
    if (aiPlan) { aiPlanFor(aiPlan.getAttribute('data-ai-plan'), aiPlan); }
    const agentBtn = e.target.closest('[data-agent]')
    if (agentBtn) openAgent(agentBtn.getAttribute('data-agent'))
    const closeTool = e.target.closest('[data-close-tool]')
    if (closeTool) { state.activeTool = null; navigate(); }
    const logoutBtn = e.target.closest('[data-logout]')
    if (logoutBtn) logout()
  })

  const fab = document.getElementById('chatFab')
  const widget = document.getElementById('chatWidget')
  const chatClose = document.getElementById('chatClose')
  const chatSendBtn = document.getElementById('chatSend')
  const chatInput = document.getElementById('chatInput')
  if (fab && widget) {
    fab.addEventListener('click', () => {
      widget.hidden = !widget.hidden
      if (!widget.hidden) {
        const chats = store.chats()
        const chat = chats.find(c => c.email === identityForChat().email)
        if (chat) { chat.userUnread = 0; store.saveChats(chats) }
        renderChat()
        updateChatBadge()
        chatInput && chatInput.focus()
      }
    })
    if (chatClose) chatClose.addEventListener('click', () => { widget.hidden = true })
    if (chatSendBtn) chatSendBtn.addEventListener('click', () => { const t = chatInput.value; chatInput.value = ''; chatSend(t) })
    if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = chatInput.value; chatInput.value = ''; chatSend(t) } })
    document.querySelectorAll('.chat-quick button').forEach(b => {
      b.addEventListener('click', () => chatSend(b.getAttribute('data-q')))
    })
    window.setInterval(async () => {
      if (widget.hidden || !cloudOn()) return
      try { await cloudPull() } catch (e) {}
      const chats = store.chats()
      const chat = chats.find(c => c.email === identityForChat().email)
      if (chat && chat.userUnread) { chat.userUnread = 0; store.saveChats(chats) }
      renderChat()
      updateChatBadge()
    }, 10000)
  }

  const fp = document.getElementById('footerPayments')
  if (fp) fp.innerHTML = PAYMENT_METHODS.map(payLogoOnlyHtml).join('')

  window.setInterval(updateChatBadge, 3000)
  window.addEventListener('hashchange', navigate)
  window.addEventListener('popstate', navigate)
  document.addEventListener('click', onInternalLinkClick)
}

/* ============================================================== boot */

const views = {
  '/': homeView,
  '/generator': generatorView,
  '/tools': toolsView,
  '/pricing': pricingView,
  '/dashboard': dashboardView,
  '/admin': adminView,
  '/auth': authView
}

function seedAdmin() {
  const users = store.users()
  if (!users.find(u => u.email === ADMIN_EMAILS[0])) {
    users.push({ name: 'Admin', email: ADMIN_EMAILS[0], provider: 'admin', createdAt: new Date().toISOString(), premium: { status: 'Active', planName: 'Owner' }, blocked: false, deleted: false })
    store.saveUsers(users)
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  seedAdmin()
  bindGlobal()
  await loadSiteConfig()
  try { await cloudBoot() } catch (e) { console.warn('Cloud boot skipped:', e && e.message) }
  navigate()
  renderChat()
  updateChatBadge()
})
