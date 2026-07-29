// scripts/extract-web-note-diagrams.mjs
//
// One-off extraction of the seven inline diagrams in the Web & Mobile
// Development course document into standalone .svg files ready to upload to the
// `note-images` bucket (T-075).
//
// Three fixes are applied that the inline originals do not need but a standalone
// file does:
//
//   1. `xmlns` — an inline <svg> in an HTML document inherits the SVG namespace
//      from the parser. A .svg file parsed as XML does not, so without this the
//      browser renders nothing at all.
//   2. A background <rect> — the originals are white-on-transparent and get
//      their dark backdrop from the wrapping <div style="background:#0b0d17">,
//      which does not survive extraction. The notes reader is theme-aware
//      (NoteReader.module.css uses var(--bg)), so a transparent extraction is
//      invisible in light mode.
//   3. Explicit width/height plus padding — gives the file an intrinsic size for
//      <img> to scale from, and restores the breathing room the wrapper div's
//      padding used to provide.
//
// Usage:  node scripts/extract-web-note-diagrams.mjs [--out <dir>]

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const SOURCE = 'module-notes-ch1-20_1.html'
const BACKDROP = '#0b0d17'
const PADDING = 18

// aria-label in the source → output filename. Order-independent, and it fails
// loudly if the source stops matching rather than silently writing fewer files.
const NAMES = {
  'DNS lookup diagram': 'ch01-dns-lookup',
  'Packet routing diagram': 'ch01-packet-routing',
  'TCP handshake diagram': 'ch01-tcp-handshake',
  'CDN diagram': 'ch01-cdn-edge',
  'Message journey diagram': 'ch01-message-journey',
  ERD: 'ch03-erd',
  'Push notification diagram': 'ch18-push-notifications',
}

const outArgIndex = process.argv.indexOf('--out')
const OUT_DIR = outArgIndex === -1 ? 'build/web-diagrams' : process.argv[outArgIndex + 1]

const html = await readFile(SOURCE, 'utf8')

const blocks = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m) => m[0])
if (blocks.length === 0) throw new Error(`No <svg> blocks found in ${SOURCE}`)

await mkdir(OUT_DIR, { recursive: true })

const written = []
const seen = new Set()

for (const block of blocks) {
  const label = /aria-label="([^"]+)"/.exec(block)?.[1]
  const name = label && NAMES[label]
  if (!name) {
    throw new Error(`Unmapped diagram aria-label: ${JSON.stringify(label)}. Add it to NAMES.`)
  }
  if (seen.has(name)) throw new Error(`Two diagrams claim the name ${name}`)
  seen.add(name)

  const viewBox = /viewBox="([^"]+)"/.exec(block)?.[1]
  if (!viewBox) throw new Error(`${name}: no viewBox, cannot size the output`)
  const [minX, minY, width, height] = viewBox.trim().split(/[\s,]+/).map(Number)
  if ([minX, minY, width, height].some((n) => !Number.isFinite(n))) {
    throw new Error(`${name}: unparseable viewBox ${JSON.stringify(viewBox)}`)
  }

  // Inner markup, minus the <svg> wrapper's own attributes. The originals carry
  // a `style="width:100%…"` and a `font-family` that belong to the page, not to
  // a standalone asset, so the wrapper is rebuilt rather than patched.
  const inner = block.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>$/, '').trim()

  const totalWidth = width + PADDING * 2
  const totalHeight = height + PADDING * 2

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" font-family="ui-monospace, Menlo, Consolas, monospace" role="img" aria-label="${label}">
  <rect width="${totalWidth}" height="${totalHeight}" fill="${BACKDROP}"/>
  <g transform="translate(${PADDING - minX}, ${PADDING - minY})">
${inner.split('\n').map((line) => (line.trim() ? `    ${line.trim()}` : '')).join('\n')}
  </g>
</svg>
`

  const file = path.join(OUT_DIR, `${name}.svg`)
  await writeFile(file, svg, 'utf8')
  written.push({ name, file, size: svg.length, viewBox: `${totalWidth}x${totalHeight}` })
}

const missing = Object.values(NAMES).filter((n) => !seen.has(n))
if (missing.length) throw new Error(`Expected diagrams never matched: ${missing.join(', ')}`)

console.log(`Wrote ${written.length} diagrams to ${OUT_DIR}/`)
for (const w of written) console.log(`  ${w.name}.svg  ${w.viewBox}  ${w.size} bytes`)
