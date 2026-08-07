#!/usr/bin/env node
// Throwaway: steps every `::anim` figure on the preview page through all of its
// frames, screenshots each one, and checks for text that overlaps another
// element or spills outside the viewBox.
//
//   node shot.mjs <outDir> [dark|light]

import { chromium } from '/home/moon/Desktop/Projects/b-tree/node_modules/playwright-core/index.mjs'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] || '/tmp/anim'
const MODE = process.argv[3] || 'dark'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))

const PORT = process.env.PREVIEW_PORT ?? 5205
await page.goto(`http://localhost:${PORT}/preview-anim.html`, { waitUntil: 'networkidle' })
await page.evaluate((m) => document.documentElement.setAttribute('data-mode', m), MODE)
await page.waitForTimeout(1200)

// The harness shows one note at a time, so select the page holding whatever we
// were asked to check. NOTE_MATCH defaults to the every-figure page.
const NOTE_MATCH = process.env.NOTE_MATCH ?? 'All new figures'
const picked = await page.evaluate((match) => {
  const b = [...document.querySelectorAll('nav button')].find((n) => n.textContent.includes(match))
  if (b) b.click()
  return Boolean(b)
}, NOTE_MATCH)
if (!picked) {
  console.error(`no note matching "${NOTE_MATCH}" in the sidebar`)
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(1500)

// Pause everything so stepping is under our control.
await page.evaluate(() => {
  document.querySelectorAll('button[aria-label="Pause animation"]').forEach((b) => b.click())
})
await page.waitForTimeout(300)

const figures = await page.$$('figure, div:has(> div[role="img"])')
const stages = await page.$$('div[role="img"]')
console.log(`figures: ${stages.length}`)

let problems = 0

for (let f = 0; f < stages.length; f += 1) {
  const label = await stages[f].getAttribute('aria-label')
  const total = Number((label.match(/of (\d+)/) || [])[1] || 1)
  const name = (label.split('.')[0] || `fig${f}`).slice(0, 40).replace(/\W+/g, '-').toLowerCase()

  for (let i = 0; i < total; i += 1) {
    // Jump to frame i by clicking the figure's own next button i times from 0.
    await page.evaluate(({ f, i }) => {
      const wrappers = [...document.querySelectorAll('div[role="img"]')].map((s) => s.parentElement)
      const w = wrappers[f]
      const ticks = [...w.querySelectorAll('button[tabindex="-1"]')]
      if (ticks[i]) ticks[i].click()
    }, { f, i })
    await page.waitForTimeout(280)

    // Geometry check on the visible frame only.
    const bad = await page.evaluate(({ f }) => {
      const stage = [...document.querySelectorAll('div[role="img"]')][f]
      const svg = stage.querySelector('svg')
      const frame = svg.getBoundingClientRect()
      const live = [...svg.querySelectorAll('[data-fr]')].filter(
        (g) => getComputedStyle(g).opacity !== '0'
      )
      const out = []
      const boxes = []
      // Screen space, not getBBox(): getBBox() reports a node's own user space
      // and ignores every transform on its ancestors, so anything inside a
      // translated <g> compares against the wrong coordinates. That produced a
      // long list of overlaps between the question text and diagram labels
      // that were nowhere near each other on screen.
      const px = frame.width / svg.viewBox.baseVal.width
      for (const g of live) {
        for (const node of g.querySelectorAll('text, rect, ellipse, polygon')) {
          const r = node.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          if (
            r.left < frame.left - 1 ||
            r.top < frame.top - 1 ||
            r.right > frame.right + 1 ||
            r.bottom > frame.bottom + 1
          ) {
            out.push(
              `outside viewBox: ${node.tagName} "${(node.textContent || '').slice(0, 28)}" ` +
                `at ${((r.left - frame.left) / px).toFixed(0)},${((r.top - frame.top) / px).toFixed(0)}`
            )
          }
          boxes.push({
            r,
            tag: node.tagName,
            t: node.textContent || '',
            // Shapes the builder declares as annotations, drawn deliberately
            // across other elements. See rect()'s `annot` option in draw.mjs.
            annot: node.hasAttribute('data-ok-overlap'),
          })
        }
      }

      // Partial overlap is the bug; containment is deliberate.
      //
      // Nesting is how the notation works: a label sits inside its own ellipse,
      // a multivalued attribute is an ellipse inside an ellipse, and the whole
      // reference table is one big rect around everything. All of those are
      // full containment. What is never intended is two shapes CLIPPING each
      // other, which is exactly what a subclass ellipse poking through the
      // bottom border of its container looks like.
      const contains = (A, B) =>
        A.left <= B.left + px && A.top <= B.top + px && A.right >= B.right - px && A.bottom >= B.bottom - px

      const at = (b) =>
        `${((b.r.left - frame.left) / px).toFixed(0)},${((b.r.top - frame.top) / px).toFixed(0)} ` +
        `${(b.r.width / px).toFixed(0)}x${(b.r.height / px).toFixed(0)}`
      const describe = (b) => `${b.tag}${b.t ? ` "${b.t.slice(0, 20)}"` : ''} @${at(b)}`

      for (let a = 0; a < boxes.length; a += 1) {
        for (let c = a + 1; c < boxes.length; c += 1) {
          const A = boxes[a].r
          const B = boxes[c].r
          const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left)
          const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top)
          if (ox <= 2 * px || oy <= 2 * px) continue
          if (contains(A, B) || contains(B, A)) continue
          if (boxes[a].annot || boxes[c].annot) continue
          out.push(`overlap: ${describe(boxes[a])} / ${describe(boxes[c])}`)
        }
      }
      return out
    }, { f })

    if (bad.length) {
      problems += bad.length
      console.log(`  ${name} frame ${i + 1}/${total}:`)
      for (const b of bad) console.log(`     ${b}`)
    }

    await stages[f].screenshot({ path: `${OUT}/${name}-${String(i + 1).padStart(2, '0')}.png` })
  }
}

console.log(`\nconsole errors: ${errors.length ? errors.slice(0, 4).join(' | ') : 'none'}`)
console.log(`geometry problems: ${problems}`)
await browser.close()
process.exit(problems > 0 ? 1 : 0)
