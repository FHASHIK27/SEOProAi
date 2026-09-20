import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = process.env.PORT || 8000
const ROOT = process.cwd()
const API_TARGET = process.env.API_TARGET || 'http://localhost:4000'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
}

// Only these public site files are ever served. Everything else (backend source,
// backend/.env, .git, node_modules, dotfiles) is NOT reachable over HTTP.
const PUBLIC_FILES = new Set(['/index.html', '/app.js', '/style.css', '/supabase-client.js', '/robots.txt', '/sitemap.xml', '/og-image.svg'])

const BAD_UA = /(sqlmap|nikto|nmap|masscan|zgrab|acunetix|nessus|openvas|dirbuster|gobuster|wfuzz|ffuf|hydra|medusa|metasploit|havij|commix|xray|nuclei)/i
const BAD_PATH = /(^|\/)(wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|pma|phpunit|\.env|\.git|\.ssh|\.aws|\.docker|\.htaccess|actuator|\.ds_store)(\/|$)/i

function clientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (xf) return String(xf).split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

const hits = new Map()
function rateLimited(req, max, windowMs) {
  const key = clientIp(req)
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
  arr.push(now)
  hits.set(key, arr)
  if (arr.length > max) return Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000))
  return 0
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of hits) {
    const fresh = v.filter(t => now - t < 10 * 60 * 1000)
    if (fresh.length) hits.set(k, fresh); else hits.delete(k)
  }
}, 120000).unref()

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://esm.sh",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' http://localhost:4000 http://127.0.0.1:4000 https://*.monkeycode-ai.live https://*.supabase.co wss://*.supabase.co https://esm.sh",
    "frame-ancestors 'self' https://*.monkeycode-ai.live",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '))
}

function deny(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ status: 'Error', error: message || (code === 404 ? 'Not found' : 'Request blocked') }))
}

function proxy(req, res) {
  const target = new URL(API_TARGET + req.url)
  const preq = http.request(target, {
    method: req.method,
    headers: { ...req.headers, host: target.host }
  }, (pres) => {
    res.writeHead(pres.statusCode, pres.headers)
    pres.pipe(res)
  })
  preq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'Error', reason: 'Backend unreachable via proxy' }))
  })
  req.pipe(preq)
}

http.createServer((req, res) => {
  securityHeaders(res)

  const ua = String(req.headers['user-agent'] || '')
  let rawPath
  try {
    rawPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch (e) {
    return deny(res, 400, 'Bad request')
  }

  if (BAD_UA.test(ua) || BAD_PATH.test(rawPath)) return deny(res, 404, 'Not found')

  if (req.url.startsWith('/api/')) {
    const retry = rateLimited(req, 300, 5 * 60 * 1000)
    if (retry) { res.setHeader('Retry-After', String(retry)); return deny(res, 429, 'Too many requests. Please slow down.') }
    return proxy(req, res)
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return deny(res, 405, 'Method not allowed')
  }

  const retry = rateLimited(req, 600, 5 * 60 * 1000)
  if (retry) { res.setHeader('Retry-After', String(retry)); return deny(res, 429, 'Too many requests. Please slow down.') }

  const ROUTE_FALLBACKS = new Set(['/generator', '/tools', '/pricing', '/dashboard', '/admin', '/auth'])
  let urlPath = rawPath === '/' ? '/index.html' : rawPath
  if (ROUTE_FALLBACKS.has(urlPath)) urlPath = '/index.html'
  if (!PUBLIC_FILES.has(urlPath)) return deny(res, 404, 'Not found')

  const filePath = path.normalize(path.join(ROOT, urlPath))
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return deny(res, 403, 'Forbidden')
  serve(filePath, res)
}).listen(PORT, '0.0.0.0', () => {
  console.log('Dev server on http://localhost:' + PORT)
  console.log('API proxy -> ' + API_TARGET)
  console.log('Static allowlist: ' + [...PUBLIC_FILES].join(', '))
})

function serve(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) return deny(res, 404, 'Not found')
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(data)
  })
}
