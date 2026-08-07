// Shared drawing helpers for the `::anim` figure builders.
//
// Figures are emitted as plain data modules under src/content/animations, so
// nothing in here ships to the browser. Colours are always CSS custom
// properties (see NoteAnimation.module.css) rather than literal hex, which is
// what lets one figure serve both the light and the dark themes.

export const SANS = 'Inter, -apple-system, Segoe UI, sans-serif'
export const MONO = 'Cascadia Code, Fira Code, JetBrains Mono, SF Mono, Consolas, monospace'

/** The reader column is about 720px wide; figures are built to this. */
export const W = 690

export const C = {
  text: 'var(--anim-text)',
  muted: 'var(--anim-muted)',
  line: 'var(--anim-line)',
  fill: 'var(--anim-fill)',
  focus: 'var(--anim-focus)',
  ok: 'var(--anim-ok)',
  bad: 'var(--anim-bad)',
  alt: 'var(--anim-alt)',
  link: 'var(--anim-link)',
  mark: 'var(--anim-mark)',
}

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A line of text. `anchor` is start | middle | end. */
export function text(x, y, s, { size = 12, fill = C.text, anchor = 'start', weight = 400, mono = false, opacity } = {}) {
  const o = opacity == null ? '' : ` opacity="${opacity}"`
  return (
    `<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ` +
    `font-weight="${weight}" font-family="${mono ? MONO : SANS}"${o}>${esc(s)}</text>`
  )
}

export function rect(x, y, w, h, { fill = 'none', stroke = C.line, sw = 1, rx = 4, dash, opacity } = {}) {
  const d = dash ? ` stroke-dasharray="${dash}"` : ''
  const o = opacity == null ? '' : ` opacity="${opacity}"`
  return (
    `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rx}" fill="${fill}" ` +
    `stroke="${stroke}" stroke-width="${sw}"${d}${o}/>`
  )
}

export function line(x1, y1, x2, y2, { stroke = C.line, sw = 1, dash, marker, opacity } = {}) {
  const d = dash ? ` stroke-dasharray="${dash}"` : ''
  const m = marker ? ` marker-end="url(#${marker})"` : ''
  const o = opacity == null ? '' : ` opacity="${opacity}"`
  return `<path d="M${r(x1)},${r(y1)} L${r(x2)},${r(y2)}" stroke="${stroke}" stroke-width="${sw}" fill="none"${d}${m}${o}/>`
}

export function ellipse(cx, cy, rx, ry, { fill = 'none', stroke = C.line, sw = 1, dash } = {}) {
  const d = dash ? ` stroke-dasharray="${dash}"` : ''
  return (
    `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${fill}" ` +
    `stroke="${stroke}" stroke-width="${sw}"${d}/>`
  )
}

export function diamond(cx, cy, rx, ry, { fill = 'none', stroke = C.line, sw = 1 } = {}) {
  const pts = `${r(cx)},${r(cy - ry)} ${r(cx + rx)},${r(cy)} ${r(cx)},${r(cy + ry)} ${r(cx - rx)},${r(cy)}`
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
}

/** An arrowhead marker definition, one per colour used. */
export function markerDef(id, colour) {
  return (
    `<marker id="${id}" viewBox="0 0 10 8" refX="9.4" refY="4" markerWidth="9" markerHeight="7" ` +
    `markerUnits="userSpaceOnUse" orient="auto"><path d="M0.6,0.6 L9.4,4 L0.6,7.4 z" fill="${colour}"/></marker>`
  )
}

const r = (v) => Number(Number(v).toFixed(2))
export { r as round }

/**
 * A data table: header row plus body rows.
 *
 * `cols` is [{ label, w, align }]. `rows` is an array of arrays of cell values;
 * a cell may be a plain value or { v, fill, colour, weight } to tint one cell,
 * which is how the normalisation figures colour a dependency without needing a
 * separate overlay layer.
 */
export function table(x, y, cols, rows, { rowH = 24, headH = 26, title, titleColour = C.text, zebra = true } = {}) {
  const out = []
  const totalW = cols.reduce((a, c) => a + c.w, 0)
  let top = y

  if (title) {
    out.push(text(x, top - 6, title, { size: 12.5, weight: 700, fill: titleColour }))
  }

  // header
  let cx = x
  out.push(rect(x, top, totalW, headH, { fill: C.fill, stroke: C.line, rx: 4 }))
  for (const c of cols) {
    out.push(
      text(cellX(cx, c), top + headH / 2 + 4, c.label, {
        size: 11.5,
        weight: 700,
        fill: c.colour ?? C.muted,
        anchor: c.align ?? 'start',
        mono: true,
      })
    )
    cx += c.w
  }
  top += headH

  // body
  rows.forEach((row, ri) => {
    if (zebra && ri % 2 === 1) {
      out.push(rect(x, top, totalW, rowH, { fill: C.fill, stroke: 'none', rx: 0, opacity: 0.5 }))
    }
    let bx = x
    row.forEach((raw, ci) => {
      const c = cols[ci]
      const cell = raw && typeof raw === 'object' && 'v' in raw ? raw : { v: raw }
      if (cell.fill) {
        out.push(rect(bx + 1, top + 1.5, c.w - 2, rowH - 3, { fill: cell.fill, stroke: 'none', rx: 3 }))
      }
      out.push(
        text(cellX(bx, c), top + rowH / 2 + 4, cell.v === null || cell.v === undefined ? 'NULL' : cell.v, {
          size: 11.5,
          fill: cell.colour ?? (cell.v === null || cell.v === undefined ? C.muted : C.text),
          weight: cell.weight ?? 400,
          anchor: c.align ?? 'start',
          mono: true,
        })
      )
      bx += c.w
    })
    top += rowH
  })

  // grid lines last so they sit above the zebra banding
  out.push(rect(x, y, totalW, headH + rows.length * rowH, { fill: 'none', stroke: C.line, rx: 4 }))
  let gx = x
  for (const c of cols.slice(0, -1)) {
    gx += c.w
    out.push(line(gx, y, gx, y + headH + rows.length * rowH, { stroke: C.line, sw: 0.6 }))
  }
  out.push(line(x, y + headH, x + totalW, y + headH, { stroke: C.line, sw: 1 }))

  return { svg: out.join(''), width: totalW, height: headH + rows.length * rowH }
}

function cellX(colLeft, c) {
  const pad = 8
  if (c.align === 'middle') return colLeft + c.w / 2
  if (c.align === 'end') return colLeft + c.w - pad
  return colLeft + pad
}

/** Wraps a string to `max` characters per line, returning an array of lines. */
export function wrap(s, max) {
  const words = String(s).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (!cur.length) cur = w
    else if (cur.length + 1 + w.length <= max) cur += ` ${w}`
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

/**
 * The lowest and rightmost point any frame actually paints.
 *
 * Every frame of a figure shares one viewBox, so the height has to be the
 * tallest frame's. Guessing it leaves either dead space under the short frames
 * or a clipped tall one, and neither is visible in the builder's output. This
 * measures the emitted source instead: rect bottoms, ellipse and text
 * baselines, and both ends of every path.
 */
export function extent(svg) {
  let maxY = 0
  let maxX = 0
  const seeX = (v) => { if (Number.isFinite(v)) maxX = Math.max(maxX, v) }
  const seeY = (v) => { if (Number.isFinite(v)) maxY = Math.max(maxY, v) }

  for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)) {
    seeX(Number(m[1]) + Number(m[3]))
    seeY(Number(m[2]) + Number(m[4]))
  }
  for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"/g)) {
    seeX(Number(m[1]))
    seeY(Number(m[2]))
  }
  for (const m of svg.matchAll(/<ellipse cx="([-\d.]+)" cy="([-\d.]+)" rx="([-\d.]+)" ry="([-\d.]+)"/g)) {
    seeX(Number(m[1]) + Number(m[3]))
    seeY(Number(m[2]) + Number(m[4]))
  }
  for (const m of svg.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)) {
    seeX(Number(m[1]))
    seeY(Number(m[2]))
  }
  for (const m of svg.matchAll(/<polygon points="([^"]+)"/g)) {
    for (const pair of m[1].trim().split(/\s+/)) {
      const [px, py] = pair.split(',').map(Number)
      seeX(px)
      seeY(py)
    }
  }
  return { x: maxX, y: maxY }
}

/** Sets each entry's height from what its frames actually paint, and reports
 *  anything that would run off the right-hand edge. */
export function fitHeights(entries, { pad = 14 } = {}) {
  const problems = []
  for (const e of entries) {
    let maxY = 0
    let maxX = 0
    for (const f of e.frames) {
      const { x, y } = extent((e.defs ?? '') + f.svg)
      maxY = Math.max(maxY, y)
      maxX = Math.max(maxX, x)
    }
    e.height = Math.ceil(maxY + pad)
    if (maxX > e.width - 2) {
      problems.push(`${e.id}: content reaches x=${maxX.toFixed(0)} but the figure is only ${e.width} wide`)
    }
  }
  return problems
}

/** Serialises a registry module. `entries` is an array of animation objects. */
export function moduleSource(exportName, entries, header) {
  const body = entries
    .map((e) => {
      const frames = e.frames
        .map(
          (f) =>
            `    {\n      caption: ${JSON.stringify(f.caption)},\n` +
            (f.hold ? `      hold: ${f.hold},\n` : '') +
            `      svg: ${JSON.stringify(f.svg)},\n    },`
        )
        .join('\n')
      return (
        `  {\n` +
        `    id: ${JSON.stringify(e.id)},\n` +
        `    label: ${JSON.stringify(e.label)},\n` +
        `    alt: ${JSON.stringify(e.alt)},\n` +
        `    width: ${e.width},\n` +
        `    height: ${e.height},\n` +
        `    mode: ${JSON.stringify(e.mode ?? 'replace')},\n` +
        (e.defs ? `    defs: ${JSON.stringify(e.defs)},\n` : '') +
        `    frames: [\n${frames}\n    ],\n` +
        `  },`
      )
    })
    .join('\n')
  return `${header}\nexport const ${exportName} = [\n${body}\n]\n`
}
