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

await fs.mkdir(ICON_OUT, { recursive: true })
for (const size of ICON_SIZES) {
  const from = path.join(ICON_SRC, `icon-${size}.png`)
  if (await exists(from)) await fs.copyFile(from, path.join(ICON_OUT, `icon-${size}.png`))
}

const manifest = {
  name: 'iClinic',
  short_name: 'iClinic',
  start_url: '/',
  display: 'standalone',
  background_color: '#3056D3',
  theme_color: '#3056D3',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
  ],
}
await fs.writeFile(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2))

const HEAD_TAGS = `
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
<meta name="theme-color" content="#3056D3" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="iClinic" />
`.trim()

const htmlPath = path.join(DIST, 'index.html')
let html = await fs.readFile(htmlPath, 'utf8')
if (!html.includes('apple-touch-icon')) {
  html = html.replace('</head>', `${HEAD_TAGS}\n</head>`)
  await fs.writeFile(htmlPath, html)
  console.log('added PWA icons + manifest to index.html')
} else {
  console.log('PWA icons already present')
}
