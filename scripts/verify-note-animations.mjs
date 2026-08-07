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
      const vb = svg.viewBox.baseVal
      const live = [...svg.querySelectorAll('[data-fr]')].filter(
        (g) => getComputedStyle(g).opacity !== '0'
      )
      const out = []
      const boxes = []
      for (const g of live) {
        for (const node of g.querySelectorAll('text, rect, ellipse, polygon')) {
          const b = node.getBBox()
          if (b.width === 0 && b.height === 0) continue
          if (b.x < -1 || b.y < -1 || b.x + b.width > vb.width + 1 || b.y + b.height > vb.height + 1) {
            out.push(`outside viewBox: ${node.tagName} "${(node.textContent || '').slice(0, 28)}" at ${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}`)
          }
          if (node.tagName === 'text') boxes.push({ b, t: node.textContent || '' })
        }
      }
      // text-on-text overlap
      for (let a = 0; a < boxes.length; a += 1) {
        for (let c = a + 1; c < boxes.length; c += 1) {
          const A = boxes[a].b
          const B = boxes[c].b
          const ox = Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x)
          const oy = Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y)
          if (ox > 1.5 && oy > 1.5) {
            out.push(`text overlap: "${boxes[a].t.slice(0, 22)}" / "${boxes[c].t.slice(0, 22)}"`)
          }
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
