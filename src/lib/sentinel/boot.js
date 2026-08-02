/**
 * The Sentinel boot sequence: what the island does the very first time anyone
 * loads the site (T-099).
 *
 * The island leaves its dock, comes to the centre of the screen, expands, and
 * runs its own initialisation in front of the visitor: introduces itself,
 * generates the session id, forges the avatar out of that id, hands the avatar
 * to the bottom-left corner, and returns to its dock.
 *
 * This file is the table and the arithmetic only. The machine that walks it
 * lives in src/hooks/useSentinelBoot.js, and the rendering in
 * src/components/layout/DynamicIsland/. Keeping the stages pure means the
 * ordering, the budget and the copy can be tested in node, which is the same
 * split quips.js takes from useSentinelQuip.js (the project has no React test
 * framework, T-039).
 *
 * ## The budget
 *
 * Seven stages, ~16s. It ran at half that first, and every line was gone
 * before it could be read: a stage has to cover the text resolving out of its
 * scramble *and then* sit still long enough to actually read, and only the
 * second half of that is reading time. Owner decision after seeing it run, so
 * these numbers are deliberate rather than drifted, and the ceiling in
 * quips.test.js exists to keep them that way.
 *
 * Three things make the length affordable: it happens once ever per browser,
 * the page underneath stays fully interactive throughout, and any click or
 * keypress ends it immediately.
 *
 * ## Motion
 *
 * Nothing in the sequence snaps. Every transition it drives uses BOOT_EASE
 * below, and the springs it replaces (the pill's bouncy 0.25s layout, the
 * content swap's bounce of 0.5) are overridden while `phase === 'boot'`. The
 * pill is introducing itself, not reacting to a click.
 *
 * ## Unique animations
 *
 * T-094's rule applies here too: every stage that shows a glyph owns a grid
 * signature no quip uses. The forge is the exception and needs no signature,
 * because it is a 6x6 canvas rather than a GridLoader and is the only 6x6
 * animation in the app.
 */

/**
 * The one curve everything in the sequence moves on: a symmetric ease, slow off
 * the mark and slow into the stop. Exported so the island, the log and the
 * handoff cannot each pick their own and make the sequence read as several
 * animations that happen to be adjacent.
 */
export const BOOT_EASE = [0.65, 0, 0.35, 1]

/** How long the pill takes to fly to centre stage, and later to fly home. */
export const BOOT_TRAVEL_MS = 1400

/** The panel growing and shrinking around the log. */
export const BOOT_RESIZE_MS = 1100

/**
 * Ordered. `ms` is how long the stage holds; `line` is what the island says
 * (null for a wordless beat); `grid` is a GridLoader prop bag, or null when the
 * stage draws something else.
 *
 * `line` may be a function of the boot context, which is how the session beat
 * avoids claiming to generate an id that was already in storage.
 *
 * Durations budget for two things, not one: the scramble resolving the text
 * (BOOT_SCRAMBLE_MS) and then the line sitting still to be read. A stage of
 * 1600ms looked generous and gave barely a second of reading.
 */
export const BOOT_STAGES = [
  {
    id: 'wake',
    // Just the pill arriving and gathering itself. No text yet, so this only
    // has to cover its own flight in.
    ms: 1300,
    line: null,
    // `pulse`, not `stagger`: slowing this to match the rest of the sequence
    // made the staggered version identical to the "we're pretty deep now"
    // structural quip, which the uniqueness test caught.
    grid: { pattern: 'spiral-cw', mode: 'pulse', color: 'blue', speed: 'slow' },
  },
  {
    id: 'hello',
    // The longest, and the one that matters: it is the first thing Sentinel
    // ever says, and it arrives while the panel is still expanding around it.
    ms: 3200,
    line: () => 'Welcome, I am Sentinel!',
    grid: { pattern: 'face-grin', mode: 'pulse', color: 'white', speed: 'slow' },
  },
  {
    id: 'session',
    ms: 2400,
    // Sentinel does not narrate work it did not do. On a browser that already
    // had an id (a cleared `sentinel-visited` but intact `session_id`, or a
    // replay from Appearance) the honest line is that it found one.
    line: ({ minted }) => (minted ? 'Session id generating...' : 'Session id found...'),
    grid: { pattern: 'ripple-out', mode: 'stagger', color: 'blue', speed: 'slow' },
  },
  {
    id: 'session-done',
    // Short by design, but not so short the word cannot land: it replaces the
    // line above it in place rather than pushing it up, so the eye is already
    // there.
    ms: 1600,
    line: () => 'done!',
    // `stagger` rather than `pulse`: the pulsing green solo-center is already
    // the Algorithms quip, and solo-center shares its matrix with ripple-in and
    // breathing.
    grid: { pattern: 'solo-center', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  {
    id: 'forge',
    // Has to cover the whole 6x6 assembling one cell at a time. Rushed, the
    // cells arrive as a flicker rather than as something being built.
    ms: 3800,
    line: () => 'Generating avatar',
    // Drawn by AvatarForge, not GridLoader.
    grid: null,
  },
  {
    id: 'integrate',
    // Long enough for the avatar to travel the full diagonal to the sidebar and
    // for the colour to come up behind it.
    ms: 2200,
    line: () => 'Integrating',
    // The avatar itself is the visual here; a glyph beside it would compete.
    grid: null,
  },
  {
    id: 'settle',
    // The flight home, which is BOOT_TRAVEL_MS plus a beat to land.
    ms: 1600,
    line: null,
    grid: null,
  },
]

/**
 * How long a line spends resolving out of its scramble.
 *
 * ScrambleText randomises every character on an interval and then snaps to the
 * real text, so this is dead time as far as reading goes: whatever a stage
 * budgets, this much of it is not readable yet. Kept well under the shortest
 * stage so no line is still churning when its stage ends.
 */
export const BOOT_SCRAMBLE_MS = 900

/** Interval between scramble frames. Slow enough to read as churn, not noise. */
export const BOOT_SCRAMBLE_TICK_MS = 70

/** Fade between one log line and the next. */
export const BOOT_LINE_FADE_MS = 700

export const BOOT_STAGE_IDS = BOOT_STAGES.map((s) => s.id)

export const BOOT_TOTAL_MS = BOOT_STAGES.reduce((total, s) => total + s.ms, 0)

/** The stage during which the pill is expanded into its panel. */
export const EXPANDED_STAGES = new Set(['hello', 'session', 'session-done', 'forge', 'integrate'])

/** The stage at which the sidebar avatar takes colour. */
export const INTEGRATE_STAGE = 'integrate'

/** The stage at which the pill starts flying back to its dock. */
export const SETTLE_STAGE = 'settle'

export function stageAt(index) {
  return BOOT_STAGES[index] ?? null
}

export function stageIndexOf(id) {
  return BOOT_STAGES.findIndex((s) => s.id === id)
}

/**
 * Resolve a stage's line for a given context.
 *
 * @param {object|null} stage
 * @param {{ minted?: boolean }} [context]
 * @returns {string} empty when the stage is wordless
 */
export function lineFor(stage, context = {}) {
  if (!stage || typeof stage.line !== 'function') return ''
  return stage.line(context) || ''
}

/**
 * Whether the pill is expanded at this stage.
 *
 * `wake` and `settle` are deliberately outside it: the pill arrives collapsed
 * and leaves collapsed, so the expansion reads as Sentinel opening up to speak
 * rather than as the pill simply being big for a while.
 */
export function isExpanded(stageId) {
  return EXPANDED_STAGES.has(stageId)
}
