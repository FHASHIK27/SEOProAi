# SEO Service Provider - Deployment & SEO Guide

সম্পূর্ণ ফ্রি (Lifetime Free) Jamstack আর্কিটেকচার:

| স্তর | প্রযুক্তি | হোস্ট | খরচ |
|------|-----------|-------|------|
| Frontend | HTML/CSS/JS (static) | Vercel | Free |
| API / Backend logic | Vercel Serverless Function (Express) | Vercel | Free |
| Database + Auth | Supabase (PostgreSQL) | Supabase | Free |

একই GitHub রিপো পুশ করলে Vercel দুটোই সার্ভ করবে: স্ট্যাটিক ফাইল + `/api/*` সার্ভারলেস ফাংশন। আলাদা Node হোস্ট (Render) বাধ্যতামূলক নয়, তবে চাইলে ব্যবহার করা যায়।

---

## 1. প্রজেক্ট স্ট্রাকচার

```
/                          রুট - এটাই Vercel প্রজেক্ট
├── index.html             SPA शेল + SEO মেটা/OG/JSON-LD + কনফিগ ভ্যারিয়েবল
├── app.js                 সম্পূর্ণ ফ্রন্টএন্ড লজিক (views, store, admin, auth)
├── style.css              স্টাইল
├── supabase-client.js     ঐচ্ছিক ক্লাউড ডাটা লেয়ার (key সেট থাকলে চালু হয়)
├── robots.txt             সার্চ ইঞ্জিন ক্রলার নির্দেশনা
├── sitemap.xml            সাইট ম্যাপ
├── og-image.svg           সোশ্যাল শেয়ার ইমেজ (পরে 1200x630 PNG করুন)
├── dev-server.js          শুধু লোকাল ডেভ সার্ভার (:8000), প্রোডাকশনে যায় না
├── package.json           root deps (express, cors, dotenv, nodemailer) + build স্ক্রিপ্ট
├── scripts/
│   └── build.mjs          minify/build -> dist/
├── api/
│   ├── index.js           Vercel serverless entry (/api)
│   └── [...path].js       catch-all entry (/api/<anything>)
├── backend/
│   ├── server.js          Express অ্যাপ - সব API route ও গোপন key এখানে
│   ├── ziptools/          owner dev-console এর export/import (প্রোডাকশনে বন্ধ)
│   └── .env.example        env টেমপ্লেট (আসল .env কখনো কমিট হবে না)
├── supabase/
│   └── schema.sql         টেবিল + Row Level Security পলিসি
├── vercel.json            build/output/headers/functions কনফিগ
├── .vercelignore          গোপন ফাইল ও dist বাদ দেয়
└── DEPLOYMENT.md          এই গাইড
```

---

## 2. লোকাল রান (আগে নিজে টেস্ট করুন)

```bash
# ব্যাকএন্ড ডিপেন্ডেন্সি (রুটেই আছে, তবু নিশ্চিত হোন)
npm install

# ব্যাকএন্ড (.env বানান backend/.env.example থেকে)
cd backend && node server.js
# => http://localhost:4000

# অন্য টার্মিনালে ফ্রন্টএন্ড dev সার্ভার
node dev-server.js
# => http://localhost:8000
```

`index.html`-এ `window.SEOPRO_API_BASE = ''` থাকলে dev-server নিজেই `/api/*` কে `:4000`-এ প্রক্সি করে।

---

## 3. ডাটাবেজ সেটআপ (Supabase)

### 3.1 প্রজেক্ট ও Schema

1. https://supabase.com এ ফ্রি প্রজেক্ট খুলুন।
2. Dashboard -> SQL Editor -> `supabase/schema.sql` এর পুরো কোড পেস্ট করে Run করুন।
   - `profiles`, `payments`, `reports`, `chats` টেবিল এবং Row Level Security (RLS) তৈরি হবে।
   - RLS নিশ্চিত করে প্রতিটি ইউজার শুধু নিজের ডাটা পড়তে/লিখতে পারে; অ্যাডমিন সব পড়তে পারে।

### 3.2 Auth চালু ও অ্যাডমিন বানানো

1. Authentication -> Providers -> Email চালু করুন (Confirm email ইচ্ছেমতো)।
2. সাইটে ঐ ইমেইল দিয়ে সাইন-আপ করুন, তারপর SQL Editor-এ:

```sql
update public.profiles set role = 'admin'
where email = 'admin@seo-service-provider.com';
```

### 3.3 .env ফরম্যাট

ফ্রন্টএন্ডের পাবলিক key (anon key amar আনা নিরাপদ, RLS দিয়ে সুরক্ষিত) `index.html`-এ দিন:

```html
<script>
  window.SEOPRO_API_BASE = '';                 <!-- same-origin /api -->
  window.SEOPRO_SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
  window.SEOPRO_SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
</script>
```

ব্যাকএন্ডের গোপন key `backend/.env` (বা Vercel Environment Variables)-এ দিন:

```env
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY    # কখনো ফ্রন্টএন্ডে দেবেন না
ALLOWED_ORIGINS=https://your-site.vercel.app,https://yourdomain.com
ENABLE_DEV_ROUTES=0
ADMIN_EMAILS=admin@seo-service-provider.com
ADMIN_PASSWORD=একটা-শক্ত-পাসওয়ার্ড
ADMIN_SECRET=লম্বা-র্যান্ডম-সিক্রেট
```

key সেট থাকলেই `supabase-client.js` স্বয়ংক্রিয়ভাবে ক্লাউড মোড চালু করে; না থাকলে localStorage ফলব্যাক (ডেমো) হিসেবে চলে।

---

## 4. ব্যাকএন্ড ও API রুট

সব রুট `backend/server.js`-এ (Express)। Vercel এ `api/index.js` ও `api/[...path].js` শুধু অ্যাপটি ইমপোর্ট করে:

```js
// api/index.js
import app from '../backend/server.js'
export default app
```

```js
// api/[...path].js  -> /api/<anything> সব ধরে
import app from '../backend/server.js'
export default app
```

`vercel.json` ফাংশনে `includeFiles: backend/**` দেওয়া আছে তাই সোর্স ফাংশনের সাথে বান্ডল হয়, কিন্তু `dist/`-এ যায় না, ফলে কেউ ডাউনলোড করতে পারে না।

প্রধান এন্ডপয়েন্ট:

| Method | Route | কাজ |
|--------|-------|-----|
| GET  | `/api/health` | হেলথ চেক |
| POST | `/api/admin/login` | অ্যাডমিন পাসওয়ার্ড যাচাই, সাইনড টোকেন রিটার্ন |
| GET  | `/api/admin/verify` | টোকেন যাচাই (`x-admin-token`) |
| POST | `/api/crypto/verify` | অন-চেইন পেমেন্ট যাচাই |
| POST | `/api/analyze`, `/api/keywords`, ... | SEO অ্যানালাইসিস (SerpApi/PageSpeed/Gemini) |
| \*   | `/api/dev/*` | owner dev console (প্রোডাকশনে `ENABLE_DEV_ROUTES=0` থাকলে বন্ধ) |

সার্ভারলেসে `app.listen` চলে না (`if (!process.env.VERCEL)`), `export default app` Vercel হ্যান্ডল করে।

---

## 5. GitHub পুশ + Vercel ডিপ্লoy

### 5.1 প্রথমবার Git সেটআপ

```bash
cd /workspace
git init
git add .
git commit -m "feat: SEOPro AI full-stack (Vercel serverless + Supabase-ready)"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

পুশের আগে নিশ্চিত করুন `backend/.env` ট্র্যাক হয়নি (`.gitignore`-এ `**/.env` আছে):

```bash
git status --porcelain | grep -F '.env'
```

### 5.2 Vercel-এ ইমপোর্ট

1. https://vercel.com/new -> GitHub রিপো সিলেক্ট করুন।
2. Framework Preset: **Other**।
3. Build Command: `node scripts/build.mjs` (vercel.json থেকেই আসবে)।
4. Output Directory: `dist`।
5. Deploy চাপুন।

### 5.3 Environment Variables (Vercel Dashboard -> Settings -> Environment Variables)

উপরে 3.3-এর তালিকা যোগ করুন। অন্তত: `ADMIN_PASSWORD`, `ADMIN_SECRET`, `ALLOWED_ORIGINS`, `ENABLE_DEV_ROUTES=0`, এবং চাইলে `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SERPAPI_API_KEY`, `PAGESPEED_API_KEY`, `GEMINI_API_KEY`।

### 5.4 কাস্টম ডোমেইন

Vercel -> Settings -> Domains -> আপনার ডোমেইন যোগ করুন। এরপর `ALLOWED_ORIGINS`-এ ডোমেইনটি দিয়ে Redeploy করুন এবং নিচের ফাইলগুলোর example URL আসল ডোমেইনে বদলান:

- `robots.txt` (Sitemap লাইন)
- `sitemap.xml` (`<loc>`)
- `index.html` (canonical/OG; রানটাইমে `location.origin` দিয়ে অটো-ঠিক হয়)

### 5.5 (বিকল্প) আলাদা Node হোস্ট

Vercel সার্ভারলেস বাদ দিয়ে backend আলাদা চালাতে চাইলে: Render/Railway-তে নতুন Web Service, Root Directory `backend`, Build `npm install`, Start `npm start`, Health `/api/health`, তারপর `index.html`-এ `window.SEOPRO_API_BASE = 'https://your-backend.onrender.com'`।

---

## 6. অ্যাডমিন লগইন

- `https://yourdomain.com/#/admin` খুলুন।
- `ADMIN_EMAILS` + `ADMIN_PASSWORD` (সার্ভার env) দিয়ে লগইন।
- পাসওয়ার্ড কখনো পেজ সোর্সে থাকে না; সার্ভার সাইনড, এক্সপায়ারিং টোকেন দেয়।
- ট্যাব: Users (block/unblock/delete->Trash), Premium (ক্রেতা তালিকা + তারিখভিত্তিক সেলস + মোট আয়), Trash (recover/purge), Payments, Live Chat, Development।

---

## 7. SEO (গুগলে ইনডেক্স)

### 7.1 Meta ট্যাগ (index.html-এ আগেই আছে)

`index.html` `<head>`-এ আছে: title, description, keywords, canonical, Open Graph, Twitter card, theme-color, JSON-LD। রানটাইমে canonical/OG URL `location.origin` দিয়ে আপডেট হয়।

Favicon যোগ করুন (না থাকলে):

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/og-image.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### 7.2 Sitemap

`/sitemap.xml` আগেই আছে। পেজ বাড়লে লিস্ট আপডেট করুন:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://yourdomain.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
```

### 7.3 robots.txt

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: https://yourdomain.com/sitemap.xml
```

### 7.4 Google Search Console

1. https://search.google.com/search-console -> Add property -> URL prefix -> `https://yourdomain.com`।
2. যাচাই: HTML tag হলে `index.html` `<head>`-এ দিন, অথবা DNS TXT রেকর্ড দিন।
3. Sitemaps -> `sitemap.xml` সাবমিট করুন।
4. URL Inspection -> `https://yourdomain.com/` -> Request Indexing।
5. Bing Webmaster Tools-এও একই ভাবে সাবমিট করুন (Bing/DDG কভারেজ)।

দ্রুত ইনডেক্স টিপস: সোশ্যাল/ফোরামে শেয়ার করুন, পেজ লোড ফাস্ট রাখুন (build minify করে), ভাঙা লিংক এড়িয়ে চলুন।

---

## 8. Build, Minify ও ক্যাশ

```bash
# dist/ বানানো (terser দিয়ে app.js/supabase-client.js minify + CSS minify)
node scripts/build.mjs
```

- আউটপুট: `dist/app.min.js`, `dist/style.min.css`, `dist/supabase-client.js`, `index.html`, `robots.txt`, `sitemap.xml`, `og-image.svg`।
- `index.html` অ্যাসেট ভার্সন (`?v=20260907i`) বদলে দিলে ভিজিটর নতুন ফাইল পায়। ফাইল এডিটের পর `scripts/build.mjs`-এ `VERSION` বাড়ান।

---

## 9. নিরাপত্তা চেকলিস্ট (প্রোডাকশনের আগে)

- [ ] `ENABLE_DEV_ROUTES=0` সেট করা (owner dev console বন্ধ)।
- [ ] শক্ত `ADMIN_PASSWORD` + লম্বা `ADMIN_SECRET` দেওয়া।
- [ ] `ADMIN_EMAILS` আসল অ্যাডমিন ইমেইলে সেট।
- [ ] `ALLOWED_ORIGINS`-এ শুধু নিজের ডোমেইন।
- [ ] `SUPABASE_SERVICE_ROLE_KEY` শুধু সার্ভার env-এ, ফ্রন্টএন্ডে নয়।
- [ ] `backend/.env` Git-এ কমিট হয়নি।
- [ ] Supabase RLS চালু (schema.sql চালালেই হয়) এবং admin role আপডেট করা।
- [ ] `robots.txt`/`sitemap.xml`-এ আসল ডোমেইন বসানো।
```
