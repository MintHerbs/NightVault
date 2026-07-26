// Palette derivation for the Appearance system (T-062).
//
// One seed hex -> the full set of themed CSS custom properties, for both
// light and dark mode. This is the single source of truth for the colour
// maths: the preset themes' static blocks in src/styles/global.css are
// generated from these functions, and custom user-picked colours run the
// same functions at runtime (see src/hooks/useTheme.jsx), so presets and
// custom colours can never drift apart.
//
// Follows Material 3's tonal-palette model: a role is "this hue at this
// tone", where tone is 0 (black) to 100 (white). Approximated in HSL
// rather than real HCT — adding @material/material-color-utilities would
// drag an MD3 dependency into a project whose rules (docs/rules.md §5.2)
// keep Material as hand-authored tokens only.
//
// Two rules from the M3 colour guidance drive the light scheme:
//   1. Light surfaces are never pure #ffffff. They sit around tone 94-98
//      and carry a trace of the seed hue, so text has something to sit on
//      and the UI doesn't glare.
//   2. Body text is tone 10 (near-black), not mid-grey — that's what stops
//      light-mode text washing out.

export const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * '#ffa31a' | 'ffa31a' | '#f0a' -> '#ffa31a' / '#ff00aa'.
 * Returns null if the value isn't a 3- or 6-digit hex.
 */
export function normalizeHex(value) {
  const match = HEX_RE.exec(String(value ?? '').trim())
  if (!match) return null
  const digits = match[1].toLowerCase()
  const full = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits
  return `#${full}`
}

export function hexToRgb(hex) {
  const clean = normalizeHex(hex) ?? '#000000'
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  }
}

export function hexToHsl(hex) {
  const { r: r255, g: g255, b: b255 } = hexToRgb(hex)
  const r = r255 / 255
  const g = g255 / 255
  const b = b255 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
  }
  return { h: h * 60, s: s * 100, l: l * 100 }
}

export function hslToHex(h, s, l) {
  const sN = clamp(s, 0, 100) / 100
  const lN = clamp(l, 0, 100) / 100
  const k = (n) => (n + h / 30) % 12
  const a = sN * Math.min(lN, 1 - lN)
  const f = (n) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Relative luminance (WCAG) — used to pick black-vs-white on a colour. */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const channel = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * '#ffffff' or '#000000', whichever actually contrasts better against
 * `hex`. Measured rather than thresholded: a fixed luminance cutoff picked
 * white for mid-tone accents like cyan (#06b6d4), giving 2.4:1 where black
 * scores 8.6:1 — that's the label on a filled accent button, so it has to
 * be right.
 */
export function onColorFor(hex) {
  return contrastRatio('#000000', hex) >= contrastRatio('#ffffff', hex)
    ? '#000000'
    : '#ffffff'
}

/**
 * Walk a colour's lightness until it clears `target` contrast against
 * `bg`, keeping hue and saturation.
 *
 * This is the correction for HSL not being perceptually uniform: "50%
 * lightness" is much brighter for yellow-green than for blue, so a fixed
 * tone leaves some hues (Supabase green, cyan) failing contrast on a light
 * background while others pass comfortably. Solving for the ratio directly
 * gives every theme a legible accent without needing full HCT.
 */
export function adjustForContrast(hex, bg, target = 4.5, { darken = true } = {}) {
  const { h, s } = hexToHsl(hex)
  const step = darken ? -1 : 1
  let candidate = hex
  for (let i = 0; i < 100; i++) {
    if (contrastRatio(candidate, bg) >= target) return candidate
    const l = hexToHsl(candidate).l + step
    if (l <= 0 || l >= 100) break
    candidate = hslToHex(h, s, l)
  }
  return candidate
}

function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex)
  return `${r}, ${g}, ${b}`
}

// Chroma used for the neutral ramp. M3's neutral palette is near-grey with
// a trace of the source hue; these are the HSL saturations that read as
// "tinted grey" rather than "coloured".
const NEUTRAL_CHROMA = 6
const NEUTRAL_VARIANT_CHROMA = 10

/**
 * Full themed-token set for one seed colour in one mode.
 * Returns a plain { '--token': 'value' } map, ready to write either into a
 * stylesheet or onto an element's inline style.
 *
 * `achromatic` flattens chroma to zero (the Slate preset) so a neutral
 * theme reads as "no accent" rather than a desaturated blue.
 */
export function derivePalette(seedHex, mode, { achromatic = false } = {}) {
  const seed = normalizeHex(seedHex) ?? '#ffa31a'
  const { h, s: seedS, l: seedL } = hexToHsl(seed)
  const isLight = mode === 'light'

  const chroma = achromatic ? 0 : 1
  /** Neutral surface tone — barely tinted with the seed hue. */
  const neutral = (tone) => hslToHex(h, NEUTRAL_CHROMA * chroma, tone)
  /** Slightly more tinted neutral, for outlines and secondary text. */
  const neutralVariant = (tone) => hslToHex(h, NEUTRAL_VARIANT_CHROMA * chroma, tone)

  // --- Accent family --------------------------------------------------
  // Dark starts from the raw seed so the brand colour stays exactly
  // itself. Light starts near tone 40, because a colour tuned to glow on
  // black is far too pale to read on a near-white surface.
  //
  // Both are then contrast-corrected against their own background, which
  // is what keeps yellow-green hues (Hub, Supabase, Cyan) legible in light
  // mode — at a fixed tone those land around 3:1 while blues clear 6:1.
  const bg = isLight ? neutral(98) : neutral(4)
  const accentChroma = achromatic ? 8 : 70
  const accent = adjustForContrast(
    isLight ? hslToHex(h, accentChroma, 44) : seed,
    bg,
    4.5,
    { darken: isLight }
  )
  const { l: accentL, s: accentS } = hexToHsl(accent)
  const accentHover = isLight
    ? hslToHex(h, accentS, Math.max(accentL - 8, 6))
    : hslToHex(h, seedS, Math.max(seedL - 12, 8))
  const accentBright = isLight
    ? hslToHex(h, achromatic ? 10 : 62, 52)
    : hslToHex(h, seedS, Math.min(seedL + 12, 92))
  // Secondary "group" accent — the role --color-orange used to hold. A
  // deeper, hue-shifted sibling so the sidebar's two-tier nav distinction
  // (group vs child active state) survives in every theme. The shift is
  // *down* the wheel: for the orange seed that lands near the original
  // --color-orange (#EA6C0A), where shifting up would go yellow.
  const altHue = (h - 15 + 360) % 360
  const accentAlt = isLight
    ? hslToHex(altHue, achromatic ? 8 : 72, 36)
    : hslToHex(altHue, achromatic ? 0 : Math.min(seedS, 92), Math.max(seedL - 10, 28))

  // --- Foreground -----------------------------------------------------
  // Everything that used to be hardcoded white. Exposed as an "r, g, b"
  // triplet so components can keep their existing alpha ramps —
  // rgba(var(--color-fg-rgb), 0.6) — and have them invert with the mode.
  const text = isLight ? neutral(12) : neutral(96)
  const textMuted = isLight ? neutralVariant(40) : neutralVariant(72)
  const fgRgb = rgbTriplet(isLight ? neutral(10) : '#ffffff')

  return {
    // Accent
    '--color-accent': accent,
    '--color-accent-rgb': rgbTriplet(accent),
    '--color-accent-hover': accentHover,
    '--color-accent-bright': accentBright,
    '--color-accent-alt': accentAlt,

    // Foreground / neutrals
    '--color-fg-rgb': fgRgb,
    '--color-text': text,
    '--color-text-muted': textMuted,
    '--color-bg': isLight ? neutral(98) : neutral(4),
    // Page background as a triplet, for translucent panel fills that used
    // to be rgba(0,0,0,α). Drop shadows keep literal black — an M3 shadow
    // is dark in both modes — so only backgrounds use this.
    '--color-bg-rgb': rgbTriplet(isLight ? neutral(98) : neutral(3)),
    '--color-surface': isLight ? neutral(94) : neutral(9),
    '--color-border': isLight ? neutralVariant(84) : neutralVariant(20),
    '--color-muted': isLight ? neutralVariant(46) : neutralVariant(38),
    '--color-star': isLight ? neutral(20) : '#ffffff',

    // Tree/legacy aliases that back the page background and panels
    '--bg-dark': isLight ? neutral(97) : '#0d0d0d',
    '--bg-card': isLight ? neutral(94) : hslToHex(h, 22 * chroma, 9),
    '--bg-panel': isLight ? neutral(92) : hslToHex(h, 24 * chroma, 7),
    '--bg-controls': isLight ? neutral(95) : neutral(6),
    '--border-subtle': isLight ? neutralVariant(86) : hslToHex(h, 28 * chroma, 16),
    '--text-primary': text,
    '--text-muted': textMuted,
    '--pointer-slot': isLight ? neutral(90) : hslToHex(h, 30 * chroma, 13),
    '--edge-color': isLight ? neutralVariant(66) : neutralVariant(34),
    '--color-chat-own': isLight ? neutral(93) : neutral(10),
    '--color-chat-other': isLight ? neutral(96) : hslToHex(h, 24 * chroma, 9),

    // Material 3 roles
    '--md-primary': accent,
    '--md-on-primary': onColorFor(accent),
    '--md-primary-container': isLight
      ? hslToHex(h, achromatic ? 12 : 55, 90)
      : hslToHex(h, 37 * chroma, 20),
    '--md-on-primary-container': isLight
      ? hslToHex(h, achromatic ? 10 : 45, 18)
      : hslToHex(h, 60 * chroma, 89),
    '--md-surface-container-low': isLight ? neutral(96) : neutral(8),
    '--md-surface-container': isLight ? neutral(94) : neutral(11),
    '--md-surface-container-high': isLight ? neutral(92) : neutral(15),
    '--md-on-surface': isLight ? neutral(10) : neutral(92),
    '--md-on-surface-variant': isLight ? neutralVariant(30) : neutralVariant(78),
    '--md-outline-variant': isLight ? neutralVariant(80) : neutralVariant(22),
  }
}

/**
 * Read a themed token's *computed* value as a literal colour string.
 *
 * Needed by consumers that can't accept `var()` — canvas contexts and
 * third-party widgets configured with plain colour strings (Monaco's
 * `defineTheme`, for one). Accepts either a bare token name
 * ('--color-accent') or a wrapper ('var(--color-accent)'), so it can be
 * fed straight from the `colors` object in src/constants/colors.js.
 */
export function resolveThemeColor(token, fallback = '#000000') {
  if (typeof window === 'undefined') return fallback
  const name = String(token).replace(/^var\(\s*/, '').replace(/\s*\)$/, '').trim()
  if (!name.startsWith('--')) return token || fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** The built-in themes. Keys match the [data-color-theme] CSS blocks. */
export const PRESET_THEMES = [
  { key: 'hub', name: 'Hub Orange', seed: '#ffa31a' },
  { key: 'ghost', name: 'Ghost Purple', seed: '#8b5cf6' },
  { key: 'supabase', name: 'Supabase Green', seed: '#3ecf8e' },
  { key: 'hotpink', name: 'Hot Pink', seed: '#ff69b4' },
  { key: 'nebula', name: 'Nebula', seed: '#3b82f6' },
  { key: 'crimson', name: 'Crimson', seed: '#dc2626' },
  { key: 'cyan', name: 'Cyan', seed: '#06b6d4' },
  { key: 'rose', name: 'Rose', seed: '#ec4899' },
  { key: 'slate', name: 'Slate', seed: '#64748b', achromatic: true },
]
