// src/constants/coverPresets.js
//
// The user-facing ASCII-cover catalogue (T-077): what each card's animation
// is, what the admin cover picker offers, and what a brand-new course gets
// before anyone chooses for it.
//
// Raw field functions live in src/lib/asciiArt/fields (procedural) and
// src/lib/asciiArt/bitmaps (character art). This module names them, decides
// which are eligible as an automatic default, and resolves a course row to
// the field its card should render.

import {
  blackhole, eye, latticeGrid, barMeter,
  graphPulse, codeRain, spiralZoom, globePulse, dataScatter,
} from '../lib/asciiArt/fields'
import { computer } from '../lib/asciiArt/bitmaps/computer'
import { folder } from '../lib/asciiArt/bitmaps/folder'
import { btree } from '../lib/asciiArt/bitmaps/btree'
import { makeBitmapField } from '../lib/asciiArt/bitmapField'

// Character-art presets are built once at module load, not per render — every
// makeBitmapField call reparses the grid.
const computerField = makeBitmapField(computer, { animation: 'scanline' })
const folderField = makeBitmapField(folder, { animation: 'scanline' })
const btreeField = makeBitmapField(btree, { animation: 'scanline' })

/** The Notes card's cover, shown on every course landing page. */
export const NOTES_COVER = folderField

/** The B+ Tree tool card's cover — consumed via src/constants/tools.js. */
export const BTREE_COVER = btreeField

/**
 * Every preset the admin picker can offer.
 *
 * `pool: true` marks a preset as eligible for automatic assignment to a new
 * course. The excluded ones are the motifs that mean something specific
 * elsewhere in the UI — a folder (Notes), a bar meter (Grade Toolkit), an eye
 * (Socials), a computer (Computer Science) — so a new course never lands on
 * an animation that already reads as a different destination.
 */
export const COVER_PRESETS = [
  { key: 'computer',    label: 'Computer',        field: computerField },
  { key: 'blackhole',   label: 'Black hole',      field: blackhole,   pool: true },
  { key: 'eye',         label: 'Eye',             field: eye },
  { key: 'dataScatter', label: 'Scatter plot',    field: dataScatter, pool: true },
  { key: 'latticeGrid', label: 'Lattice',         field: latticeGrid, pool: true },
  { key: 'globePulse',  label: 'Globe',           field: globePulse,  pool: true },
  { key: 'spiralZoom',  label: 'Recursive rings', field: spiralZoom,  pool: true },
  { key: 'codeRain',    label: 'Code rain',       field: codeRain,    pool: true },
  { key: 'graphPulse',  label: 'Node graph',      field: graphPulse,  pool: true },
  { key: 'btree',       label: 'B+ tree',         field: btreeField },
  { key: 'asciiFolder', label: 'Folder',          field: folderField },
  { key: 'barMeter',    label: 'Bar meter',       field: barMeter },
]

export const PRESET_BY_KEY = new Map(COVER_PRESETS.map((p) => [p.key, p]))

const POOL = COVER_PRESETS.filter((p) => p.pool)

/**
 * Pick a preset for an id that has no explicit cover yet.
 *
 * Hashed from the id rather than actually random: a course keeps the same
 * animation across reloads and across visitors (a truly random pick would
 * reshuffle on every mount, which reads as a glitch), while still spreading
 * different courses over different motifs with no manual step. Overriding it
 * is either a code change here or an admin cover choice.
 *
 * Note the index is taken modulo the pool length, so adding or removing a
 * `pool: true` preset reshuffles which motif every *unassigned* course gets.
 * That's fine by design — a course whose look actually matters should have an
 * explicit mapping below or a saved admin cover, not rely on the hash.
 */
export function pickPresetForId(id) {
  const key = String(id ?? '')
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return POOL[Math.abs(hash) % POOL.length]
}

// Explicit per-course motifs, keyed by `courses.id`. Prod's ids are
// human-readable slugs (see src/lib/coursesApi.js); anything not listed
// falls through to pickPresetForId.
const COURSE_PRESET_KEYS = {
  'computer-science': 'computer',
  'data-science': 'dataScatter',
  'computer-with-mathematics': 'blackhole',
}

/**
 * The field a course card should render, in precedence order: an uploaded
 * character-art cover, then an explicitly chosen preset, then this file's
 * per-course mapping, then the hashed default.
 */
export function resolveCoverField(course) {
  if (!course) return pickPresetForId('').field

  if (course.coverAscii) {
    return makeBitmapField(course.coverAscii, { animation: course.coverAnim || 'scanline' })
  }
  const chosen = course.coverPreset && PRESET_BY_KEY.get(course.coverPreset)
  if (chosen) return chosen.field

  const mapped = PRESET_BY_KEY.get(COURSE_PRESET_KEYS[course.id])
  if (mapped) return mapped.field

  return pickPresetForId(course.id).field
}
