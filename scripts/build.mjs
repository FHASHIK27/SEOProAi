import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const VERSION = '20260907i'

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
write('index.html', html)

// ---- static assets ----
for (const f of ['robots.txt', 'sitemap.xml', 'og-image.svg']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f))
}

console.log('Build complete -> dist/')
console.log('  app.min.js', (fs.statSync(path.join(DIST, 'app.min.js')).size / 1024).toFixed(1) + 'kb')
console.log('  style.min.css', (fs.statSync(path.join(DIST, 'style.min.css')).size / 1024).toFixed(1) + 'kb')
console.log('  supabase-client.js', (fs.statSync(path.join(DIST, 'supabase-client.js')).size / 1024).toFixed(1) + 'kb')
console.log('  index.html + robots.txt + sitemap.xml + og-image.svg')
