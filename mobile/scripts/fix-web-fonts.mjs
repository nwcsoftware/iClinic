// Post-export fix for web deploys.
//
// Expo emits icon fonts under `dist/assets/node_modules/...`, but static hosts
// (Vercel among them) refuse to serve any path containing `node_modules`, so
// every icon renders blank. This moves those assets to `dist/assets/vendor/...`
// and rewrites the references inside the exported JS/HTML/CSS.
//
// Run after `expo export --platform web`.

import { promises as fs } from 'node:fs'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '..', 'dist')
const FROM_DIR = path.join(DIST, 'assets', 'node_modules')
const TO_DIR = path.join(DIST, 'assets', 'vendor')
const FROM_REF = 'assets/node_modules/'
const TO_REF = 'assets/vendor/'

async function exists(p) {
  try { await fs.access(p); return true } catch { return false }
}

async function walk(dir) {
  const out = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

if (!await exists(DIST)) {
  console.error('No dist/ folder — run `expo export --platform web` first.')
  process.exit(1)
}

if (await exists(FROM_DIR)) {
  if (await exists(TO_DIR)) await fs.rm(TO_DIR, { recursive: true, force: true })
  await fs.rename(FROM_DIR, TO_DIR)
  console.log('moved assets/node_modules -> assets/vendor')
} else {
  console.log('assets/node_modules not present (already fixed?)')
}

let patched = 0
for (const file of await walk(DIST)) {
  if (!/\.(js|html|css|json|map)$/i.test(file)) continue
  const body = await fs.readFile(file, 'utf8')
  if (!body.includes(FROM_REF)) continue
  await fs.writeFile(file, body.split(FROM_REF).join(TO_REF))
  patched++
}
console.log(`rewrote references in ${patched} file(s)`)

const leftovers = (await walk(DIST)).filter((f) => f.includes(`${path.sep}node_modules${path.sep}`))
if (leftovers.length > 0) {
  console.error('WARNING: node_modules paths still present:', leftovers.length)
  process.exit(1)
}
console.log('web export is deploy-safe')

// ---------------------------------------------------------------------------
// Home-screen icons. Expo only emits a small favicon, so "Add to Home Screen"
// upscales it and looks pixelated. Ship real PWA icons + a manifest.
// ---------------------------------------------------------------------------
const ICON_SRC = path.resolve(import.meta.dirname, '..', 'assets', 'icons')
const ICON_OUT = path.join(DIST, 'icons')
const ICON_SIZES = [1024, 512, 192, 180, 96, 48, 32]

// Phones cache home-screen icons hard. Version the filenames so a changed icon
// is always a new URL and can never serve stale.
const V = process.env.ICON_VERSION ?? '3'

await fs.mkdir(ICON_OUT, { recursive: true })
for (const size of ICON_SIZES) {
  const from = path.join(ICON_SRC, `icon-${size}.png`)
  if (await exists(from)) {
    await fs.copyFile(from, path.join(ICON_OUT, `icon-${size}-v${V}.png`))
  }
}
const icon = (size) => `/icons/icon-${size}-v${V}.png`

const manifest = {
  name: 'iClinic',
  short_name: 'iClinic',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#3056D3',
  theme_color: '#3056D3',
  icons: [
    { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: icon(1024), sizes: '1024x1024', type: 'image/png', purpose: 'any' },
  ],
}
await fs.writeFile(path.join(DIST, `manifest-v${V}.json`), JSON.stringify(manifest, null, 2))

// A service worker is what makes Chrome treat this as an installable app
// rather than a bookmark shortcut (which uses a low-res favicon).
const SW = `// iClinic service worker — network-first, offline fallback to the shell.
const CACHE = 'iclinic-v${V}'
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html'])).catch(() => {}))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match('/index.html')))
  )
})
`
await fs.writeFile(path.join(DIST, 'sw.js'), SW)

const HEAD_TAGS = `
<link rel="manifest" href="/manifest-v${V}.json" />
<link rel="apple-touch-icon" sizes="180x180" href="${icon(180)}" />
<link rel="apple-touch-icon" sizes="192x192" href="${icon(192)}" />
<link rel="apple-touch-icon" href="${icon(180)}" />
<link rel="icon" type="image/png" sizes="512x512" href="${icon(512)}" />
<link rel="icon" type="image/png" sizes="192x192" href="${icon(192)}" />
<link rel="icon" type="image/png" sizes="32x32" href="${icon(32)}" />
<meta name="theme-color" content="#3056D3" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="iClinic" />
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {})
  })
}
</script>
`.trim()

const htmlPath = path.join(DIST, 'index.html')
let html = await fs.readFile(htmlPath, 'utf8')
// Drop Expo's low-res favicon link so nothing competes with the real icons.
html = html.replace(/<link rel="icon" href="\/favicon\.ico"[^>]*>/g, '')
if (!html.includes('apple-touch-icon')) {
  html = html.replace('</head>', `${HEAD_TAGS}\n</head>`)
  console.log(`added PWA icons (v${V}), manifest and service worker`)
} else {
  console.log('PWA tags already present')
}

// ---------------------------------------------------------------------------
// Anything that reads this page without running JS — a payment provider's
// review tool, a link preview, a search crawler — otherwise sees only
// "You need to enable JavaScript". Give it a real description of the product
// and links to the policies, which is exactly what a provider looks for.
// ---------------------------------------------------------------------------
const NOSCRIPT = `
<noscript>
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:40px 24px;color:#1A2333">
    <h1 style="font-size:26px;color:#0D1526">iClinic</h1>
    <p style="line-height:1.7">Describe how you feel, find the right specialist, book a visit, and read your
    prescriptions. Free for patients in Lebanon. Doctors subscribe for $9.99 per month to appear in the app
    and accept bookings.</p>
    <p style="line-height:1.7"><strong>iClinic does not provide medical advice or diagnosis.</strong>
    In an emergency call 112 in Lebanon.</p>
    <p style="line-height:1.7">
      <a href="/terms">Terms of Service</a> ·
      <a href="/privacy">Privacy Policy</a> ·
      <a href="/refund-policy">Refunds &amp; Cancellation</a>
    </p>
    <p style="line-height:1.7">Contact: <a href="mailto:jadchamy2001@gmail.com">jadchamy2001@gmail.com</a></p>
  </div>
</noscript>`.trim()

html = html.replace(
  /<noscript>[\s\S]*?<\/noscript>/,
  NOSCRIPT,
)
if (!html.includes('iClinic does not provide medical advice')) {
  // No existing noscript block to replace — put ours right after <body>.
  html = html.replace(/<body[^>]*>/, (m) => `${m}\n${NOSCRIPT}`)
}
console.log('added no-JS product description and policy links')

await fs.writeFile(htmlPath, html)

// ---------------------------------------------------------------------------
// The policies live on the web project, but the app is on its own domain and
// that is the URL people (and reviewers) actually have. Proxy the three policy
// paths across so they resolve on both domains.
// ---------------------------------------------------------------------------
// A redirect rather than a rewrite: proxying cross-origin from a static
// deployment does not fire, and for a policy link the address bar changing is
// no loss.
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'https://iclinic-web.vercel.app'
await fs.writeFile(
  path.join(DIST, 'vercel.json'),
  JSON.stringify({
    redirects: ['terms', 'privacy', 'refund-policy'].map((p) => ({
      source: `/${p}`,
      destination: `${WEB_ORIGIN}/${p}`,
      permanent: false,
    })),
  }, null, 2),
)
console.log('added policy redirects -> ' + WEB_ORIGIN)
