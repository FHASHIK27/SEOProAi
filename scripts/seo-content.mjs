// Central SEO content for build-time prerendering.
// Every public route here becomes a crawlable HTML file in dist/.
// `key` groups translations so hreflang alternates can be generated.

export const UPDATED = '2026-09-26'

const HOME_FAQ = [
  {
    q: 'Are the SEO tools really free?',
    a: 'Yes. The core tools - title generator, meta description generator, keyword research and the SEO audit - are free to use. You only need an account to save history and raise your daily limits, and no credit card is required.'
  },
  {
    q: 'Does SEO Service Provider use fabricated data?',
    a: 'No. Every score comes from real analysis. Keyword and SERP data come from live providers, PageSpeed comes from the Google PageSpeed Insights API, and we never invent numbers to make results look better.'
  },
  {
    q: 'Do I need to install anything?',
    a: 'No installation is required. All tools run in your browser and talk to our API, so you can start from any device.'
  },
  {
    q: 'Is my data safe?',
    a: 'API keys stay on the server, accounts and payments are stored with Row Level Security, and we never expose provider keys to the browser.'
  }
]

const PRICING_FAQ = [
  {
    q: 'Can I start for free?',
    a: 'Yes. The Free plan gives you the core tools and a daily credit allowance. Upgrade only when you need more AI agent runs and higher limits.'
  },
  {
    q: 'Which payment methods do you accept?',
    a: 'Mobile wallets, bank transfer and crypto are supported. You submit the Binance order ID, transaction hash or a screenshot, and an admin verifies it.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Plans are prepaid with no lock-in, so you simply do not renew when you no longer need it.'
  }
]

export const SPA_PAGES = [
  {
    path: '/',
    key: 'home',
    lang: 'en',
    type: 'website',
    updated: UPDATED,
    title: 'Free SEO Tools & AI Agents - SEO Service Provider',
    desc: 'Free SEO tools and AI agents with real analysis. Generate SEO titles, research keywords, analyze SERPs, check PageSpeed and audit your site - all in one place.',
    h1: 'Free SEO Tools &amp; AI Agents with Real Analysis',
    body:
      '<p>SEO Service Provider brings 10 practical SEO tools and 19 AI agents into one dashboard. Every result is based on real data - keyword suggestions, SERP results, PageSpeed scores and audits - so you can act on it instead of guessing.</p>' +
      '<h2>What you can do here</h2>' +
      '<ul><li><a href="/generator">SEO title generator</a> - 10 scored title ideas from one keyword</li>' +
      '<li><a href="/tools">SEO tools</a> - keyword research, SERP analyzer, competitor analysis, People-Also-Ask, PageSpeed, local SEO and rank tracking</li>' +
      '<li><a href="/guides">SEO guides</a> - step-by-step tutorials for beginners</li>' +
      '<li><a href="/pricing">Plans</a> - start free and upgrade when you need more</li></ul>' +
      '<h2>Why people use it</h2>' +
      '<p>Most free tools return placeholder numbers. This one does not. Each score is calculated from live data, so two runs on the same keyword can differ - because the SERP itself changed. That is the point of doing real SEO.</p>' +
      '<p><a href="/dashboard">Create a free account</a> and run your first analysis in under a minute. Bengali speakers can read the <a href="/bn/guides">Bengali SEO guides</a>.</p>',
    faq: HOME_FAQ,
    breadcrumb: [{ name: 'Home', url: '/' }]
  },
  {
    path: '/generator',
    key: 'generator',
    lang: 'en',
    type: 'website',
    updated: UPDATED,
    title: 'Free SEO Title Generator - 10 AI Titles with Scores',
    desc: 'Generate 10 click-worthy SEO titles from one primary keyword, each scored for length, power words and search intent. Free to try, no credit card.',
    h1: 'Free SEO Title Generator',
    body:
      '<p>Type one primary keyword and get 10 SEO-optimized title ideas instantly. Every title is scored for ideal pixel length, power words and search intent so you can pick the best one without guessing.</p>' +
      '<ul><li>10 unique title variations per keyword</li><li>Live length and pixel-width scoring</li><li>Power-word and intent labels</li><li>Copy-ready titles for your CMS</li></ul>' +
      '<h2>How the score works</h2>' +
      '<p>Each title is checked against the pixel width Google actually shows in results, then rewarded for a clear primary keyword, a strong hook and a matching search intent. Titles that get truncated or bury the keyword are marked down.</p>' +
      '<p><a href="/dashboard">Open the generator</a> - free and no credit card required. New to titles? Read <a href="/guides/free-seo-title-generator-guide">how to use a free SEO title generator</a>.</p>',
    faq: [
      {
        q: 'How many titles does the generator create?',
        a: 'Ten variations from a single primary keyword, each with its own score so you can compare them side by side.'
      },
      {
        q: 'What length should an SEO title be?',
        a: 'Aim for roughly 50-60 characters or about 580 pixels, so Google does not cut it off in search results.'
      },
      {
        q: 'Is the title generator free?',
        a: 'Yes. You can generate titles for free; an account just saves your history and raises daily limits.'
      }
    ],
    breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Title Generator', url: '/generator' }]
  },
  {
    path: '/tools',
    key: 'tools',
    lang: 'en',
    type: 'website',
    updated: UPDATED,
    title: 'Free SEO Tools - Keyword, SERP, PageSpeed & SEO Audit',
    desc: 'Run real SEO analysis: keyword research, SERP analyzer, competitor analysis, People-Also-Ask questions, PageSpeed and a full SEO audit.',
    h1: 'Free SEO Tools for Real Analysis',
    body:
      '<p>Ten practical SEO tools in one place. Each one returns real analysis so you can act on it immediately instead of reading filler.</p>' +
      '<ul><li>SEO Title Generator</li><li>Meta Description Generator</li><li>Keyword Research</li><li>SERP Analyzer</li><li>Competitor Analysis</li><li>People-Also-Ask Questions</li><li>PageSpeed Checker</li><li>Full SEO Audit</li><li>Local SEO Check</li><li>Rank Tracker</li></ul>' +
      '<h2>Where the data comes from</h2>' +
      '<p>Keyword and SERP data come from live search providers, PageSpeed comes from the Google PageSpeed Insights API, and audits combine real on-page checks with those signals. Nothing is randomized.</p>' +
      '<p><a href="/dashboard">Launch a tool</a> or <a href="/pricing">compare plans</a>. Prefer reading first? Start with <a href="/guides/keyword-research-basics">keyword research basics</a>.</p>',
    faq: [
      {
        q: 'Which SEO tools are included?',
        a: 'Title generator, meta description generator, keyword research, SERP analyzer, competitor analysis, People-Also-Ask finder, PageSpeed checker, full SEO audit, local SEO check and rank tracker.'
      },
      {
        q: 'Are results real or sample data?',
        a: 'Real. Results are fetched from live providers at the moment you run a tool, which is why numbers can change between runs.'
      }
    ],
    breadcrumb: [{ name: 'Home', url: '/' }, { name: 'SEO Tools', url: '/tools' }]
  },
  {
    path: '/pricing',
    key: 'pricing',
    lang: 'en',
    type: 'product',
    updated: UPDATED,
    title: 'Pricing & Plans - SEO Service Provider',
    desc: 'Simple SEO plans for freelancers and agencies. Unlock more AI agents, higher daily credits and priority usage. Pay by mobile, bank or crypto.',
    h1: 'Simple SEO Pricing &amp; Plans',
    body:
      '<p>Start free, then upgrade when you need more AI agents, higher daily credits and priority processing. No hidden fees.</p>' +
      '<ul><li><b>Free</b> - core tools and limited daily credits</li><li><b>Starter</b> - more agents and higher limits</li><li><b>Pro</b> - priority AI usage for freelancers</li><li><b>Agency</b> - high-volume credits for teams</li></ul>' +
      '<p>Payment is verified by an admin within a short time after you submit a Binance order ID, a transaction hash or a screenshot.</p>' +
      '<p><a href="/dashboard">Create a free account</a> to begin, or see <a href="/tools">the full tool list</a>.</p>',
    faq: PRICING_FAQ,
    breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Pricing', url: '/pricing' }]
  }
]

export const PRIVATE_PAGES = [
  {
    path: '/dashboard',
    title: 'Dashboard - SEO Service Provider',
    desc: 'Your private SEO dashboard.'
  },
  {
    path: '/auth',
    title: 'Sign In - SEO Service Provider',
    desc: 'Sign in or create your free SEO Service Provider account.'
  },
  {
    path: '/admin',
    title: 'Admin - SEO Service Provider',
    desc: 'Administration area.'
  }
]

const EN_GUIDES = [
  {
    slug: 'free-seo-title-generator-guide',
    title: 'How to Use a Free SEO Title Generator (2026 Guide)',
    desc: 'Step-by-step guide to writing SEO titles that get clicks: ideal length, power words, search intent and how to use a free title generator.',
    h1: 'How to Use a Free SEO Title Generator',
    excerpt: 'Write titles that rank and get clicked, with a repeatable workflow and a free generator.',
    sections: [
      {
        h2: 'Why your title tag decides your click-through rate',
        p: 'Your title tag is the first thing a searcher reads and often the only thing that decides whether they click your page or a competitor. Google can rewrite it, but a well-written title is far more likely to survive untouched. Getting it right is one of the highest-return minutes you can spend on SEO.'
      },
      {
        h2: 'What makes a good SEO title',
        p: 'Four things matter most: keep the primary keyword near the front, stay within roughly 50-60 characters so it is not truncated, match the searcher intent (informational, commercial or transactional), and add a hook such as a number, a year or a benefit word. Big words alone do not help - clarity wins.',
        list: [
          'Primary keyword near the start',
          'About 50-60 characters, or under ~580 pixels',
          'Intent match: guide, comparison, tool or deal',
          'One clear hook: number, year, benefit or brand'
        ]
      },
      {
        h2: 'Step-by-step: generate and pick titles',
        p: 'Open the free title generator, enter one primary keyword, and run it. You will get ten variations, each scored for length, power words and intent. Compare the scores, then pick the title that reads naturally and promises something a real searcher wants. Do not keyword-stuff - if it sounds robotic to you, it will sound robotic to your visitor.'
      },
      {
        h2: 'Common title mistakes to avoid',
        p: 'The most common mistakes are writing for machines instead of people, using the same title on every page, burying the keyword at the end, and exceeding the visible length so the important words are cut off. Each one costs clicks that you have already earned with your ranking.'
      }
    ],
    faq: [
      { q: 'How long should an SEO title be?', a: 'Aim for about 50-60 characters or roughly 580 pixels so Google shows the whole title in search results.' },
      { q: 'Should the keyword always come first?', a: 'Usually yes, or very close to the start, because it signals relevance fast. Just keep it readable.' },
      { q: 'Can I use the same title on several pages?', a: 'No. Duplicate titles make pages compete with each other. Give every page a unique, descriptive title.' }
    ]
  },
  {
    slug: 'keyword-research-basics',
    title: 'Keyword Research Basics for Beginners (Free Method)',
    desc: 'Learn keyword research from scratch: seed keywords, search intent, long-tail phrases, difficulty and a free workflow you can repeat.',
    h1: 'Keyword Research Basics for Beginners',
    excerpt: 'A beginner-friendly keyword research workflow you can run for free, step by step.',
    sections: [
      {
        h2: 'Start with seed keywords',
        p: 'A seed keyword is the broad topic you already know your audience cares about - for example "SEO tools" or "local SEO". Write down five to ten seeds based on what you sell or explain. You are not trying to be clever here; you are mapping the territory.'
      },
      {
        h2: 'Understand search intent before difficulty',
        p: 'Every keyword carries an intent. Informational searchers want to learn, commercial searchers compare options, transactional searchers are ready to act, and navigational searchers want a specific site. Matching your page type to the intent matters more than chasing the lowest difficulty score.'
      },
      {
        h2: 'Use long-tail phrases to win early',
        p: 'Long-tail keywords are specific, lower-volume phrases such as "free seo title generator for bloggers". They are easier to rank for, convert better, and let a new site build authority before competing on head terms. Collect them from autocomplete, People-Also-Ask and your own customer questions.',
        list: [
          'Low competition, so you can rank sooner',
          'High intent, so visitors convert better',
          'Endless supply from questions and autocomplete'
        ]
      },
      {
        h2: 'A repeatable free workflow',
        p: 'List seeds, expand each into variants with a free keyword tool, label the intent, then pick a cluster you can cover with one strong page. Write, publish, and track the position. Repeat with the next cluster. Consistency beats one-time heroics.'
      }
    ],
    faq: [
      { q: 'How many keywords should I target per page?', a: 'One primary keyword and a handful of closely related secondary terms. Trying to rank one page for many unrelated keywords usually weakens it.' },
      { q: 'Do I need paid tools for keyword research?', a: 'No. Free keyword and People-Also-Ask tools cover the basics well; paid tools help mainly at scale.' },
      { q: 'What is a long-tail keyword?', a: 'A longer, more specific phrase with lower search volume and less competition, which is easier to rank for and often converts better.' }
    ]
  },
  {
    slug: 'local-seo-checklist',
    title: 'Local SEO Checklist: Rank in Google Maps in 2026',
    desc: 'A practical local SEO checklist covering your Google Business Profile, NAP consistency, reviews, local content and citations.',
    h1: 'Local SEO Checklist to Rank in Google Maps',
    excerpt: 'The exact checklist to appear in local pack and Google Maps results.',
    sections: [
      {
        h2: 'Claim and complete your Google Business Profile',
        p: 'Your Google Business Profile is the single biggest local ranking factor you control. Claim it, verify it, choose the most accurate primary category, add your service area, hours, phone number and a real description. Then keep it updated - an abandoned profile ranks poorly.'
      },
      {
        h2: 'Keep your NAP consistent everywhere',
        p: 'Name, address and phone number must be identical on your website, your Google profile and every directory listing. Small differences like "St." versus "Street" create doubt about which business is real and dilute your local signals.'
      },
      {
        h2: 'Collect reviews continuously',
        p: 'Reviews influence both ranking and conversion. Ask happy customers shortly after service, respond to every review, and keep a steady flow rather than a single burst. Volume, recency and your replies all matter.'
      },
      {
        h2: 'Publish local content and citations',
        p: 'Create pages that mention your city or neighbourhood naturally, embed a map, and get listed in relevant local directories. Local content proves you actually serve that area, and local citations reinforce it.',
        list: [
          'A dedicated service page per city you genuinely serve',
          'Embedded map and locally relevant photos',
          'Consistent listings in trusted local directories'
        ]
      }
    ],
    faq: [
      { q: 'How long does local SEO take?', a: 'Profile improvements can show within weeks, but consistent reviews and citations usually take a few months to compound.' },
      { q: 'Do reviews affect Google Maps ranking?', a: 'Yes. Review volume, rating and recency all correlate with stronger local rankings and higher click-through rates.' },
      { q: 'Is a service-area business different?', a: 'Yes. If you travel to customers, hide your street address and set a service area, then keep your NAP consistent for that area.' }
    ]
  },
  {
    slug: 'meta-description-tips',
    title: 'Meta Description Tips That Improve CTR (With Examples)',
    desc: 'Write meta descriptions people actually click: length, action verbs, matching intent, adding numbers and examples, plus a free generator.',
    h1: 'Meta Description Writing Tips',
    excerpt: 'Write descriptions that earn the click, with rules and examples you can copy.',
    sections: [
      {
        h2: 'What a meta description actually does',
        p: 'A meta description is not a direct ranking factor, but it is your sales pitch in the search results. A strong one raises click-through rate, and higher CTR sends positive engagement signals that help over time. Google may rewrite it, so make yours worth keeping.'
      },
      {
        h2: 'Get the length right',
        p: 'Aim for about 140-160 characters so the description is shown in full on desktop and mostly on mobile. Put the most important words and your primary keyword early, because the end can be trimmed.'
      },
      {
        h2: 'Write for the click',
        p: 'Match the searcher intent, use an active verb, and add a specific promise - a number, a timeframe or a benefit. Compare a flat "We offer SEO tools" with "Generate 10 scored SEO titles free in seconds - no signup required." The second one earns the click.',
        list: [
          'Start with a verb: Generate, Learn, Compare, Get',
          'Add a concrete detail: "10 titles", "in 2026", "free"',
          'Match the page exactly - never over-promise'
        ]
      },
      {
        h2: 'Test and refine',
        p: 'Track impressions and CTR in Search Console, find pages with high impressions but low CTR, and rewrite those descriptions first. It is one of the cheapest wins in SEO. Use the free meta description generator to draft several options quickly.'
      }
    ],
    faq: [
      { q: 'Is the meta description a ranking factor?', a: 'Not directly, but it strongly affects click-through rate, which influences engagement and can help rankings over time.' },
      { q: 'How long should a meta description be?', a: 'About 140-160 characters, putting the keyword and key promise near the beginning.' },
      { q: 'What if Google rewrites my description?', a: 'It can, especially when the description does not match the query. Writing a clear, relevant description makes rewrites less likely.' }
    ]
  }
]

const BN_GUIDES = [
  {
    slug: 'free-seo-title-generator-guide',
    title: 'ফ্রি এসইও টাইটেল জেনারেটর কীভাবে ব্যবহার করবেন (২০২৬ গাইড)',
    desc: 'এসইও টাইটেল লেখার ধাপে ধাপে গাইড: সঠিক দৈর্ঘ্য, পাওয়ার ওয়ার্ড, সার্চ ইনটেন্ট এবং ফ্রি টাইটেল জেনারেটর ব্যবহারের নিয়ম।',
    h1: 'ফ্রি এসইও টাইটেল জেনারেটর কীভাবে ব্যবহার করবেন',
    excerpt: 'সহজ ও কার্যকর workflow-তে এমন টাইটেল লিখুন যা র্যাঙ্ক করে এবং ক্লিক পায়।',
    sections: [
      { h2: 'টাইটেল ট্যাগ কেন সবচেয়ে গুরুত্বপূর্ণ', p: 'সার্চ রেজাল্টে ব্যবহারকারী প্রথমে আপনার টাইটেল দেখে। কেউ ক্লিক করবে কি করবে না, তা অনেকটাই নির্ভর করে এই এক লাইনের ওপর। কীওয়ার্ড সঠিকভাবে বসানো টাইটেল Google কম পরিবর্তন করে, তাই এটি সাজাতে সময় দিলে লাভ বেশি।' },
      { h2: 'ভালো এসইও টাইটেলের বৈশিষ্ট্য', p: 'মূল কীওয়ার্ড শুরুতে রাখুন, ৫০-৬০ ক্যারেক্টারের মধ্যে রাখুন যাতে কাটা না পড়ে, সার্চ ইনটেন্টের সাথে মিল রাখুন এবং একটি হুক যোগ করুন - সংখ্যা, বছর বা সুবিধা।', list: ['মূল কীওয়ার্ড শুরুতে', '৫০-৬০ ক্যারেক্টার', 'ইনটেন্ট ম্যাচিং', 'একটি স্পষ্ট হুক'] },
      { h2: 'ধাপে ধাপে টাইটেল বাছাই', p: 'ফ্রি টাইটেল জেনারেটরে একটি মূল কীওয়ার্ড দিন। ১০টি ভিন্ন টাইটেল পাবেন, প্রতিটির স্কোরসহ। স্কোর দেখে সবচেয়ে স্বাভাবিক ও আকর্ষণীয়টি বাছুন। কীওয়ার্ড জোর করে গাদাগাদি করবেন না।' },
      { h2: 'যেসব ভুল এড়াবেন', p: 'একই টাইটেল সব পেজে ব্যবহার, কীওয়ার্ড শেষে ফেলে রাখা, আর দৈর্ঘ্য বেশি হওয়া - এই ভুলগুলো আপনার অর্জিত র্যাঙ্কিং থেকেও ক্লিক কমিয়ে দেয়।' }
    ],
    faq: [
      { q: 'টাইটেল কত লম্বা হওয়া উচিত?', a: 'প্রায় ৫০-৬০ ক্যারেক্টার, যাতে Google পুরো টাইটেল দেখাতে পারে।' },
      { q: 'কীওয়ার্ড কি সর্বদা শুরুতে থাকবে?', a: 'সাধারণত হ্যাঁ, তবে লেখাটি যেন স্বাভাবিক ও পাঠযোগ্য থাকে।' },
      { q: 'একই টাইটেল একাধিক পেজে দেওয়া যাবে?', a: 'না। এতে পেজগুলো একে অন্যের সাথে প্রতিযোগিতা করে; প্রতিটি পেজে আলাদা টাইটেল দিন।' }
    ]
  },
  {
    slug: 'keyword-research-basics',
    title: 'বিগিনারদের জন্য কীওয়ার্ড রিসার্চের বেসিক (ফ্রি পদ্ধতি)',
    desc: 'শূন্য থেকে কীওয়ার্ড রিসার্চ শিখুন: সিড কীওয়ার্ড, সার্চ ইনটেন্ট, লং-টেইল ও ডিফিকাল্টি এবং একটি ফ্রি পুনরাবৃত্ত workflow।',
    h1: 'বিগিনারদের জন্য কীওয়ার্ড রিসার্চের বেসিক',
    excerpt: 'ফ্রিতে যা যা করতে পারেন, ধাপে ধাপে সহজ কীওয়ার্ড রিসার্চ পদ্ধতি।',
    sections: [
      { h2: 'সিড কীওয়ার্ড দিয়ে শুরু', p: 'আপনার অডিয়েন্স যে বিষয়ে আগ্রহী, সেই বিষয়ের ৫-১০টি বড় কীওয়ার্ড লিখে ফেলুন। এখানে চতুর হওয়ার দরকার নেই - পুরো ক্ষেত্রটি চিহ্নিত করাই লক্ষ্য।' },
      { h2: 'ডিফিকাল্টির আগে ইনটেন্ট বুঝুন', p: 'প্রতিটি কীওয়ার্ডের পেছনে একটি ইনটেন্ট থাকে - তথ্য জানতে চাওয়া, তুলনা করা, কেনাকাটা করা বা নির্দিষ্ট সাইট খোঁজা। আপনার পেজের ধরন ইনটেন্টের সাথে মিলিয়ে নেওয়াই সবচেয়ে জরুরি।' },
      { h2: 'লং-টেইল দিয়ে দ্রুত এগিয়ে যান', p: 'নির্দিষ্ট ও কম প্রতিযোগিতার ফ্রেজ দিয়ে নতুন সাইটও ভালো ফল পেতে পারে। Questions ও autocomplete থেকে এগুলো সহজে পাওয়া যায়।', list: ['কম প্রতিযোগিতা', 'বেশি ইনটেন্ট', 'অফুরন্ত আইডিয়া'] },
      { h2: 'পুনরাবৃত্ত ফ্রি workflow', p: 'সিড লিখুন, কীওয়ার্ড টুল দিয়ে ভ্যারিয়েন্ট বানান, ইনটেন্ট লিখুন, একটি ক্লাস্টার বেছে এক পেজে কভার করুন, তারপর পজিশন ট্র্যাক করুন। ধারাবাহিকতা সবচেয়ে বেশি কাজ করে।' }
    ],
    faq: [
      { q: 'প্রতি পেজে কতটি কীওয়ার্ড টার্গেট করব?', a: 'একটি মূল কীওয়ার্ড আর কয়েকটি কাছাকাছি সেকেন্ডারি শব্দ।' },
      { q: 'পেইড টুল ছাড়া কীওয়ার্ড রিসার্চ সম্ভব?', a: 'হ্যাঁ, ফ্রি টুল ও People-Also-Ask দিয়েই বেসিক কাজ হয়ে যায়।' },
      { q: 'লং-টেইল কীওয়ার্ড কী?', a: 'বেশি নির্দিষ্ট, কম ভলিউমের ফ্রেজ, যা সহজে র‍্যাঙ্ক করে এবং ভালো কনভার্ট করে।' }
    ]
  },
  {
    slug: 'local-seo-checklist',
    title: 'লোকাল এসইও চেকলিস্ট: Google Maps-এ র‍্যাঙ্ক করুন',
    desc: 'ব্যবহারিক লোকাল এসইও চেকলিস্ট - Google Business Profile, NAP সামঞ্জস্য, রিভিউ, লোকাল কনটেন্ট ও সাইটেশন।',
    h1: 'লোকাল এসইও চেকলিস্ট',
    excerpt: 'লোকাল প্যাক ও Google Maps-এ আসার জন্য প্রয়োজনীয় ধাপগুলো।',
    sections: [
      { h2: 'Google Business Profile পূরণ করুন', p: 'এটি লোকাল র‍্যাঙ্কিংয়ের সবচেয়ে বড় নিয়ন্ত্রণযোগ্য ফ্যাক্টর। প্রোফাইল দাবি করে ভেরিফাই করুন, সঠিক ক্যাটাগরি, সেবা এলাকা, সময় ও ফোন নম্বর দিন এবং নিয়মিত আপডেট রাখুন।' },
      { h2: 'NAP সামঞ্জস্য রাখুন', p: 'নাম, ঠিকানা ও ফোন নম্বর সব জায়গায় হুবহু এক রাখুন - ওয়েবসাইট, Google প্রোফাইল ও ডিরেক্টরি। ছোট পার্থক্যও সিগন্যাল দুর্বল করে।' },
      { h2: 'নিরবচ্ছিন্ন রিভিউ সংগ্রহ করুন', p: 'রিভিউ র‍্যাঙ্কিং ও কনভার্শন দুইটাই প্রভাবিত করে। সেবার পর পরই ক্রেতার কাছে রিভিউ চান এবং প্রতিটি রিভিউয়ের উত্তর দিন।' },
      { h2: 'লোকাল কনটেন্ট ও সাইটেশন', p: 'যে শহরে সত্যিই সেবা দেন, সেই শহরের জন্য পেজ বানান, ন্যাচারালি নাম উল্লেখ করুন, ম্যাপ যুক্ত করুন এবং নির্ভরযোগ্য লোকাল ডিরেক্টরিতে লিস্ট করুন।', list: ['শহরভিত্তিক সেবা পেজ', 'ম্যাপ ও লোকাল ছবি', 'নির্ভরযোগ্য ডিরেক্টরি লিস্টিং'] }
    ],
    faq: [
      { q: 'লোকাল এসইওতে কত সময় লাগে?', a: 'প্রোফাইল উন্নতি কয়েক সপ্তাহে দেখা যায়, তবে রিভিউ ও সাইটেশন মিলে সাধারণত কয়েক মাস লাগে।' },
      { q: 'রিভিউ কি র‍্যাঙ্কিংয়ে প্রভাব ফেলে?', a: 'হ্যাঁ, রিভিউর সংখ্যা, রেটিং ও নতুনত্ব লোকাল র‍্যাঙ্কিং ও CTR বাড়ায়।' },
      { q: 'সার্ভিস-এরিয়া ব্যবসার ক্ষেত্রে পার্থক্য আছে?', a: 'হ্যাঁ, ঠিকানা লুকিয়ে সার্ভিস এরিয়া সেট করুন এবং সেই এলাকার জন্য NAP সামঞ্জস্য রাখুন।' }
    ]
  },
  {
    slug: 'meta-description-tips',
    title: 'মেটা ডেসক্রিপশন টিপস যা CTR বাড়ায় (উদাহরণসহ)',
    desc: 'এমন মেটা ডেসক্রিপশন লিখুন যা মানুষ সত্যিই ক্লিক করে - দৈর্ঘ্য, অ্যাকশন ভার্ব, ইনটেন্ট ম্যাচ, সংখ্যা ও উদাহরণ।',
    h1: 'মেটা ডেসক্রিপশন লেখার টিপস',
    excerpt: 'ক্লিক পাওয়ার মতো ডেসক্রিপশন লেখার নিয়ম ও উদাহরণ।',
    sections: [
      { h2: 'মেটা ডেসক্রিপশন আসলে কী করে', p: 'এটি সরাসরি র‍্যাঙ্কিং ফ্যাক্টর নয়, কিন্তু সার্চ রেজাল্টে এটি আপনার বিক্রির বার্তা। ভালো ডেসক্রিপশন CTR বাড়ায়, আর উচ্চ CTR সময়ের সাথে র‍্যাঙ্কিংয়ে সাহায্য করে।' },
      { h2: 'দৈর্ঘ্য ঠিক রাখুন', p: 'প্রায় ১৪০-১৬০ ক্যারেক্টার রাখুন যাতে পুরোটা দেখা যায় এবং গুরুত্বপূর্ণ শব্দ ও কীওয়ার্ড শুরুতে থাকে।' },
      { h2: 'ক্লিক পাওয়ার জন্য লিখুন', p: 'ইনটেন্ট মিলিয়ে অ্যাকটিভ ভার্ব দিয়ে শুরু করুন এবং নির্দিষ্ট প্রতিশ্রুতি দিন - সংখ্যা, সময় বা সুবিধা।', list: ['শুরু করুন ভার্ব দিয়ে', 'নির্দিষ্ট তথ্য দিন', 'সঠিক প্রতিশ্রুতি, অতিরঞ্জন নয়'] },
      { h2: 'পরীক্ষা করে উন্নত করুন', p: 'Search Console-এ বেশি impression কিন্তু কম CTR এমন পেজ খুঁজে আগে সেগুলোর ডেসক্রিপশন নতুন করে লিখুন। ফ্রি মেটা ডেসক্রিপশন জেনারেটর দিয়ে কয়েকটি বিকল্প দ্রুত বানাতে পারেন।' }
    ],
    faq: [
      { q: 'মেটা ডেসক্রিপশন কি র‍্যাঙ্কিং ফ্যাক্টর?', a: 'সরাসরি নয়, তবে CTR-এর ওপর বড় প্রভাব ফেলে, যা পরোক্ষভাবে র‍্যাঙ্কিংয়ে সহায়ক।' },
      { q: 'কত লম্বা হওয়া উচিত?', a: 'প্রায় ১৪০-১৬০ ক্যারেক্টার, কীওয়ার্ড শুরুতে রেখে।' },
      { q: 'Google নিজে লিখে দিলে কী হবে?', a: 'স্পষ্ট ও প্রাসঙ্গিক ডেসক্রিপশন লিখলে Google কম rewrites করে।' }
    ]
  }
]

function guideToStatic(g, lang) {
  const base = lang === 'bn' ? '/bn/guides/' : '/guides/'
  const hub = lang === 'bn' ? '/bn/guides' : '/guides'
  return {
    path: base + g.slug,
    key: 'guide:' + g.slug,
    lang,
    type: 'article',
    updated: UPDATED,
    title: g.title,
    desc: g.desc,
    h1: g.h1,
    excerpt: g.excerpt,
    sections: g.sections,
    faq: g.faq,
    breadcrumb: [
      { name: lang === 'bn' ? 'হোম' : 'Home', url: lang === 'bn' ? '/bn' : '/' },
      { name: lang === 'bn' ? 'গাইড' : 'Guides', url: hub },
      { name: g.h1, url: base + g.slug }
    ]
  }
}

const guidesHub = {
  path: '/guides',
  key: 'guides',
  lang: 'en',
  type: 'website',
  updated: UPDATED,
  title: 'SEO Guides & Tutorials for Beginners - SEO Service Provider',
  desc: 'Free, practical SEO guides: title writing, keyword research, local SEO and meta descriptions. Step-by-step tutorials with no fluff.',
  h1: 'SEO Guides &amp; Tutorials',
  excerpt: 'Practical, step-by-step SEO tutorials you can apply today - written for beginners.',
  guides: EN_GUIDES,
  faq: [
    { q: 'Are the SEO guides free?', a: 'Yes, every guide is free to read and pairs with a free tool so you can apply it immediately.' },
    { q: 'Where should a beginner start?', a: 'Start with keyword research basics, then title writing, then meta descriptions. Local SEO matters if you serve a specific area.' }
  ],
  breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides' }]
}

const bnHome = {
  path: '/bn',
  key: 'home',
  lang: 'bn',
  type: 'website',
  updated: UPDATED,
  title: 'ফ্রি এসইও টুলস ও এআই এজেন্ট - SEO Service Provider',
  desc: 'বাস্তব ডেটা দিয়ে ফ্রি এসইও টুলস ও এআই এজেন্ট। টাইটেল জেনারেটর, কীওয়ার্ড রিসার্চ, SERP বিশ্লেষণ, PageSpeed ও সম্পূর্ণ এসইও অডিট একসাথে।',
  h1: 'বাস্তব বিশ্লেষণসহ ফ্রি এসইও টুলস',
  intro: 'SEO Service Provider-এ ১০টি ব্যবহারিক এসইও টুল ও ১৯টি এআই এজেন্ট এক জায়গায়। প্রতিটি ফল বাস্তব ডেটার ওপর ভিত্তি করে তৈরি - কোনো বানানো সংখ্যা নয়।',
  sections: [
    { h2: 'যা যা করতে পারবেন', p: 'একটি কীওয়ার্ড থেকে ১০টি স্কোরযুক্ত টাইটেল, কীওয়ার্ড রিসার্চ, SERP ও প্রতিযোগী বিশ্লেষণ, People-Also-Ask প্রশ্ন, PageSpeed চেক এবং সম্পূর্ণ এসইও অডিট - সবই এক ড্যাশবোর্ডে।' },
    { h2: 'শুরু করবেন কীভাবে', p: 'ফ্রি অ্যাকাউন্ট খুলুন, ড্যাশবোর্ড থেকে যেকোনো টুল বেছে নিন এবং প্রথম বিশ্লেষণ চালান। কোনো কার্ডের প্রয়োজন নেই।' }
  ],
  faq: [
    { q: 'টুলগুলো কি সত্যিই ফ্রি?', a: 'হ্যাঁ, মূল টুলগুলো ফ্রি। অ্যাকাউন্ট শুধু হিস্ট্রি সেভ ও দৈনিক লিমিট বাড়াতে দরকার।' },
    { q: 'ডেটা কি বানানো?', a: 'না, প্রতিটি স্কোর লাইভ ডেটা থেকে হিসাব করা হয়, তাই দুইবার ফল আলাদা হতে পারে।' },
    { q: 'কী ইনস্টল করতে হবে?', a: 'কিছুই না, সব টুল ব্রাউজারেই চলে।' }
  ],
  breadcrumb: [{ name: 'হোম', url: '/bn' }]
}

const bnGuidesHub = {
  path: '/bn/guides',
  key: 'guides',
  lang: 'bn',
  type: 'website',
  updated: UPDATED,
  title: 'ফ্রি এসইও গাইড ও টিউটোরিয়াল - SEO Service Provider',
  desc: 'সহজ বাংলা এসইও গাইড: টাইটেল লেখা, কীওয়ার্ড রিসার্চ, লোকাল এসইও ও মেটা ডেসক্রিপশন। নতুনদের জন্য ধাপে ধাপে টিউটোরিয়াল।',
  h1: 'এসইও গাইড ও টিউটোরিয়াল',
  excerpt: 'নতুনদের জন্য সহজ, ব্যবহারিক ধাপে ধাপে এসইও টিউটোরিয়াল।',
  guides: BN_GUIDES,
  faq: [
    { q: 'গাইডগুলো কি ফ্রি?', a: 'হ্যাঁ, প্রতিটি গাইড ফ্রি এবং প্রতিটির সাথে সম্পর্কিত ফ্রি টুল ব্যবহার করতে পারবেন।' },
    { q: 'নতুনরা কোথা থেকে শুরু করবে?', a: 'প্রথমে কীওয়ার্ড রিসার্চ, তারপর টাইটেল লেখা, তারপর মেটা ডেসক্রিপশন।' }
  ],
  breadcrumb: [{ name: 'হোম', url: '/bn' }, { name: 'গাইড', url: '/bn/guides' }]
}

export const STATIC_PAGES = [
  guidesHub,
  ...EN_GUIDES.map(g => guideToStatic(g, 'en')),
  bnHome,
  bnGuidesHub,
  ...BN_GUIDES.map(g => guideToStatic(g, 'bn'))
]

export const ALL_PAGES = [...SPA_PAGES, ...STATIC_PAGES]
