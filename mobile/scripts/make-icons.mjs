// Generates the iClinic app icons as crisp PNGs (no image library needed).
//
// A flat indigo square with a white medical cross, rendered mathematically at
// each target size with 4x4 supersampled anti-aliasing — so every icon is
// pixel-sharp instead of an upscaled thumbnail.
//
// Run: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'icons')

const BRAND = [0x30, 0x56, 0xd3] // #3056D3
const WHITE = [0xff, 0xff, 0xff]

// Signed distance to a rounded rectangle centred at (0,0).
function sdRoundRect(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r
  const qy = Math.abs(py) - halfH + r
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - r
}

// Coverage of the cross at a pixel, 4x4 supersampled.
function crossCoverage(x, y, size) {
  const c = size / 2
  const arm = size * 0.30   // half-length of each arm
  const thick = size * 0.105 // half-thickness
  const round = size * 0.022
  let hits = 0
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4 - c
      const py = y + (sy + 0.5) / 4 - c
      const horizontal = sdRoundRect(px, py, arm, thick, round)
      const vertical = sdRoundRect(px, py, thick, arm, round)
      if (Math.min(horizontal, vertical) <= 0) hits++
    }
  }
  return hits / 16
}

function renderIcon(size) {
  // Raw RGB rows, each prefixed with a filter byte (0 = none).
  const stride = size * 3 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x++) {
      const a = crossCoverage(x, y, size)
      const o = y * stride + 1 + x * 3
      for (let ch = 0; ch < 3; ch++) {
        raw[o + ch] = Math.round(BRAND[ch] * (1 - a) + WHITE[ch] * a)
      }
    }
  }
  return raw
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, raw) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // colour type: truecolour
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })

const SIZES = [1024, 512, 192, 180, 96, 48, 32]
for (const size of SIZES) {
  const png = encodePng(size, renderIcon(size))
  writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), png)
  console.log(`icon-${size}.png  ${(png.length / 1024).toFixed(1)}KB`)
}
console.log(`\nwrote ${SIZES.length} icons to assets/icons/`)
