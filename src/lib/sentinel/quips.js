/**
 * Sentinel quips: what the island says about the thing you just opened.
 *
 * Distinct from the `aiState` vocabulary (docs/rules.md §15), which reports on
 * work in progress. A quip is Sentinel reacting to a navigation choice, so it
 * carries text and never blocks anything.
 *
 * Everything here is pure. The gating (cooldown, freshness, rate limit) and the
 * React wiring live in src/hooks/useSentinelQuip.js; this file only answers
 * "given what was clicked, what would Sentinel say", which is the part that can
 * be tested without a renderer (project has no React test framework, T-039).
 *
 * ## The resolution ladder
 *
 * A flat table keyed to today's Subject ids goes stale the moment an admin
 * creates a folder, so lookup falls through four rungs:
 *
 *   1. exact id      curated lines for a known Subject, tool or chrome action
 *   2. empty folder  a fact about what you opened, and the one structural case
 *                    that must outrank the name: any name-based joke reads
 *                    wrong attached to a folder with nothing in it
 *   3. keyword       tokens in the name (week N, exam, lab)
 *   4. structural    size, depth, file type, staleness
 *
 * Nothing matching is a valid outcome. Silence is better than a generic line,
 * and it keeps the budget for somewhere the reaction actually lands.
 *
 * ## Why the name is never quoted back
 *
 * Subject labels and folder names are admin-authored database content, not
 * fixed strings. A quip that interpolated the raw name would eventually pair a
 * punchline with something unfortunate, so only `week N` interpolates and only
 * the digits its own regex captured.
 *
 * ## Unique animation per quip
 *
 * T-094's hard constraint: every personality moment gets its own grid
 * animation, not a reuse of another moment's. `grid` is a GridLoader prop bag
 * and the signature (pattern + mode + color + speed) is asserted unique in
 * quips.test.js, so adding a quip that silently clones another one fails the
 * suite rather than shipping.
 */

/** How long a quip stays retired after being shown. A joke is funny once. */
export const QUIP_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

/** Floor between any two quips, whatever fired them. */
export const QUIP_MIN_GAP_MS = 20000

/**
 * Chance a quip fires when it has been shown before and has since come off
 * cooldown. A first-ever sighting always fires: that is the one that has to
 * land. Everything after is a bonus and should stay rare enough to surprise.
 */
export const QUIP_REPEAT_CHANCE = 0.35

/** Long enough to read a short line without stalling the pill. */
export const QUIP_HOLD_MS = 2600

/**
 * The catalog. Keys are `<kind>:<id>` for the curated rungs and `struct:<name>`
 * / `word:<name>` for the derived ones, so a quip id is self-describing in
 * storage and in the test output.
 *
 * `lines` holds the variants for one moment. More than one means a repeat
 * sighting after the cooldown is not word-for-word identical, the same trick
 * useSentinelGreeting takes with its welcome-back pool.
 */
export const QUIPS = {
  // Subjects, keyed to sidebar_modules.id.
  'module:web': {
    lines: ['Web. Like Spiderman?', 'With great power comes great CSS'],
    grid: { pattern: 'x-shape', mode: 'pulse', color: 'blue', speed: 'normal' },
  },
  'module:database': {
    lines: ['SELECT * FROM regrets', "Everything's a table if you're brave"],
    grid: { pattern: 'stripes-h', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  'module:computer-vision': {
    lines: ["It's watching you back"],
    grid: { pattern: 'ripple-out', mode: 'pulse', color: 'blue', speed: 'slow' },
  },
  'module:computer-security': {
    lines: ['Lock the door behind you'],
    grid: { pattern: 'frame-sync', mode: 'pulse', color: 'red', speed: 'normal' },
  },
  'module:operating-systems': {
    lines: ['Have you tried turning it off and on'],
    grid: { pattern: 'breathing', mode: 'pulse', color: 'white', speed: 'fast' },
  },
  'module:algorithms': {
    lines: ['Big O, no small talk'],
    grid: { pattern: 'ripple-in', mode: 'pulse', color: 'green', speed: 'fast' },
  },
  'module:artificial-intelligence': {
    lines: ["Careful, that's my family in there"],
    grid: { pattern: 'sparse-2', mode: 'stagger', color: 'blue', speed: 'slow' },
  },
  'module:computer-architecture': {
    lines: ['All the way down to the metal'],
    grid: { pattern: 'rows-alt', mode: 'stagger', color: 'amber', speed: 'normal' },
  },
  'module:computer-networking': {
    lines: ["It's always DNS"],
    grid: { pattern: 'snake', mode: 'stagger', color: 'blue', speed: 'fast' },
  },
  'module:math': {
    lines: ['Numbers. Great.'],
    grid: { pattern: 'checkerboard', mode: 'pulse', color: 'white', speed: 'slow' },
  },
  'module:software-engineering': {
    lines: ['Where code goes to get a process'],
    grid: { pattern: 'T-top', mode: 'stagger', color: 'green', speed: 'slow' },
  },
  'module:programming': {
    lines: ['It works on my machine'],
    grid: { pattern: 'rain', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  'module:labs': {
    lines: ['Goggles on'],
    grid: { pattern: 'duo-h', mode: 'pulse', color: 'amber', speed: 'normal' },
  },
  'module:notes': {
    lines: ['Notes about notes'],
    grid: { pattern: 'line-h-mid', mode: 'stagger', color: 'white', speed: 'normal' },
  },
  'module:experimental': {
    lines: ["This one's held together with tape"],
    grid: { pattern: 'chaos', mode: 'stagger', color: 'amber', speed: 'fast' },
  },
  'module:t053-sandbox': {
    lines: ["You're not supposed to be in here"],
    grid: { pattern: 'border', mode: 'pulse', color: 'red', speed: 'slow' },
  },

  // Tools, keyed to src/constants/tools.js ids.
  'tool:btree': {
    lines: ['Trees, but upside down'],
    grid: { pattern: 'T-bot', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  'tool:erd': {
    lines: ['Boxes and lines. My favourite.'],
    grid: { pattern: 'corners', mode: 'stagger', color: 'blue', speed: 'normal' },
  },
  'tool:complexity': {
    lines: ["Everything is O(n) if you don't measure"],
    grid: { pattern: 'diagonal-tl', mode: 'stagger', color: 'amber', speed: 'fast' },
  },
  'tool:recurrence': {
    lines: ['To understand recursion, see recursion'],
    grid: { pattern: 'ripple-in', mode: 'stagger', color: 'blue', speed: 'slow' },
  },
  'tool:semantic-tableaux': {
    lines: ['Truth, as a tree'],
    grid: { pattern: 'L-tl', mode: 'stagger', color: 'white', speed: 'normal' },
  },
  'tool:boolean-algebra': {
    lines: ['True, false, no in between'],
    grid: { pattern: 'duo-diag', mode: 'pulse', color: 'green', speed: 'fast' },
  },
  'tool:truth-table-kmap': {
    lines: ['Squares within squares'],
    grid: { pattern: 'frame', mode: 'stagger', color: 'blue', speed: 'fast' },
  },
  'tool:state-machine': {
    lines: ['Round and round'],
    grid: { pattern: 'edge-cw', mode: 'stagger', color: 'amber', speed: 'normal' },
  },
  'tool:circuit-sandbox': {
    lines: ["Don't cross the wires"],
    grid: { pattern: 'line-diag-1', mode: 'pulse', color: 'red', speed: 'fast' },
  },
  'tool:grades': {
    lines: ['Are you sure about this?'],
    grid: { pattern: 'line-v-mid', mode: 'pulse', color: 'red', speed: 'slow' },
  },

  // Chrome and navigation, fired by explicit actions rather than by a route.
  'chrome:theme-dark': {
    lines: ['Better.'],
    grid: { pattern: 'diagonal-br', mode: 'pulse', color: 'white', speed: 'slow' },
  },
  'chrome:theme-light': {
    lines: ['Ow.'],
    grid: { pattern: 'sparkle', mode: 'pulse', color: 'amber', speed: 'fast' },
  },
  'chrome:settings': {
    lines: ['Tinkering?'],
    grid: { pattern: 'plus-full', mode: 'stagger', color: 'blue', speed: 'slow' },
  },
  'chrome:admin': {
    lines: ['Boss mode'],
    grid: { pattern: 'corners-sync', mode: 'pulse', color: 'amber', speed: 'slow' },
  },
  'chrome:logout': {
    lines: ['See you'],
    grid: { pattern: 'ripple-out', mode: 'stagger', color: 'white', speed: 'fast' },
  },
  'chrome:music-restless': {
    lines: ["Nothing's good enough today"],
    grid: { pattern: 'wave-rl', mode: 'stagger', color: 'red', speed: 'normal' },
  },
  'chrome:chat': {
    lines: ['Say something'],
    grid: { pattern: 'sparse-1', mode: 'stagger', color: 'green', speed: 'fast' },
  },
  'chrome:feed': {
    lines: ['Doomscroll responsibly'],
    grid: { pattern: 'wave-bt', mode: 'stagger', color: 'blue', speed: 'fast' },
  },
  'chrome:search': {
    lines: ['What are we looking for'],
    grid: { pattern: 'solo-tl', mode: 'stagger', color: 'white', speed: 'fast' },
  },
  'chrome:lost': {
    lines: ['Lost?'],
    grid: { pattern: 'spiral-ccw', mode: 'stagger', color: 'white', speed: 'normal' },
  },

  // Derived from the name.
  'word:week': {
    // The only quip that interpolates, and only over digits its own regex
    // captured, never over the raw folder name.
    lines: ["Week {n}. We're getting somewhere."],
    grid: { pattern: 'wave-lr', mode: 'stagger', color: 'blue', speed: 'normal' },
  },
  'word:exam': {
    lines: ["Ah. It's that time."],
    grid: { pattern: 'cross', mode: 'pulse', color: 'red', speed: 'slow' },
  },
  'word:lab': {
    lines: ['Another lab. Of course.'],
    grid: { pattern: 'duo-v', mode: 'pulse', color: 'amber', speed: 'fast' },
  },

  // Derived from the shape of what was opened.
  'struct:empty': {
    lines: ['Nothing here. Bold choice.'],
    grid: { pattern: 'frame', mode: 'pulse', color: 'white', speed: 'slow' },
  },
  'struct:single': {
    lines: ['One file. Efficient.'],
    grid: { pattern: 'solo-center', mode: 'pulse', color: 'green', speed: 'normal' },
  },
  'struct:crowded': {
    lines: ["Hope you've got time"],
    grid: { pattern: 'waterfall', mode: 'stagger', color: 'amber', speed: 'fast' },
  },
  'struct:deep': {
    lines: ["We're pretty deep now"],
    grid: { pattern: 'spiral-cw', mode: 'stagger', color: 'blue', speed: 'slow' },
  },
  'struct:pdf': {
    lines: ['A PDF. Classic.'],
    grid: { pattern: 'line-h-bot', mode: 'pulse', color: 'white', speed: 'fast' },
  },
  'struct:stale': {
    lines: ['This has been sitting here a while'],
    grid: { pattern: 'twinkle', mode: 'pulse', color: 'amber', speed: 'slow' },
  },
}

/** A folder holding this many or more earns a remark about the pile. */
export const CROWDED_ITEMS = 50

/** Levels below the course root that count as "deep". */
export const DEEP_LEVELS = 4

/** Untouched for this long and the file gets noticed. */
export const STALE_MS = 90 * 24 * 60 * 60 * 1000

const WEEK_RE = /\bweek\s*0*(\d{1,2})\b/i
const EXAM_RE = /\b(exam|revision|past\s*papers?)\b/i
const LAB_RE = /\blabs?\b/i

/**
 * Which curated rung a context can hit, if any. Kinds that have no curated
 * table (folder, file) skip straight to the derived rungs.
 */
function curatedKey({ kind, id }) {
  if (!id) return null
  if (kind !== 'module' && kind !== 'tool' && kind !== 'chrome') return null
  const key = `${kind}:${id}`
  // Only a key the catalog actually carries counts as a match. Returning the
  // key unconditionally would let any Subject an admin creates short-circuit
  // the ladder and then resolve to nothing, so the derived rungs below would
  // never get a look at it.
  //
  // hasOwnProperty.call rather than Object.hasOwn: this ships to the browser,
  // and Vite's default target (Safari 14) predates Object.hasOwn by a year.
  return Object.prototype.hasOwnProperty.call(QUIPS, key) ? key : null
}

function keywordKey(name) {
  if (typeof name !== 'string' || !name) return null
  if (WEEK_RE.test(name)) return 'word:week'
  if (EXAM_RE.test(name)) return 'word:exam'
  if (LAB_RE.test(name)) return 'word:lab'
  return null
}

function structuralKey({ kind, name, itemCount, depth, updatedAt, now }) {
  if (kind === 'folder' || kind === 'module') {
    if (itemCount === 1) return 'struct:single'
    if (typeof itemCount === 'number' && itemCount >= CROWDED_ITEMS) return 'struct:crowded'
  }
  if (typeof depth === 'number' && depth >= DEEP_LEVELS) return 'struct:deep'
  if (kind === 'file') {
    // Staleness before file type: a document nobody has touched in a season is
    // a rarer observation than "this is a PDF", so it earns the slot.
    if (updatedAt) {
      const touched = new Date(updatedAt).getTime()
      if (Number.isFinite(touched) && now - touched >= STALE_MS) return 'struct:stale'
    }
    if (typeof name === 'string' && /\.pdf$/i.test(name)) return 'struct:pdf'
  }
  return null
}

/**
 * Pick the line and fill the one placeholder the catalog allows.
 *
 * `rand` is injected so the test can pin variant selection. Callers in the app
 * leave it at Math.random.
 */
function buildLine(quip, context, rand) {
  const line = quip.lines[Math.floor(rand() * quip.lines.length)] ?? quip.lines[0]
  if (!line.includes('{n}')) return line
  const match = WEEK_RE.exec(context.name ?? '')
  // A pattern-matched quip whose placeholder cannot be filled would render the
  // literal "{n}", so fall back to a plain reading of the same beat.
  if (!match) return 'Getting somewhere'
  return line.replace('{n}', match[1])
}

/**
 * Resolve what Sentinel would say about a context, or null for silence.
 *
 * @param {object} context
 * @param {'module'|'folder'|'file'|'tool'|'chrome'} context.kind
 * @param {string} [context.id] - Subject / tool / chrome action id
 * @param {string} [context.name] - display name, used only for keyword tests
 * @param {number} [context.itemCount] - children, for folders and Subjects
 * @param {number} [context.depth] - levels below the course root
 * @param {string} [context.updatedAt] - ISO timestamp, for files
 * @param {number} [context.now] - epoch ms, injected for testing
 * @param {() => number} [rand]
 * @returns {{ id: string, line: string, grid: object } | null}
 */
export function resolveQuip(context, rand = Math.random) {
  if (!context || typeof context !== 'object') return null
  const now = typeof context.now === 'number' ? context.now : Date.now()
  const ctx = { ...context, now }

  const key =
    curatedKey(ctx) ??
    // The one structural case that outranks the name, see the ladder note
    // above. Curated Subjects never reach it, so this only ever speaks for a
    // folder or for a Subject nobody has written a line for yet.
    ((ctx.kind === 'folder' || ctx.kind === 'module') && ctx.itemCount === 0
      ? 'struct:empty'
      : null) ??
    keywordKey(ctx.name) ??
    structuralKey(ctx)

  if (!key) return null
  const quip = QUIPS[key]
  // A key the catalog does not carry means a rung was renamed without its
  // entry. Silence beats throwing inside a navigation handler.
  if (!quip) return null

  return { id: key, line: buildLine(quip, ctx, rand), grid: quip.grid }
}

/** Signature the uniqueness rule is checked against. */
export function gridSignature(grid) {
  return `${grid.pattern}|${grid.mode}|${grid.color}|${grid.speed}`
}
