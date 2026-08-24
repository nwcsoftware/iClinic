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

import { readdirSync, statSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
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

console.log(`Moved ${moved} asset(s) out of node_modules/, rewrote ${patched} file(s).`)
