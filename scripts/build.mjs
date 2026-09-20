import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const VERSION = '20260907i'
const PLACEHOLDER = 'https://seo-service-provider.example'

// Resolve the real public origin at build time so canonical/OG/sitemap/robots
// never ship the placeholder domain. On Vercel these env vars are provided
// automatically; locally (or on other hosts) set SITE_URL to override.
const RAW_SITE = (process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim()
const SITE_ORIGIN = RAW_SITE
  ? (/^https?:\/\//i.test(RAW_SITE) ? RAW_SITE : 'https://' + RAW_SITE).replace(/\/+$/, '')
  : ''

function withSite(text) {
  return SITE_ORIGIN ? text.split(PLACEHOLDER).join(SITE_ORIGIN) : text
}

fs.mkdirSync(DIST, { recursive: true })

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8') }
function write(p, s) { fs.writeFileSync(path.join(DIST, p), s) }

// ---- JS: terser (mangle + compress) ----
function minifyJs(code) {
  try {
    return execFileSync('npx', ['--yes', 'terser', '-c', '-m', 'toplevel'], {
      input: code, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
    })
  } catch (e) {
    console.warn('terser failed, using original app.js:', e.message)
    return code
  }
}

// ---- CSS: conservative minify ----
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim()
}

const appJs = read('app.js')
const styleCss = read('style.css')
write('app.min.js', minifyJs(appJs))
write('style.min.css', minifyCss(styleCss))
write('supabase-client.js', minifyJs(read('supabase-client.js')))

// ---- HTML: point to minified assets ----
let html = read('index.html')
html = html
  .replace(/style\.css\?v=[0-9a-z]+/g, 'style.min.css?v=' + VERSION)
  .replace(/app\.js\?v=[0-9a-z]+/g, 'app.min.js?v=' + VERSION)
  .replace(/supabase-client\.js\?v=[0-9a-z]+/g, 'supabase-client.js?v=' + VERSION)
write('index.html', withSite(html))

// ---- prerender crawlable HTML for public routes ----
const PRERENDER = [
  {
    path: '/generator',
    title: 'Free SEO Title Generator - 10 AI Titles with Scores',
    desc: 'Generate 10 click-worthy SEO titles from one primary keyword, each scored for length, power words and search intent. Free to try.',
    h1: 'Free SEO Title Generator',
    body: '<p>Type one primary keyword and get 10 SEO-optimized title ideas instantly. Every title is scored for ideal pixel length, power words and search intent so you can pick the best one without guessing.</p>' +
      '<ul><li>10 unique title variations per keyword</li><li>Live length and pixel-width scoring</li><li>Power-word and intent labels</li><li>Copy-ready titles for your CMS</li></ul>' +
      '<p><a href="/dashboard">Open the generator</a> - free and no credit card required.</p>'
  },
  {
    path: '/tools',
    title: 'Free SEO Tools - Keyword, SERP, PageSpeed & SEO Audit',
    desc: 'Run real SEO analysis: keyword research, SERP analyzer, competitor analysis, People-Also-Ask questions, PageSpeed and a full SEO audit.',
    h1: 'Free SEO Tools for Real Analysis',
    body: '<p>Ten practical SEO tools in one place. Each one returns real analysis so you can act on it immediately instead of reading filler.</p>' +
      '<ul><li>SEO Title Generator</li><li>Meta Description Generator</li><li>Keyword Research</li><li>SERP Analyzer</li><li>Competitor Analysis</li><li>People-Also-Ask Questions</li><li>PageSpeed Checker</li><li>Full SEO Audit</li><li>Local SEO Check</li><li>Rank Tracker</li></ul>' +
      '<p><a href="/dashboard">Launch a tool</a> or <a href="/pricing">compare plans</a>.</p>'
  },
  {
    path: '/pricing',
    title: 'Pricing & Plans - SEO Service Provider',
    desc: 'Simple SEO plans for freelancers and agencies. Unlock more AI agents, higher daily credits and priority usage. Pay by mobile, bank or crypto.',
    h1: 'Simple SEO Pricing &amp; Plans',
    body: '<p>Start free, then upgrade when you need more AI agents, higher daily credits and priority processing. No hidden fees.</p>' +
      '<ul><li>Free - core tools and limited daily credits</li><li>Starter - more agents and higher limits</li><li>Pro - priority AI usage for freelancers</li><li>Agency - high-volume credits for teams</li></ul>' +
      '<p><a href="/dashboard">Create a free account</a> to begin.</p>'
  }
]

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderPage(baseHtml, route) {
  const url = PLACEHOLDER + (route.path === '/' ? '/' : route.path)
  const title = escapeHtml(route.title)
  const desc = escapeHtml(route.desc)
  let out = baseHtml
  out = out.replace(/<title>[\s\S]*?<\/title>/, '<title>' + title + '</title>')
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + desc + '$2')
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + url + '$2')
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + title + '$2')
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + desc + '$2')
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, '$1' + url + '$2')
  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/, '$1' + title + '$2')
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, '$1' + desc + '$2')
  const block = '<section class="prerender container"><h1>' + route.h1 + '</h1>' + route.body + '</section>'
  out = out.replace('<main class="main" id="mainView"></main>', '<main class="main" id="mainView">' + block + '</main>')
  return withSite(out)
}

for (const route of PRERENDER) {
  const rel = route.path === '/' ? 'index.html' : route.path.replace(/^\//, '') + '.html'
  const abs = path.join(DIST, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, renderPage(html, route))
}

// ---- static assets ----
for (const f of ['robots.txt', 'sitemap.xml', 'og-image.svg']) {
  if (!fs.existsSync(path.join(ROOT, f))) continue
  if (f === 'og-image.svg') { fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f)); continue }
  write(f, withSite(read(f)))
}

console.log('Public origin: ' + (SITE_ORIGIN || '(placeholder - set SITE_URL on your host)'))

console.log('Build complete -> dist/')
console.log('  app.min.js', (fs.statSync(path.join(DIST, 'app.min.js')).size / 1024).toFixed(1) + 'kb')
console.log('  style.min.css', (fs.statSync(path.join(DIST, 'style.min.css')).size / 1024).toFixed(1) + 'kb')
console.log('  supabase-client.js', (fs.statSync(path.join(DIST, 'supabase-client.js')).size / 1024).toFixed(1) + 'kb')
console.log('  index.html + robots.txt + sitemap.xml + og-image.svg')
console.log('  prerendered: /generator, /tools, /pricing (+ SPA routes via rewrite)')
