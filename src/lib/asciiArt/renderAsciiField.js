// src/lib/asciiArt/renderAsciiField.js
//
// Framework-agnostic core for the ASCII-cover card animation (T-077). A
// "field" is a pure function (nx, ny, t) => density, where nx/ny are
// normalized to [-1, 1] (0,0 is the grid's center) and t is elapsed
// seconds. This module turns that field into a monospace character grid
// on a 2D canvas — the fields themselves live in ./fields/*.js and know
// nothing about canvas, React, or theming.

// Density-to-glyph ramp, sparse end first so low-density cells render as a
// blank rather than a distracting dot — the reference design reads as
// "shape emerging from mostly-empty space," not a filled rectangle.
export const RAMP = ' .:-=+*#%@'

// Nominal advance-width-to-font-size ratio for a monospace face. Only used
// as the starting guess; drawGrid measures the real advance and corrects,
// since the actual ratio varies by font and we need glyphs to tile the row
// exactly (see below).
export const MONO_ASPECT = 0.6

// Glyphs at or below this ramp index draw in the dim tier. Two tiers gives
// the covers depth for two fillText calls per row instead of one per cell —
// see drawAsciiField's batching note.
const DIM_MAX_INDEX = 3
const DIM_ALPHA = 0.42

/** Map a density in [0,1] to its ramp index. */
function rampIndex(density) {
  if (!(density > 0.04)) return 0 // also catches NaN from a misbehaving field
  const i = Math.floor(density * RAMP.length)
  return i >= RAMP.length ? RAMP.length - 1 : i
}

/**
 * Grid geometry for a box, given a column count.
 *
 * Rows are derived from the box's real aspect rather than fixed, so cells
 * stay square-ish and the art isn't stretched when the card's aspect
 * changes with the responsive grid.
 */
export function gridForBox(width, height, cols) {
  const cellW = width / cols
  const rows = Math.max(1, Math.round(height / (cellW / MONO_ASPECT)))
  return { cols, rows, cellW, cellH: height / rows }
}

/** Draw one frame of `field` into `ctx` at time `t` (seconds). */
export function drawAsciiField(ctx, { width, height, cols, field, t, color }) {
  const { rows, cellW, cellH } = gridForBox(width, height, cols)

  ctx.clearRect(0, 0, width, height)

  // Size the font so one glyph's advance width is exactly one cell. That's
  // what lets a whole row be drawn as a single string (below) instead of
  // one fillText per cell — at 56 columns that's the difference between
  // ~50 and ~1400 draw calls per frame, per card, and there are several
  // cards animating at once.
  ctx.font = `${cellW / MONO_ASPECT}px monospace`
  const advance = ctx.measureText('@').width
  const fontSize = advance > 0 ? (cellW / MONO_ASPECT) * (cellW / advance) : cellW / MONO_ASPECT
  ctx.font = `${fontSize}px monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = color

  // Sample once, then emit each row twice — once masked to the dim glyphs,
  // once to the bright ones — so the two alpha tiers cost two fillText
  // calls per row rather than a fillStyle change per cell.
  const dim = new Array(cols)
  const bright = new Array(cols)

  for (let row = 0; row < rows; row++) {
    const ny = rows === 1 ? 0 : (row / (rows - 1)) * 2 - 1
    let hasDim = false
    let hasBright = false

    for (let col = 0; col < cols; col++) {
      const nx = cols === 1 ? 0 : (col / (cols - 1)) * 2 - 1
      const i = rampIndex(field(nx, ny, t))
      if (i === 0) {
        dim[col] = ' '
        bright[col] = ' '
      } else if (i <= DIM_MAX_INDEX) {
        dim[col] = RAMP[i]
        bright[col] = ' '
        hasDim = true
      } else {
        dim[col] = ' '
        bright[col] = RAMP[i]
        hasBright = true
      }
    }

    const y = row * cellH
    if (hasDim) {
      ctx.globalAlpha = DIM_ALPHA
      ctx.fillText(dim.join(''), 0, y)
    }
    if (hasBright) {
      ctx.globalAlpha = 1
      ctx.fillText(bright.join(''), 0, y)
    }
  }

  ctx.globalAlpha = 1
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
