/**
 * The avatar's deterministic core: seed in, grid and palette out.
 *
 * Split out of index.jsx so that more than one renderer can draw the *same*
 * avatar. The Sentinel boot sequence (T-099) forges the avatar on screen before
 * handing it to the sidebar, and those two have to agree exactly: if the forge
 * carried its own copy of the hash, the palette or the per-cell maths, the
 * visitor would watch one avatar get built and a subtly different one appear in
 * the corner.
 *
 * That is not a hypothetical. This folder already contained a second copy of
 * all of this in an `index.tsx` that nothing could import (it referenced a
 * `@repo/shadcn-ui` package this repo does not have), and it had already
 * drifted from the live renderer: no circle-clip fix, no visibility gating.
 * One source, imported twice, is the whole point of this file.
 *
 * Everything here is pure and free of DOM access, so it can be reasoned about
 * (and tested) without a canvas.
 */

export const GRID_SIZE = 6

/** Canvas background behind the cells. */
export const BACKGROUND = '#08080f'

export const GLOW_RADIUS_RATIO = 0.25

/** Pulse: each pixel oscillates lightness independently */
export const PULSE_SPEED = 0.002
export const PULSE_AMPLITUDE = 22

/** Breathe: global slow scale oscillation */
export const BREATHE_SPEED = 0.001
export const BREATHE_AMPLITUDE = 10

/** Wave: diagonal sweep across the grid */
export const WAVE_SPEED = 0.0015
export const WAVE_AMPLITUDE = 15
export const WAVE_LENGTH = 3

/** Sparkle: random bright flashes */
export const SPARKLE_SPEED = 0.004
export const SPARKLE_THRESHOLD = 0.92
export const SPARKLE_BOOST = 25

/** Scale pulse: whole avatar breathes in size */
export const SCALE_PULSE_SPEED = 0.0008
export const SCALE_PULSE_AMOUNT = 0.03

/** Max hue spread from base, wider for richer color variation */
export const HUE_SPREAD = 45

/** Simple deterministic hash from a string */
export const hashSeed = (str) => {
  let hash = 0
  for (const char of String(str)) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash)
}

/** Seeded PRNG (mulberry32) */
export const createRng = (seed) => {
  let state = seed
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Derive a 3-color palette within the same hue family */
export const generatePalette = (hash) => {
  const rng = createRng(hash)
  const baseHue = rng() * 360
  const sat = 75 + rng() * 20 // 75-95%

  return [
    [baseHue, sat, 55 + rng() * 10],
    [
      (baseHue - HUE_SPREAD + rng() * HUE_SPREAD * 2) % 360,
      sat - 5 + rng() * 10,
      40 + rng() * 15,
    ],
    [
      (baseHue - HUE_SPREAD + rng() * HUE_SPREAD * 2) % 360,
      sat - 10 + rng() * 15,
      60 + rng() * 15,
    ],
  ]
}

/** Build a grid with per-cell metadata */
export const generateGrid = (hash) => {
  const rng = createRng(hash + 1)
  const grid = []

  for (let y = 0; y < GRID_SIZE; y++) {
    grid[y] = []
    for (let x = 0; x < GRID_SIZE; x++) {
      grid[y][x] = {
        colorIndex: Math.floor(rng() * 3),
        phase: rng() * Math.PI * 2,
        brightness: 0.3 + rng() * 0.7,
        sparklePhase: rng() * Math.PI * 2,
      }
    }
  }

  return grid
}

/**
 * The colour one cell resolves to, given whatever lightness offsets the caller
 * has decided to apply.
 *
 * Both renderers go through here. The live avatar passes its four animated
 * offsets; the forge passes zeroes, which is exactly the frame `draw(0)` paints
 * with animation off. That equality is the guarantee the handoff depends on,
 * and keeping it in one function is what makes it hold by construction rather
 * than by two files agreeing to clamp the same way.
 *
 * @param {[number, number, number]} paletteEntry - [hue, saturation, lightness]
 * @param {{ brightness: number }} cell
 * @param {number} [offset] - summed lightness offsets, before the brightness scale
 * @returns {{ h: number, s: number, l: number }}
 */
export const cellColor = (paletteEntry, cell, offset = 0) => {
  const [h, s, l] = paletteEntry
  return {
    h,
    s: Math.min(100, s + 5),
    l: Math.min(90, Math.max(20, (l + offset) * cell.brightness)),
  }
}

/**
 * Everything a renderer needs for one seed, in one call.
 *
 * @param {string} seed
 */
export const buildAvatar = (seed) => {
  const hash = hashSeed(seed)
  return { hash, palette: generatePalette(hash), grid: generateGrid(hash) }
}
