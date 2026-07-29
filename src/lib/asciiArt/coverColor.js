// src/lib/asciiArt/coverColor.js
//
// What colour an ASCII cover is drawn in, and how it eases from one theme's
// accent to the next (T-077).
//
// A canvas can't consume `var(--color-accent)`, so the value has to be read
// out as a literal and repainted whenever the theme changes. Doing that
// *reliably* is the subtle part — see AsciiCanvas's observer for why reading
// it from a React effect races the ThemeProvider's own DOM write.

import { hexToRgb, resolveThemeColor } from '../theme/palette'

/** Crossfade duration when the accent changes. Long enough to read as a
 *  transition rather than a flash, short enough not to feel sluggish. */
export const COLOR_FADE_MS = 420

const FALLBACK = '#ffa31a' // same value as Hub Orange, the default accent

/**
 * Parse a CSS colour string to {r,g,b}.
 *
 * Custom properties come back as whatever text was authored — hex throughout
 * global.css and from derivePalette — but a browser is free to hand back a
 * normalised `rgb(...)`, so both forms are handled rather than assuming hex.
 */
export function parseCssColor(value) {
  const text = String(value ?? '').trim()
  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text)
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
    }
  }
  return hexToRgb(text || FALLBACK)
}

/** The accent colour a cover should currently use, as {r,g,b}. */
export function readAccentRgb() {
  return parseCssColor(resolveThemeColor('--color-accent', FALLBACK))
}

export function sameRgb(a, b) {
  return !!a && !!b && a.r === b.r && a.g === b.g && a.b === b.b
}

// Quick to depart, gentle to settle — the accent arrives without a jolt.
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

/** Interpolate `from` → `to` at eased progress `t` in [0,1]. */
export function mixRgb(from, to, t) {
  const e = easeOutCubic(t < 0 ? 0 : t > 1 ? 1 : t)
  return {
    r: Math.round(from.r + (to.r - from.r) * e),
    g: Math.round(from.g + (to.g - from.g) * e),
    b: Math.round(from.b + (to.b - from.b) * e),
  }
}

export function rgbCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`
}
