/**
 * Quip catalog and resolution-ladder tests (T-094).
 * Run with: npm run test:sentinel
 *
 * Covers what can be wrong without a renderer: which rung of the ladder a
 * context lands on, whether every quip owns a unique grid animation, and
 * whether every animation names something GridLoader actually has. The React
 * wiring is verified in the browser pass, the same split useAIState.test.js
 * takes (no React test framework, T-039).
 *
 * GridLoader is TSX and the TOOLS registry imports directories, neither of
 * which plain node resolves, so both are read as source text and parsed. That
 * keeps the drift-detection this suite exists for: a pattern deleted from the
 * loader or a route renamed in the registry still fails here.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  CROWDED_ITEMS,
  DEEP_LEVELS,
  QUIPS,
  QUIP_COOLDOWN_MS,
  QUIP_HOLD_MS,
  QUIP_MIN_GAP_MS,
  QUIP_REPEAT_CHANCE,
  STALE_MS,
  gridSignature,
  resolveQuip,
} from './quips.js'
import { buildToolRouteIndex, matchRouteQuip } from './routeMatch.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', '..')

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

/** Pattern names GridLoader really carries, read off its PATTERNS record. */
function readGridPatterns() {
  const source = readFileSync(
    join(SRC, 'components', 'effects', 'smoothui', 'grid-loader', 'index.tsx'),
    'utf8',
  )
  const body = source.slice(source.indexOf('const PATTERNS'))
  // Hyphenated names are quoted, plain identifiers ("frame", "chaos") are not.
  return new Set([...body.matchAll(/^ {2}"?([A-Za-z0-9-]+)"?:\s*\[/gm)].map((m) => m[1]))
}

/** { id, route } for every tool, read off the TOOLS registry. */
function readToolRegistry() {
  const source = readFileSync(join(SRC, 'constants', 'tools.js'), 'utf8')
  const body = source.slice(source.indexOf('export const TOOLS'))
  const ids = [...body.matchAll(/^ {4}id: '([^']+)',$/gm)].map((m) => m[1])
  const routes = [...body.matchAll(/^ {4}route: '([^']+)',$/gm)].map((m) => m[1])
  return ids.map((id, i) => ({ id, route: routes[i] }))
}

const PATTERN_NAMES = readGridPatterns()
const TOOL_REGISTRY = readToolRegistry()
const TOOL_ROUTES = buildToolRouteIndex(TOOL_REGISTRY)
const routeQuip = (pathname, search) => matchRouteQuip(TOOL_ROUTES, pathname, search)

// The parsers themselves have to be right, or every check below passes vacuously.
assert(PATTERN_NAMES.size > 50, `0: parsed GridLoader patterns (${PATTERN_NAMES.size})`)
assert(PATTERN_NAMES.has('face-grin'), '0: parsed through to the last pattern in the record')
assert(TOOL_REGISTRY.length >= 10, `0: parsed the TOOLS registry (${TOOL_REGISTRY.length})`)
assert(TOOL_REGISTRY.every((t) => t.id && t.route), '0: every parsed tool has an id and a route')

// Pinned so variant selection cannot make a run flaky. Takes lines[0], which is
// the only variant most entries have anyway.
const first = () => 0
const NOW = Date.UTC(2026, 7, 2)

// 1. Curated rung: a known Subject, tool or chrome action wins outright.
assert(resolveQuip({ kind: 'module', id: 'web' }, first).id === 'module:web',
  '1: a known Subject resolves to its own quip')
assert(resolveQuip({ kind: 'module', id: 'web' }, first).line === 'Web. Like Spiderman?',
  '1: and to its own line')
assert(resolveQuip({ kind: 'tool', id: 'btree' }, first).id === 'tool:btree',
  '1: tools resolve on the same rung')
assert(resolveQuip({ kind: 'chrome', id: 'logout' }, first).id === 'chrome:logout',
  '1: so do chrome actions')
// The curated rung outranks everything derived: "Labs" is a Subject with its
// own line AND a name the lab keyword would match.
assert(resolveQuip({ kind: 'module', id: 'labs', name: 'Labs', itemCount: 3 }, first).id === 'module:labs',
  '1: a curated Subject beats a keyword its own name would match')

// 2. A Subject nobody has written a line for falls through rather than throwing.
assert(resolveQuip({ kind: 'module', id: 'brand-new', name: 'Whatever', itemCount: 4 }, first) === null,
  '2: an unknown Subject with nothing notable about it stays silent')

// 3. Empty outranks the name. Any name-based joke reads wrong on a folder with
// nothing in it, which is why this rung sits above keywords.
assert(resolveQuip({ kind: 'folder', name: 'week 3', itemCount: 0 }, first).id === 'struct:empty',
  '3: an empty folder is remarked on as empty, not as week 3')
assert(resolveQuip({ kind: 'module', id: 'nope', name: 'exam stuff', itemCount: 0 }, first).id === 'struct:empty',
  '3: an empty uncurated Subject too')

// 4. Keyword rung.
assert(resolveQuip({ kind: 'folder', name: 'Week 7', itemCount: 4 }, first).id === 'word:week',
  '4: week folders match')
assert(resolveQuip({ kind: 'folder', name: 'Week 7', itemCount: 4 }, first).line === "Week 7. We're getting somewhere.",
  '4: and interpolate the captured digits')
assert(resolveQuip({ kind: 'folder', name: 'week 03', itemCount: 4 }, first).line === "Week 3. We're getting somewhere.",
  '4: a zero-padded week reads as its number')
assert(resolveQuip({ kind: 'folder', name: 'Exam Revision', itemCount: 4 }, first).id === 'word:exam',
  '4: exam folders match')
assert(resolveQuip({ kind: 'folder', name: 'Past Papers', itemCount: 4 }, first).id === 'word:exam',
  '4: so do past papers')
assert(resolveQuip({ kind: 'folder', name: 'Lab 2', itemCount: 4 }, first).id === 'word:lab',
  '4: lab folders match')
// Word boundaries, so an ordinary word merely containing the token is not a match.
assert(resolveQuip({ kind: 'folder', name: 'Collaboration', itemCount: 4 }, first) === null,
  '4: "Collaboration" is not a lab')
assert(resolveQuip({ kind: 'folder', name: 'Weekly Digest', itemCount: 4 }, first) === null,
  '4: "Weekly" is not a numbered week')

// 5. The placeholder can never reach the screen unfilled.
for (const [id, quip] of Object.entries(QUIPS)) {
  for (const line of quip.lines) {
    if (line.includes('{n}')) {
      assert(id === 'word:week', `5: only word:week may carry a placeholder (${id})`)
    }
  }
}
assert(!resolveQuip({ kind: 'folder', name: 'Week 7', itemCount: 4 }, first).line.includes('{n}'),
  '5: a resolved week line has no placeholder left')

// 6. Structural rung, in its documented order.
assert(resolveQuip({ kind: 'folder', name: 'stuff', itemCount: 1 }, first).id === 'struct:single',
  '6: one file is remarked on')
assert(resolveQuip({ kind: 'folder', name: 'stuff', itemCount: CROWDED_ITEMS }, first).id === 'struct:crowded',
  '6: a crowded folder is remarked on at the threshold')
assert(resolveQuip({ kind: 'folder', name: 'stuff', itemCount: CROWDED_ITEMS - 1 }, first) === null,
  '6: and not one item below it')
assert(resolveQuip({ kind: 'folder', name: 'stuff', itemCount: 4, depth: DEEP_LEVELS }, first).id === 'struct:deep',
  '6: depth is remarked on at the threshold')
assert(resolveQuip({ kind: 'file', name: 'notes.pdf', now: NOW }, first).id === 'struct:pdf',
  '6: a PDF is remarked on')
assert(resolveQuip({ kind: 'file', name: 'notes.md', now: NOW }, first) === null,
  '6: an ordinary recent file is not')

// Staleness beats file type, as documented: the rarer observation wins.
assert(resolveQuip({ kind: 'file', name: 'old.pdf', updatedAt: new Date(NOW - STALE_MS - 1000).toISOString(), now: NOW }, first).id === 'struct:stale',
  '6: a stale PDF is remarked on for its age, not its type')
assert(resolveQuip({ kind: 'file', name: 'new.pdf', updatedAt: new Date(NOW - 1000).toISOString(), now: NOW }, first).id === 'struct:pdf',
  '6: a fresh PDF is remarked on for its type')
// A timestamp the database never set, or set to nonsense, must not read as
// infinitely old and slap "sitting here a while" on a note written today.
assert(resolveQuip({ kind: 'file', name: 'x.md', updatedAt: 'not a date', now: NOW }, first) === null,
  '6: an unparseable timestamp is not treated as stale')
assert(resolveQuip({ kind: 'file', name: 'x.md', updatedAt: null, now: NOW }, first) === null,
  '6: a missing timestamp is not treated as stale')

// 7. Bad input is answered with silence rather than a throw. These run inside
// navigation handlers, where an exception would cost the visitor the click.
assert(resolveQuip(null, first) === null, '7: null context')
assert(resolveQuip(undefined, first) === null, '7: undefined context')
assert(resolveQuip({}, first) === null, '7: empty context')
assert(resolveQuip({ kind: 'folder' }, first) === null, '7: a folder with no name or count')
assert(resolveQuip({ kind: 'nonsense', id: 'web' }, first) === null, '7: an unknown kind')

// 8. Every quip owns a unique animation. T-094's hard constraint, and the one
// rule that degrades silently: a copy-pasted entry still renders, it just makes
// two moments indistinguishable.
const signatures = new Map()
for (const [id, quip] of Object.entries(QUIPS)) {
  const signature = gridSignature(quip.grid)
  const claimed = signatures.get(signature)
  assert(!claimed, `8: ${id} reuses ${claimed}'s animation (${signature})`)
  signatures.set(signature, id)
}

// 9. Every quip is renderable. A pattern GridLoader does not know silently
// falls back to plus-hollow at runtime, so a typo would ship as a wrong
// animation rather than as an error.
const MODES = new Set(['pulse', 'sequence', 'stagger'])
const COLOR_KEYS = new Set(['white', 'red', 'blue', 'green', 'amber'])
const SPEED_KEYS = new Set(['slow', 'normal', 'fast'])
for (const [id, quip] of Object.entries(QUIPS)) {
  assert(Array.isArray(quip.lines) && quip.lines.length > 0, `9: ${id} has at least one line`)
  assert(quip.lines.every((l) => typeof l === 'string' && l.trim().length > 0), `9: ${id} lines are non-empty`)
  assert(PATTERN_NAMES.has(quip.grid.pattern), `9: ${id} uses a real pattern (${quip.grid.pattern})`)
  assert(MODES.has(quip.grid.mode), `9: ${id} uses a real mode (${quip.grid.mode})`)
  assert(COLOR_KEYS.has(quip.grid.color), `9: ${id} uses a real color (${quip.grid.color})`)
  assert(SPEED_KEYS.has(quip.grid.speed), `9: ${id} uses a real speed (${quip.grid.speed})`)
}

// 10. No line is long enough to overflow the pill. Mobile wraps to a second
// line rather than truncating, but one long enough to need a third would stop
// looking like a pill at all.
for (const [id, quip] of Object.entries(QUIPS)) {
  for (const line of quip.lines) {
    assert(line.length <= 44, `10: ${id} line fits the pill (${line.length} chars)`)
  }
}

// 11. Route mapping, against the routes the registry really declares.
assert(routeQuip('/tree', '').id === 'btree', '11: /tree is the B+ tree tool')
assert(routeQuip('/erd', '').id === 'erd', '11: /erd is the ERD tool')
// The four Digital Logic tools share a path and differ only by ?mode=.
assert(routeQuip('/arch/digital-logic', '?mode=algebra').id === 'boolean-algebra',
  '11: ?mode=algebra is Boolean Algebra')
assert(routeQuip('/arch/digital-logic', '?mode=kmap').id === 'truth-table-kmap',
  '11: ?mode=kmap is the K-map tool')
assert(routeQuip('/arch/digital-logic', '?mode=fsm').id === 'state-machine',
  '11: ?mode=fsm is the state machine')
assert(routeQuip('/arch/digital-logic', '?mode=sandbox').id === 'circuit-sandbox',
  '11: ?mode=sandbox is the sandbox')
assert(routeQuip('/arch/digital-logic', '') === null,
  '11: the bare Digital Logic path names no tool, so it says nothing')
// Specific before generic.
assert(routeQuip('/admin/settings', '').id === 'settings', '11: settings beats the admin door')
assert(routeQuip('/admin/editor', '').id === 'admin', '11: other admin routes are the admin door')
assert(routeQuip('/social/feed', '').id === 'feed', '11: the feed')
assert(routeQuip('/social/chat', '') === null, '11: chat fires off the panel flag, not the route')
assert(routeQuip('/home', '') === null, '11: an ordinary route says nothing')
assert(routeQuip('', '') === null, '11: an empty path says nothing')
assert(routeQuip(null, null) === null, '11: a missing path says nothing')

// A tool added to the registry without a line would route to a quip that does
// not exist and silently never speak.
for (const tool of TOOL_REGISTRY) {
  assert(Object.hasOwn(QUIPS, `tool:${tool.id}`), `11: tool ${tool.id} has a quip`)
}

// 12. The budget constants stay in a sane relationship to each other.
assert(QUIP_HOLD_MS < QUIP_MIN_GAP_MS, '12: a quip clears well before another may fire')
assert(QUIP_MIN_GAP_MS < QUIP_COOLDOWN_MS, '12: the per-quip cooldown outlasts the global gap')
assert(QUIP_REPEAT_CHANCE > 0 && QUIP_REPEAT_CHANCE < 1, '12: repeats are possible but not certain')
assert(QUIP_HOLD_MS >= 1500, '12: a quip stays up long enough to read')

if (failures > 0) {
  console.error(`sentinel quips: ${failures} failure(s)`)
  process.exit(1)
}
console.log(`sentinel quips: all tests passed (${Object.keys(QUIPS).length} quips)`)
