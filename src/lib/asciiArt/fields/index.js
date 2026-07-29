// src/lib/asciiArt/fields/index.js
//
// Procedural ASCII-cover animations (T-077). Each is a pure
// (nx, ny, t) => density function over nx, ny in [-1, 1] — see
// renderAsciiField.js for how they're consumed, and bitmapField.js for the
// character-art equivalent.
//
// This module is the raw field registry. The user-facing preset list (labels,
// which motif a course gets, what the admin picker offers) lives in
// src/constants/coverPresets.js.

export { default as blackhole } from './blackhole'
export { default as eye } from './eye'
export { default as latticeGrid } from './latticeGrid'
export { default as barMeter } from './barMeter'
export { default as graphPulse } from './graphPulse'
export { default as codeRain } from './codeRain'
export { default as spiralZoom } from './spiralZoom'
export { default as globePulse } from './globePulse'
export { default as dataScatter } from './dataScatter'
