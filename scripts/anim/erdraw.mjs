// ERD shape vocabulary, in Chen notation, matching the lecture's cheat-sheet.
//
// Every shape is drawn from its CENTRE so a diagram can be described as a set
// of placed nodes and the edges worked out from their geometry, rather than
// every line being positioned by hand.

import { C, text, rect, line, ellipse, diamond } from './draw.mjs'

export const ENTITY_W = 108
export const ENTITY_H = 40
export const REL_RX = 46
export const REL_RY = 26
export const ATTR_RX = 40
export const ATTR_RY = 17

/** A rectangle: an entity set. `weak` draws the double border. */
export function entity(cx, cy, label, { weak = false, colour = C.text, fill = C.fill } = {}) {
  const x = cx - ENTITY_W / 2
  const y = cy - ENTITY_H / 2
  const out = [rect(x, y, ENTITY_W, ENTITY_H, { fill, stroke: colour, sw: 1.4, rx: 3 })]
  if (weak) out.push(rect(x + 4, y + 4, ENTITY_W - 8, ENTITY_H - 8, { fill: 'none', stroke: colour, sw: 1.1, rx: 2 }))
  out.push(text(cx, cy + 4.5, label, { size: 12, anchor: 'middle', weight: 600, fill: colour }))
  return out.join('')
}

/** A diamond: a relationship set. `weak` draws the double border (identifying). */
export function relationship(cx, cy, label, { weak = false, colour = C.text, fill = C.fill } = {}) {
  const out = [diamond(cx, cy, REL_RX, REL_RY, { fill, stroke: colour, sw: 1.4 })]
  if (weak) out.push(diamond(cx, cy, REL_RX - 5, REL_RY - 5, { fill: 'none', stroke: colour, sw: 1.1 }))
  out.push(text(cx, cy + 4, label, { size: 11, anchor: 'middle', weight: 600, fill: colour }))
  return out.join('')
}

/**
 * An ellipse: an attribute.
 *   key         underlined text
 *   multi       double outline
 *   derived     dashed outline
 *   partialKey  dashed underline, for a weak entity's discriminator
 */
export function attribute(cx, cy, label, { key = false, multi = false, derived = false, partialKey = false, colour = C.text, rx = ATTR_RX } = {}) {
  const out = [ellipse(cx, cy, rx, ATTR_RY, { fill: C.fill, stroke: colour, sw: 1.2, dash: derived ? '4 3' : undefined })]
  if (multi) out.push(ellipse(cx, cy, rx - 4, ATTR_RY - 4, { fill: 'none', stroke: colour, sw: 1 }))
  out.push(text(cx, cy + 3.5, label, { size: 10.5, anchor: 'middle', fill: colour }))
  if (key || partialKey) {
    const w = String(label).length * 5.4
    out.push(
      line(cx - w / 2, cy + 6.5, cx + w / 2, cy + 6.5, {
        stroke: colour,
        sw: 1,
        dash: partialKey ? '2 2' : undefined,
      })
    )
  }
  return out.join('')
}

/** An ISA triangle, pointing up at its superclass. */
export function isa(cx, cy, { colour = C.alt, label = 'ISA' } = {}) {
  const w = 46
  const h = 26
  const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy + h / 2} ${cx - w / 2},${cy + h / 2}`
  return (
    `<polygon points="${pts}" fill="${C.fill}" stroke="${colour}" stroke-width="1.4"/>` +
    text(cx, cy + h / 2 - 6, label, { size: 9, anchor: 'middle', weight: 700, fill: colour })
  )
}

/** A plain connector. `total` draws the double line for total participation. */
export function connect(x1, y1, x2, y2, { total = false, colour = C.line, label, labelAt = 0.5 } = {}) {
  const out = []
  if (total) {
    // Two parallel lines, offset perpendicular to the run.
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const ox = (-dy / len) * 1.8
    const oy = (dx / len) * 1.8
    out.push(line(x1 + ox, y1 + oy, x2 + ox, y2 + oy, { stroke: colour, sw: 1.1 }))
    out.push(line(x1 - ox, y1 - oy, x2 - ox, y2 - oy, { stroke: colour, sw: 1.1 }))
  } else {
    out.push(line(x1, y1, x2, y2, { stroke: colour, sw: 1.1 }))
  }
  if (label) {
    const lx = x1 + (x2 - x1) * labelAt
    const ly = y1 + (y2 - y1) * labelAt
    out.push(rect(lx - 9, ly - 8, 18, 15, { fill: 'var(--anim-bg-solid, transparent)', stroke: 'none', rx: 2 }))
    out.push(text(lx, ly + 4, label, { size: 10.5, anchor: 'middle', weight: 700, fill: colour, mono: true }))
  }
  return out.join('')
}

/** Edge from an entity box to a relationship diamond, meeting both borders. */
export function edgeEntityRel(e, r, opts = {}) {
  const [ex, ey] = borderPoint(e, r, 'rect')
  const [rx, ry] = borderPoint(r, e, 'diamond')
  return connect(ex, ey, rx, ry, opts)
}

/** Where the line from `from` toward `to` leaves `from`'s border. */
function borderPoint(from, to, shape) {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  if (shape === 'rect') {
    const hw = ENTITY_W / 2
    const hh = ENTITY_H / 2
    const s = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6))
    return [from.cx + dx * s, from.cy + dy * s]
  }
  // diamond: |x|/rx + |y|/ry = 1
  const s = 1 / (Math.abs(dx) / REL_RX + Math.abs(dy) / REL_RY || 1e-6)
  return [from.cx + dx * s, from.cy + dy * s]
}

/** Attribute hanging off an entity or relationship, with its stalk. */
export function attachedAttribute(host, cx, cy, label, opts = {}) {
  const [hx, hy] = borderPoint(host, { cx, cy }, host.shape === 'diamond' ? 'diamond' : 'rect')
  return connect(hx, hy, cx, cy + (cy > host.cy ? -ATTR_RY : ATTR_RY)) + attribute(cx, cy, label, opts)
}
