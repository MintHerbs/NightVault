/**
 * Sentinel quips: what the island says about what you just did.
 *
 * Distinct from the `aiState` vocabulary (docs/rules.md §15), which reports on
 * work in progress. A quip is Sentinel reacting, so it carries text (or, for a
 * confirmation, deliberately none) and never blocks anything.
 *
 * Three families, all resolved through the same ladder:
 *
 *   what you opened   a Subject, folder, file, tool or chrome action
 *   what you did      copying, saving, sending, skimming, giving up on a timer
 *   what is true      the hour, a visit streak, the connection dropping
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
 * animation, not a reuse of another moment's. `grid` is a GridLoader prop bag,
 * and quips.test.js asserts uniqueness over the *resolved matrix* plus mode,
 * colour and speed rather than over the pattern name. That matters because the
 * loader carries aliases whose matrices are identical (border, frame and
 * ripple-out are one shape; so are sparkle and checkerboard), so two entries
 * could read as different and still look the same on screen.
 *
 * ## Pacing
 *
 * Three knobs, all optional per entry:
 *
 *   frequent    a wordless confirmation that must answer its action every
 *               time. Skips the cooldown and uses a much shorter floor. Only
 *               valid on an entry whose lines are empty, which the test
 *               enforces: a worded quip firing this often would be unbearable.
 *   cooldownMs  overrides the fortnight a joke gets. An observation about the
 *               hour or about a tool you are still fighting with is only worth
 *               making while it is still true.
 *   fallback    what a line with a {n} placeholder reads as when there is
 *               nothing to fill it with.
 */

/** How long a quip stays retired after being shown. A joke is funny once. */
export const QUIP_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

/** Floor between any two quips, whatever fired them. */
export const QUIP_MIN_GAP_MS = 20000

/**
 * The floor for `frequent` quips instead.
 *
 * A confirmation is not a joke. "You just copied that" has to answer the
 * action every time or it reads as broken, so those entries opt out of both
 * the cooldown and the ordinary floor. They are wordless flashes, so they
 * cannot crowd out anything worth reading; this shorter floor exists only to
 * stop a held key or a save loop strobing the pill.
 */
export const QUIP_FREQUENT_GAP_MS = 1500

/**
 * Chance a quip fires when it has been shown before and has since come off
 * cooldown. A first-ever sighting always fires: that is the one that has to
 * land. Everything after is a bonus and should stay rare enough to surprise.
 */
export const QUIP_REPEAT_CHANCE = 0.35

/** Long enough to read a short line without stalling the pill. */
export const QUIP_HOLD_MS = 2600

/**
 * Hold for a quip with no line. There is nothing to read, so the beat only has
 * to register as having happened; holding one of these for the full 2.6s reads
 * as the pill having got stuck.
 */
export const QUIP_FLASH_MS = 900

/**
 * Floor between two acks (see the ACKS table below).
 *
 * Short enough that deliberate presses each get their own answer, long enough
 * that a held arrow key produces a pulse rather than a strobe.
 */
export const ACK_MIN_GAP_MS = 400

/**
 * How long an ack holds. Shorter than even a wordless quip: this answers a
 * press the visitor made a fraction of a second ago and has already moved on
 * from, so it needs to register and get out of the way.
 */
export const ACK_FLASH_MS = 500

// Cooldown shorthands for entries that should come round again sooner than the
// fortnight a joke gets. An observation about the hour, or about a tool you are
// still fighting with, is only worth making while it is still true.
const HOURLY = 60 * 60 * 1000
const DAILY = 20 * HOURLY

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

  // Session and time of day. Fired when the island settles rather than by any
  // click, so they read as Sentinel noticing rather than answering.
  'moment:late-night': {
    cooldownMs: DAILY,
    lines: ['You should sleep'],
    grid: { pattern: 'face-drowsy', mode: 'pulse', color: 'amber', speed: 'slow' },
  },
  'moment:early-start': {
    cooldownMs: DAILY,
    lines: ['Early start'],
    grid: { pattern: 'wave-tb', mode: 'stagger', color: 'amber', speed: 'slow' },
  },
  'moment:streak': {
    cooldownMs: DAILY,
    lines: ['Day {n}'],
    fallback: 'Back again',
    grid: { pattern: 'stripes-v', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  'moment:anniversary': {
    lines: ['One year'],
    grid: { pattern: 'spiral-cw', mode: 'stagger', color: 'amber', speed: 'normal' },
  },
  'moment:back-again': {
    cooldownMs: HOURLY * 2,
    lines: ["Oh, you're back"],
    grid: { pattern: 'face-surprised', mode: 'pulse', color: 'white', speed: 'normal' },
  },

  // Connectivity.
  'moment:offline': {
    // Not `frequent`, despite being information rather than a joke: it carries
    // text, so it holds for the full read. A flapping connection would
    // otherwise put a 2.6s message on the pill every couple of seconds.
    cooldownMs: 2 * 60 * 1000,
    lines: ['No connection'],
    grid: { pattern: 'breathing', mode: 'pulse', color: 'red', speed: 'slow' },
  },
  'moment:online': {
    cooldownMs: 2 * 60 * 1000,
    lines: ["We're back"],
    grid: { pattern: 'ripple-out', mode: 'pulse', color: 'green', speed: 'normal' },
  },

  // Wordless beats. An empty line renders the glyph alone and holds for less
  // time: these confirm an action the visitor already knows they took, so a
  // sentence about it would be worse than a flash.
  //
  // `copied` and `saved` used to live here and are now acks (see the ACKS table
  // below): both answer a deliberate control press, which is that tier's whole
  // job. The two left are not presses — sending a message is a content action
  // with its own UI, and a startle is Sentinel waking up — so they stay quips
  // and `frequent` keeps its users.
  'moment:message-sent': {
    frequent: true,
    lines: [''],
    grid: { pattern: 'wave-lr', mode: 'stagger', color: 'green', speed: 'fast' },
  },
  'moment:startle': {
    frequent: true,
    lines: [''],
    grid: { pattern: 'face-surprised', mode: 'pulse', color: 'white', speed: 'fast' },
  },

  // Interaction signals picked up globally, no page involvement.
  'moment:print': {
    lines: ['Killing trees'],
    grid: { pattern: 'stripes-h', mode: 'stagger', color: 'white', speed: 'slow' },
  },
  'moment:drag': {
    cooldownMs: HOURLY / 2,
    lines: ["I'll take that"],
    grid: { pattern: 'T-top', mode: 'pulse', color: 'blue', speed: 'fast' },
  },
  'moment:poke': {
    cooldownMs: HOURLY,
    lines: ['Stop poking me'],
    grid: { pattern: 'face-squint', mode: 'pulse', color: 'amber', speed: 'fast' },
  },

  // Derived from aiState transitions, so every tool gets these for free.
  'moment:recovered': {
    cooldownMs: HOURLY / 2,
    lines: ['There we go'],
    grid: { pattern: 'face-grin', mode: 'pulse', color: 'green', speed: 'normal' },
  },
  'moment:struggling': {
    cooldownMs: HOURLY / 2,
    lines: ['Take your time'],
    grid: { pattern: 'face-soft', mode: 'pulse', color: 'amber', speed: 'slow' },
  },
  'moment:instant': {
    cooldownMs: HOURLY / 2,
    lines: ['Too easy'],
    grid: { pattern: 'face-wink', mode: 'pulse', color: 'green', speed: 'fast' },
  },

  // Study timer.
  'moment:locked-in': {
    cooldownMs: HOURLY * 2,
    lines: ['Locked in'],
    grid: { pattern: 'frame-sync', mode: 'pulse', color: 'green', speed: 'slow' },
  },
  'moment:timer-abandoned': {
    lines: ["We don't talk about that timer"],
    grid: { pattern: 'face-flat', mode: 'pulse', color: 'white', speed: 'slow' },
  },

  // Reading a note.
  'moment:finished-note': {
    lines: ['You actually finished it'],
    grid: { pattern: 'line-h-bot', mode: 'stagger', color: 'green', speed: 'slow' },
  },
  'moment:skimming': {
    cooldownMs: HOURLY,
    lines: ['Skimming, are we'],
    grid: { pattern: 'rain', mode: 'stagger', color: 'white', speed: 'fast' },
  },
  'moment:note-again': {
    lines: ['This one again'],
    grid: { pattern: 'face-squint', mode: 'pulse', color: 'white', speed: 'normal' },
  },

  // Searching.
  'moment:no-results': {
    cooldownMs: HOURLY,
    lines: ['Nothing. Try fewer words'],
    grid: { pattern: 'face-flat', mode: 'pulse', color: 'amber', speed: 'normal' },
  },
  'moment:still-looking': {
    cooldownMs: HOURLY,
    lines: ['Still looking?'],
    grid: { pattern: 'ripple-in', mode: 'pulse', color: 'white', speed: 'normal' },
  },

  // Social.
  'moment:first-post': {
    lines: ['Your first post. Bold.'],
    grid: { pattern: 'sparkle', mode: 'stagger', color: 'green', speed: 'normal' },
  },
  'moment:rapid-chat': {
    cooldownMs: HOURLY,
    lines: ["Slow down, I'm reading"],
    grid: { pattern: 'chaos', mode: 'stagger', color: 'blue', speed: 'fast' },
  },
  'moment:alone-in-chat': {
    cooldownMs: HOURLY * 2,
    lines: ['Just us then'],
    grid: { pattern: 'solo-center', mode: 'pulse', color: 'white', speed: 'slow' },
  },
  'moment:late-post': {
    lines: ['Posting at this hour?'],
    grid: { pattern: 'face-drowsy', mode: 'pulse', color: 'blue', speed: 'normal' },
  },

  // Editing.
  'moment:published': {
    cooldownMs: HOURLY,
    lines: ['Live'],
    grid: { pattern: 'ripple-out', mode: 'stagger', color: 'green', speed: 'slow' },
  },
  'moment:unsaved': {
    cooldownMs: HOURLY / 2,
    lines: ['Unsaved for a while'],
    grid: { pattern: 'face-wince', mode: 'pulse', color: 'amber', speed: 'normal' },
  },

  // Easter eggs.
  'easter:konami': {
    cooldownMs: HOURLY,
    lines: ['You found it'],
    grid: { pattern: 'chaos', mode: 'stagger', color: 'green', speed: 'slow' },
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

/**
 * ## Acks: the second tier
 *
 * A quip is a remark and has to be rationed. An ack is an acknowledgement and
 * has to be reliable: press a control, get an answer, every time. Those are
 * opposite requirements, which is why this is a separate table with separate
 * pacing rather than a looser setting on the one above. Routing button presses
 * through the quip gates would answer roughly one press in twenty, and
 * loosening those gates would make the *worded* quips unbearable.
 *
 * Two rules make the tier bearable rather than a strobe:
 *
 *   wordless   an ack never carries text. There is nothing to read, so it
 *              cannot crowd out anything that is worth reading, and it holds
 *              for ACK_FLASH_MS rather than the 2.6s a line needs.
 *   per verb   acks are keyed to the *action*, not to the button. "Sentinel
 *              took my input" has to look the same in the B+ tree as in the
 *              tableaux or it means nothing at all, and sixty distinct glyphs
 *              would be sixty shapes nobody can tell apart.
 *
 * What deliberately has no entry here: anything that already drives `aiState`.
 * docs/rules.md §15.1 makes every tool *input* move the island and §15.4
 * guarantees even instant work paints a state, so an ack on a pill submit would
 * be the island talking over itself. This tier is for the controls that set no
 * state at all, which until now were silent.
 */
export const ACKS = {
  // Transport, shared by every tool built on useAnimationPlayer.
  'ack:step-forward': { pattern: 'T-right', mode: 'pulse', color: 'white', speed: 'fast' },
  'ack:step-back': { pattern: 'T-left', mode: 'pulse', color: 'white', speed: 'fast' },
  'ack:play': { pattern: 'duo-diag', mode: 'stagger', color: 'green', speed: 'fast' },
  'ack:pause': { pattern: 'duo-h', mode: 'pulse', color: 'amber', speed: 'fast' },
  'ack:skip-end': { pattern: 'line-v-right', mode: 'stagger', color: 'white', speed: 'fast' },
  'ack:rewind': { pattern: 'line-v-left', mode: 'stagger', color: 'white', speed: 'fast' },
  'ack:speed-up': { pattern: 'wave-lr', mode: 'stagger', color: 'amber', speed: 'fast' },
  'ack:speed-down': { pattern: 'wave-rl', mode: 'stagger', color: 'amber', speed: 'slow' },

  // Input that went nowhere. Only for refusals that do not set `error`
  // themselves, so the island never reports the same failure twice.
  'ack:reject': { pattern: 'x-shape', mode: 'pulse', color: 'red', speed: 'fast' },

  // Confirmations, migrated off the quip table's `frequent` flag.
  'ack:copy': { pattern: 'L-tr', mode: 'pulse', color: 'white', speed: 'fast' },
  'ack:save': { pattern: 'L-bl', mode: 'pulse', color: 'green', speed: 'fast' },

  // Chrome inside a tool.
  'ack:mode-switch': { pattern: 'stripes-v', mode: 'stagger', color: 'blue', speed: 'fast' },
  // `stagger`, not `pulse`: ripple-in shares its matrix with solo-center and
  // breathing, and the pulsing white version is already the Operating Systems
  // quip. The uniqueness test compares resolved matrices for exactly this
  // reason.
  'ack:clear': { pattern: 'ripple-in', mode: 'stagger', color: 'white', speed: 'fast' },
}

/**
 * Resolve an ack family to its glyph, or null for silence.
 *
 * Deliberately far simpler than resolveQuip: there is no ladder, no variant
 * pool and no context. An ack is one shape for one verb, which is the entire
 * reason it can be read at 500ms.
 *
 * @param {string} family - e.g. 'step-forward'
 * @returns {{ id: string, line: '', grid: object } | null}
 */
export function resolveAck(family) {
  if (typeof family !== 'string' || !family) return null
  const id = `ack:${family}`
  if (!Object.prototype.hasOwnProperty.call(ACKS, id)) return null
  return { id, line: '', grid: ACKS[id] }
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
const CURATED_KINDS = new Set(['module', 'tool', 'chrome', 'moment', 'easter'])

function curatedKey({ kind, id }) {
  if (!id) return null
  if (!CURATED_KINDS.has(kind)) return null
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

  // Two sources, in the order the two placeholder-bearing quips need them: a
  // caller-supplied count (a visit streak), then digits lifted out of a folder
  // name (week N).
  if (Number.isFinite(context.count)) return line.replace('{n}', String(context.count))
  const match = WEEK_RE.exec(context.name ?? '')
  if (match) return line.replace('{n}', match[1])

  // A placeholder with nothing to fill it would render the literal "{n}", so
  // fall back to a plain reading of the same beat rather than showing the
  // template.
  return quip.fallback ?? 'Getting somewhere'
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
 * @param {number} [context.count] - fills the {n} placeholder, for a streak
 * @param {() => number} [rand]
 * @returns {{ id: string, line: string, grid: object, frequent: boolean,
 *   cooldownMs: number } | null}
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

  return {
    id: key,
    line: buildLine(quip, ctx, rand),
    grid: quip.grid,
    frequent: quip.frequent === true,
    cooldownMs: quip.cooldownMs ?? QUIP_COOLDOWN_MS,
  }
}

/** Signature the uniqueness rule is checked against. */
export function gridSignature(grid) {
  return `${grid.pattern}|${grid.mode}|${grid.color}|${grid.speed}`
}
