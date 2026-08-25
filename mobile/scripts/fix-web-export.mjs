// ---------------------------------------------------------------------------
// Post-processing for `expo export --platform web`.
//
// Expo writes bundled assets to a path mirroring where they came from, so the
// icon fonts land under `dist/assets/node_modules/@expo/vector-icons/...`.
// Vercel's uploader skips any path containing a `node_modules` segment, so
// those files silently never reach the CDN: the deploy succeeds, the bundle
// asks for the fonts, and every icon in the app renders as an empty box.
//
// This moves them out of that path and rewrites the references to match. Run it
// after every web export — `npm run build:web` does both.
// ---------------------------------------------------------------------------

import { readdirSync, statSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, rmSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const DEPLOY = fileURLToPath(new URL('../deploy', import.meta.url))
const FROM_DIR = join(DIST, 'assets', 'node_modules')
const TO_DIR = join(DIST, 'assets', 'vendor')
const FROM_REF = '/assets/node_modules/'
const TO_REF = '/assets/vendor/'

// Files whose contents may name an asset path.
const TEXT = /\.(js|json|html|css|map)$/

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function move(from, to) {
  for (const src of walk(from)) {
    const dest = join(to, src.slice(from.length + 1))
    mkdirSync(dirname(dest), { recursive: true })
    renameSync(src, dest)
  }
  rmSync(from, { recursive: true, force: true })
}

if (!existsSync(DIST)) {
  console.error('No dist/ — run `expo export --platform web` first.')
  process.exit(1)
}

let moved = 0
if (existsSync(FROM_DIR)) {
  moved = walk(FROM_DIR).length
  move(FROM_DIR, TO_DIR)
}

let patched = 0
for (const file of walk(DIST)) {
  if (!TEXT.test(file)) continue
  const before = readFileSync(file, 'utf8')
  if (!before.includes(FROM_REF)) continue
  writeFileSync(file, before.split(FROM_REF).join(TO_REF))
  patched++
}

// Nothing should reference the old path once this has run. Failing loudly here
// is much cheaper than discovering it as missing icons in production.
const stragglers = walk(DIST).filter(
  (f) => TEXT.test(f) && readFileSync(f, 'utf8').includes(FROM_REF),
)
if (stragglers.length || existsSync(FROM_DIR)) {
  console.error('Still referencing node_modules paths:', stragglers)
  process.exit(1)
}


// ---------------------------------------------------------------------------
// Preload the icon fonts.
//
// @expo/vector-icons registers its fonts from JavaScript, so the browser does
// not learn they exist until the whole bundle has downloaded and executed. On
// the live site that meant the fonts started ~20s in and every icon was blank
// until they landed. A preload link puts them on the wire immediately, in
// parallel with the bundle, rather than after it.
//
// Only the sets the app actually imports get preloaded — the vendored folder
// carries all 19, and pulling the rest would make the problem worse.
// ---------------------------------------------------------------------------
const SRC = fileURLToPath(new URL('..', import.meta.url))
const NL = String.fromCharCode(10)

function iconSetsUsed() {
  const used = new Set()
  const scan = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) { scan(p); continue }
      if (!/\.(t|j)sx?$/.test(name)) continue
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@expo\/vector-icons['"]/g)) {
        for (const id of m[1].split(',')) {
          const clean = id.trim().split(/\s+as\s+/)[0].trim()
          if (clean) used.add(clean)
        }
      }
    }
  }
  scan(SRC)
  return used
}

const fontsDir = join(TO_DIR, '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts')
let preloaded = []
if (existsSync(fontsDir)) {
  const files = readdirSync(fontsDir)
  const sets = iconSetsUsed()
  preloaded = [...sets]
    .map((set) => files.find((f) => f.startsWith(set + '.')))
    .filter(Boolean)
    .map((f) => `/assets/vendor/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${f}`)

  const html = join(DIST, 'index.html')
  const links = preloaded
    .map((href) => `    <link rel="preload" as="font" type="font/ttf" crossorigin href="${href}" />`)
    .join(NL)
  const before = readFileSync(html, 'utf8')
  if (links && !before.includes('rel="preload" as="font"')) {
    writeFileSync(html, before.replace('</head>', links + NL + '  </head>'))
  }
}

// `expo export` clears dist/, which takes the Vercel routing config and the
// project link with it. Both are kept in deploy/ and reinstalled here, so a
// build is reproducible and the policy redirects cannot go missing unnoticed.
copyFileSync(join(DEPLOY, 'vercel.json'), join(DIST, 'vercel.json'))
mkdirSync(join(DIST, '.vercel'), { recursive: true })
copyFileSync(join(DEPLOY, 'vercel-project.json'), join(DIST, '.vercel', 'project.json'))

console.log(`Moved ${moved} asset(s) out of node_modules/, rewrote ${patched} file(s), installed deploy config.`)
console.log(`Preloading ${preloaded.length} icon font(s): ${preloaded.map((f) => f.split('/').pop().split('.')[0]).join(', ')}`)
