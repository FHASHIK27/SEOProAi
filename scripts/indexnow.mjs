// Submit all public URLs to IndexNow (Bing, Yandex, Seznam, Naver and others).
// Run AFTER deploying, so the hosted key file /<key>.txt is already live.
//
//   node scripts/indexnow.mjs
//
// Override the target with SITE_URL if needed.

import fs from 'node:fs'
import { SPA_PAGES, STATIC_PAGES } from './seo-content.mjs'

const ORIGIN = (process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://seo-pro-ai.vercel.app').replace(/\/+$/, '')
const key = fs.readFileSync(new URL('../indexnow-key.txt', import.meta.url), 'utf8').trim().split(/\s+/)[0]
if (!key) { console.error('indexnow-key.txt is empty'); process.exit(1) }

const host = new URL(ORIGIN).host
const urlList = [...SPA_PAGES, ...STATIC_PAGES].map(p => ORIGIN + (p.path === '/' ? '/' : p.path))

async function submit(endpoint) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: ORIGIN + '/' + key + '.txt', urlList })
    })
    console.log(endpoint + ' -> ' + res.status + ' ' + res.statusText)
  } catch (e) {
    console.error(endpoint + ' -> failed: ' + e.message)
  }
}

console.log('Host: ' + host)
console.log('URLs: ' + urlList.length)
await submit('https://api.indexnow.org/indexnow')
await submit('https://www.bing.com/indexnow')
await submit('https://yandex.com/indexnow')
