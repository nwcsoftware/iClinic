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
