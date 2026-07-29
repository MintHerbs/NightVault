// src/lib/asciiArt/imageToAscii.js
//
// Converts an uploaded image into the character grid bitmapField.js consumes
// (T-077), so a cover can be authored in the admin panel instead of only in
// code.
//
// The output is plain text, stored in a DB column rather than as a file in
// Storage: a grid this size is ~3 KB of ASCII, so it costs less than the
// bucket policy, signed-URL and CORS handling an image upload would need, and
// the card needs no second network round trip to render.

import { RAMP, MONO_ASPECT } from './renderAsciiField'

// Grid bounds. Wider than the 56-column render grid so the stored art survives
// being sampled at whatever size a card ends up, without the text column
// getting unwieldy. MAX_ROWS is a hard cap, not a formality: rows are derived
// from the source aspect, so a tall image (200x2000) would otherwise produce
// 432 rows -> a 31k-character grid that violates the 20k CHECK on
// courses.cover_ascii (db/sql/0047), and something like 10x3000 would ask for
// a 72x12960 canvas. Extreme aspects now shrink the column count instead, so
// the art stays undistorted and the grid stays bounded.
const MAX_COLS = 72
const MAX_ROWS = 120
const SQUARE_ROWS = Math.round(MAX_COLS * MONO_ASPECT)

/** Decode a File to something drawable. Mirrors imageToWebp.js's decode(). */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    // Explicit orientation for the same reason imageToWebp.js passes it: the
    // default changed across the spec's history, so a phone photo carrying an
    // EXIF rotation would otherwise be sampled sideways.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('decode failed'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Convert an image File to a newline-separated density grid.
 *
 * `invert` swaps which end of the brightness range becomes dense — needed
 * because a cover renders as light glyphs on a dark card, so a photo of a
 * dark subject on a light background comes out as a silhouette of its
 * background unless inverted.
 *
 * `contrast` stretches the sampled luminance range to full before quantising.
 * Without it a flat or low-contrast source collapses into one or two ramp
 * levels and reads as a solid block.
 */
export async function imageToAsciiGrid(file, { invert = false, contrast = true } = {}) {
  const source = await decode(file)
  const srcW = source.width || source.naturalWidth
  const srcH = source.height || source.naturalHeight
  if (!srcW || !srcH) throw new Error('image has no dimensions')

  // Fit the grid inside MAX_COLS x MAX_ROWS while preserving the source aspect
  // (a character cell is MONO_ASPECT as wide as it is tall). Clamping rows
  // alone would squash tall art, so an over-tall grid loses columns instead.
  let cols = MAX_COLS
  let rows = Math.round((cols * srcH * MONO_ASPECT) / srcW)
  if (rows > MAX_ROWS) {
    rows = MAX_ROWS
    cols = Math.max(8, Math.round((rows * srcW) / (srcH * MONO_ASPECT)))
  }
  rows = Math.max(4, rows)

  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')

  // Downscaling to one pixel per character cell is the sampling step — the
  // browser's own image smoothing does the box-averaging for us, which is
  // both faster and better than averaging by hand in JS.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, cols, rows)
  if (typeof source.close === 'function') source.close()

  const { data } = ctx.getImageData(0, 0, cols, rows)

  // Rec. 601 luma, premultiplied against alpha over black so a transparent
  // PNG's empty region reads as empty rather than as whatever RGB it carries.
  const luma = new Float32Array(cols * rows)
  let min = 1
  let max = 0
  for (let i = 0; i < luma.length; i++) {
    const o = i * 4
    const a = data[o + 3] / 255
    const v = ((data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255) * a
    luma[i] = v
    if (v < min) min = v
    if (v > max) max = v
  }

  const span = max - min
  const stretch = contrast && span > 0.02

  const lines = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      let v = luma[y * cols + x]
      if (stretch) v = (v - min) / span
      if (invert) v = 1 - v
      const idx = Math.min(RAMP.length - 1, Math.max(0, Math.round(v * (RAMP.length - 1))))
      line += RAMP[idx]
    }
    // Trailing blanks carry no information and parseGrid pads rows back out.
    lines.push(line.replace(/\s+$/, ''))
  }

  return lines.join('\n')
}

/** Grid dimensions a square source would produce — for placeholder previews. */
export const ASCII_GRID = { maxCols: MAX_COLS, maxRows: MAX_ROWS, squareRows: SQUARE_ROWS }
