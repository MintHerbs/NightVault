// src/lib/asciiArt/bitmapField.js
//
// Turns a fixed density grid into an animated field function (T-077), so
// that hand-authored ASCII art and an admin-uploaded image can both feed
// the same renderer as the procedural fields in ./fields/*.js.
//
// A grid is an array of equal-or-ragged strings (rows). Each character is
// read as a density: a digit '0'-'9' scales linearly, anything else is
// looked up in the renderer's RAMP, and an unknown character reads as
// empty. Ragged rows are padded, so hand-authored art doesn't need its
// trailing spaces counted.

import { RAMP, MONO_ASPECT, clamp01 } from './renderAsciiField'

const RAMP_INDEX = new Map([...RAMP].map((ch, i) => [ch, i / (RAMP.length - 1)]))

function densityOf(ch) {
  if (ch >= '0' && ch <= '9') return (ch.charCodeAt(0) - 48) / 9
  return RAMP_INDEX.get(ch) ?? 0
}

/** Parse rows of text into a flat density grid. */
export function parseGrid(rows) {
  const lines = Array.isArray(rows) ? rows : String(rows).split('\n')
  const h = lines.length
  const w = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const data = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const line = lines[y]
    for (let x = 0; x < line.length; x++) {
      data[y * w + x] = densityOf(line[x])
    }
  }
  return { data, w, h }
}

/**
 * Sample a grid at normalized (u, v) in [0,1], nearest-neighbour.
 *
 * Nearest, not bilinear: these grids are already coarse character art, and
 * interpolating turns a crisp one-cell line into a two-cell smear that the
 * ramp then renders as two dim glyphs instead of one bright one.
 */
function sampleGrid({ data, w, h }, u, v) {
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0
  const x = Math.min(w - 1, Math.floor(u * w))
  const y = Math.min(h - 1, Math.floor(v * h))
  return data[y * w + x]
}

/**
 * Flip a grid across the density ramp: dense becomes empty and vice versa.
 *
 * The admin cover picker needs this because a cover renders as light glyphs
 * on a dark card, so a source image with a light background arrives as a
 * silhouette of its background. Inverting the stored grid is cheaper and more
 * predictable than asking for a re-upload just to fix that.
 */
export function invertGrid(grid) {
  const lines = String(grid).split('\n')
  // Pad to the widest row first: trailing blanks are stripped at conversion
  // time, and inverting turns a blank into the densest glyph — without the
  // pad, rows would invert to different widths and the art would go ragged.
  const width = lines.reduce((max, line) => Math.max(max, line.length), 0)
  return lines
    .map((line) => [...line.padEnd(width, ' ')]
      .map((ch) => {
        const i = RAMP.indexOf(ch)
        return i < 0 ? ch : RAMP[RAMP.length - 1 - i]
      })
      .join(''))
    .join('\n')
}

// Deterministic value noise — no Math.random, so a given cell's behaviour is
// reproducible frame to frame (and identical in the reduced-motion still).
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Animations, as (sample, nx, ny, t) => density. Each either warps where the
 * grid is sampled or modulates what comes back.
 */
export const BITMAP_ANIMATIONS = {
  // A brighter band sweeps down the art, CRT-refresh style, with the rest
  // held slightly under full so the band actually reads as brighter.
  scanline: (sample, nx, ny, t) => {
    const d = sample(nx, ny)
    if (d <= 0) return 0
    const sweep = ((t * 0.35) % 1.4) * 2 - 1.2
    const band = Math.max(0, 1 - Math.abs(ny - sweep) / 0.22)
    return clamp01(d * (0.82 + band * 0.5))
  },

  // Rotation that increases with radius, so the art winds into a vortex —
  // the motion in the reference design's swirl-with-logo cover.
  swirl: (sample, nx, ny, t) => {
    const r = Math.hypot(nx, ny)
    const angle = Math.atan2(ny, nx) + r * 1.1 - t * 0.5
    return sample(Math.cos(angle) * r, Math.sin(angle) * r)
  },

  // Per-cell threshold against drifting noise: cells wink in and out, so the
  // art continuously assembles and dissolves rather than moving.
  dissolve: (sample, nx, ny, t) => {
    const d = sample(nx, ny)
    if (d <= 0) return 0
    const n = hash2(Math.round(nx * 64), Math.round(ny * 64))
    const wave = (Math.sin(t * 0.9 + n * 6.283) + 1) / 2
    return d * clamp01(0.35 + wave * 0.9)
  },

  // Whole-art brightness wobble — the quietest option, for art detailed
  // enough that any coordinate warp would muddy it.
  flicker: (sample, nx, ny, t) => {
    const d = sample(nx, ny)
    if (d <= 0) return 0
    return clamp01(d * (0.86 + 0.14 * Math.sin(t * 6.5)))
  },

  // Slow scale pulse about the center, as if the art were breathing.
  breathe: (sample, nx, ny, t) => {
    const scale = 1 - 0.07 * Math.sin(t * 0.9)
    return sample(nx * scale, ny * scale)
  },
}

export const BITMAP_ANIMATION_KEYS = Object.keys(BITMAP_ANIMATIONS)
const DEFAULT_ANIMATION = 'scanline'

/**
 * Build a field function that renders `rows` with `animation`.
 *
 * `fit: 'contain'` (the default) preserves the art's own aspect inside the
 * card, letterboxing rather than stretching — an uploaded photo shouldn't
 * be squashed to the cover's square box.
 */
export function makeBitmapField(rows, { animation = DEFAULT_ANIMATION, fit = 'contain' } = {}) {
  const grid = parseGrid(rows)
  const warp = BITMAP_ANIMATIONS[animation] ?? BITMAP_ANIMATIONS[DEFAULT_ANIMATION]

  // The field is sampled over a square [-1,1] domain but the grid has its own
  // aspect; scale the sample coordinates so the art keeps its proportions.
  // A character cell is taller than it is wide (MONO_ASPECT), so a grid's
  // *visual* aspect is not w/h — a 48x22 grid reads as roughly 1.3:1, not
  // 2.2:1. Getting this wrong letterboxes wide art down to a thin strip.
  const gridAspect = (MONO_ASPECT * grid.w) / grid.h
  const sx = fit === 'contain' && gridAspect < 1 ? gridAspect : 1
  const sy = fit === 'contain' && gridAspect > 1 ? 1 / gridAspect : 1

  const sample = (nx, ny) => sampleGrid(grid, (nx / sx + 1) / 2, (ny / sy + 1) / 2)

  return (nx, ny, t) => warp(sample, nx, ny, t)
}
