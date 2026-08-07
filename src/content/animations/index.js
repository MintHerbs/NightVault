// Registry for the `::anim{id="…"}` note directive.
//
// Animations are CODE-DEFINED, not authored in note content, and that is the
// security boundary: a note's Markdown can only name an animation by id, never
// supply SVG of its own. So the reader keeps its no-rehype-raw guarantee (see
// MarkdownRenderer) while still being able to embed a stepped, playable figure.
// An unknown id renders nothing.
//
// Why this exists at all, given the site already had animated figures: those
// are plain `.svg` files behind an `<img>`, whose CSS keyframes run on their own
// clock and cannot be reached from the page. A student who wants to stop on the
// frame they are actually reading has no way to. Frames here are separate
// groups in one inline SVG, so the player decides which is showing — which is
// what makes pause and step-by-step possible.
//
// Each entry:
//   id       stable slug used in note content — renaming one orphans the note
//   label    accessible name, announced to screen readers and shown on hover
//   alt      one-line description of what the figure shows, for the a11y tree
//   width    viewBox width in px; the figure scales to the reader column
//   height   viewBox height in px
//   mode     'replace' shows one frame at a time (a walkthrough)
//            'build'   shows every frame up to the current one (a diagram
//                      accumulating, e.g. an ERD growing sentence by sentence)
//   defs     optional shared <defs>/backdrop painted beneath every frame
//   frames   [{ caption, svg, hold }]
//              caption  the line of text shown under the figure for this step
//              svg      SVG source for this frame, no <svg> wrapper
//              hold     ms to sit on this frame when playing (default HOLD_MS)

import { ANIMATION_ID_RE } from '../../constants/noteAnimations'
import { databaseAnimations } from './database'
import { bplusAnimations } from './bplus'
import { erdAnimations } from './erd'

const ALL = [...databaseAnimations, ...bplusAnimations, ...erdAnimations]

const BY_ID = new Map(ALL.map((entry) => [entry.id, entry]))

/** Default ms a frame is held during playback when it does not set its own. */
export const HOLD_MS = 2000

/** The animation for an id, or null. Never throws on unknown input. */
export function getAnimation(id) {
  if (!ANIMATION_ID_RE.test(String(id ?? ''))) return null
  return BY_ID.get(id) ?? null
}

/** Every registered id, for the build-time check that notes reference real ones. */
export function allAnimationIds() {
  return ALL.map((entry) => entry.id)
}
