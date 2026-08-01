// The one place that defines what the analytics pipeline is allowed to record.
//
// Imported by BOTH the browser tracker (./tracker.js) and the serverless writer
// (api/analytics.js). Keeping it in one module is what makes the server's
// validation and the client's canonicalisation impossible to drift apart, and it
// is why 0052 deliberately does not restate the allowlist in SQL.
//
// Pure data and pure functions only: no DOM, no Node, no imports. Both callers
// depend on that.

/** from_route value meaning "arrived from outside the app". */
export const ENTRY_ROUTE = '(entry)'

/** Prefix marking a redirect source rather than a real page. */
export const ALIAS_PREFIX = 'alias:'

/**
 * Canonical page routes. This is the allowlist: a pathname that does not
 * resolve to one of these keys is dropped rather than recorded, so no
 * caller-invented string ever reaches the database.
 */
export const PAGE_ROUTES = [
  '/home',
  '/tree',
  '/erd',
  '/algo/complexity',
  '/algo/recurrence',
  '/logic/proof',
  '/logic/tableaux',
  '/arch/digital-logic',
  '/tools/grade-toolkit',
  '/notes',
  '/notes-browser',
  '/courses/:id',
  '/social/feed',
  '/social/chat',
  '/social/guidelines',
  '/about',
  '/disclaimer',
  '/terms',
  '/experimental',
]

const PAGE_ROUTE_SET = new Set(PAGE_ROUTES)

/**
 * Paths that render the SAME component as their canonical route, with no
 * redirect involved (src/routes/academiaRoutes.jsx). They must collapse into
 * one key or a single page's traffic splits across several and under-ranks —
 * the tableaux page alone answers to three of these. No double counting is
 * possible here because the location never changes.
 */
const SAME_PAGE_ALIASES = {
  '/algo/code-complexity': '/algo/complexity',
  '/algo/recurrence-relation': '/algo/recurrence',
  '/logic/truth-tree': '/logic/tableaux',
  '/logic/semantic-tableaux': '/logic/tableaux',
}

/**
 * Paths that render a <Navigate>. The location genuinely changes, so the
 * destination records its own hit moments later; counting these as pages would
 * both invent pages that do not exist (`/` is not a page) and inflate whatever
 * they redirect to. They are kept under the alias: prefix instead, because
 * which entry point someone used is still worth knowing — /tools/cpa-calculator
 * traffic says the fused Grade Toolkit is still being reached by its old name.
 */
const REDIRECT_SOURCES = [
  '/',
  '/notes-browser',
  '/tools/cpa-calculator',
  '/tools/lazy-grades',
]

const REDIRECT_SOURCE_SET = new Set(REDIRECT_SOURCES)

/** Tool key per canonical route, for the opened-vs-used leaderboard. */
export const TOOL_BY_ROUTE = {
  '/tree': 'tree',
  '/erd': 'erd',
  '/algo/complexity': 'complexity',
  '/algo/recurrence': 'recurrence',
  '/logic/proof': 'logic-proof',
  '/logic/tableaux': 'tableaux',
  '/tools/grade-toolkit': 'grade-toolkit',
  '/notes-browser': 'notes-browser',
  '/arch/digital-logic': 'digital-logic',
}

/**
 * Allowed interactions per tool. 'open' is reserved and emitted on arrival, so
 * every tool has an opened count without needing a tool -> route mapping in
 * SQL; everything else means the tool was actually driven.
 */
export const TOOL_EVENTS = {
  'tree': ['open', 'build', 'insert', 'delete', 'edit-key', 'reset', 'order'],
  'erd': ['open', 'generate', 'manual', 'step'],
  'complexity': ['open', 'analyze'],
  'recurrence': ['open', 'solve'],
  'logic-proof': ['open', 'prove'],
  'tableaux': ['open', 'solve', 'example'],
  'grade-toolkit': ['open', 'edit', 'mode-cpa', 'mode-minmax'],
  'notes-browser': ['open', 'open-file'],
  // Four modes behind one dropdown (T-089), so the mode-* events are the only
  // way to tell which part of the tool is actually being used. 'to-sandbox'
  // measures the handoff that justifies them sharing a page at all.
  'digital-logic': [
    'open', 'solve', 'step',
    'mode-algebra', 'mode-kmap', 'mode-sandbox', 'mode-fsm',
    'generate', 'manual', 'simulate', 'to-sandbox',
  ],
}

/** Display names. Kept beside the keys so the dashboard cannot drift from them. */
export const TOOL_LABELS = {
  'tree': 'B+ Tree',
  'erd': 'ERD generator',
  'complexity': 'Complexity',
  'recurrence': 'Recurrence',
  'logic-proof': 'Logic proof',
  'tableaux': 'Semantic tableaux',
  'grade-toolkit': 'Grade toolkit',
  'notes-browser': 'Notes browser',
  'digital-logic': 'Digital Logic',
}

export const ROUTE_LABELS = {
  '/home': 'Home',
  '/tree': 'B+ Tree',
  '/erd': 'ERD generator',
  '/algo/complexity': 'Complexity',
  '/algo/recurrence': 'Recurrence',
  '/logic/proof': 'Logic proof',
  '/logic/tableaux': 'Semantic tableaux',
  '/arch/digital-logic': 'Digital Logic',
  '/tools/grade-toolkit': 'Grade toolkit',
  '/notes': 'Notes (reading)',
  '/notes-browser': 'Notes browser',
  '/courses/:id': 'Course landing',
  '/social/feed': 'Social feed',
  '/social/chat': 'Chat',
  '/social/guidelines': 'Guidelines',
  '/about': 'About',
  '/disclaimer': 'Disclaimer',
  '/terms': 'Terms',
  '/experimental': 'Experimental',
}

/** Strip the query string, hash, and any trailing slash, but keep a bare '/'. */
function normalisePath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return ''
  const path = pathname.split('?')[0].split('#')[0]
  if (path === '/') return '/'
  return path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * Map a browser pathname onto a recordable key.
 *
 * @returns {{ kind: 'page'|'alias'|'ignored', routeKey: string|null }}
 *   'page'    a real, canonical page view
 *   'alias'   a redirect source — recorded, but excluded from page rankings
 *   'ignored' admin surfaces and anything not on the allowlist. Dropping
 *             unknown paths here is the allowlist: it is what stops an
 *             arbitrary string reaching the database.
 */
export function classifyPath(pathname) {
  const path = normalisePath(pathname)
  if (!path) return { kind: 'ignored', routeKey: null }

  // The admin panel is never measured. Owners and contributors working in here
  // all day would otherwise dominate a cohort-sized site's numbers.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return { kind: 'ignored', routeKey: null }
  }

  // Checked before the alias maps because bare '/notes-browser' is a redirect
  // source while '/notes-browser/<course>' is a real page: the shorter string
  // is a prefix of the longer one, so the specific test has to come first.
  if (REDIRECT_SOURCE_SET.has(path)) {
    return { kind: 'alias', routeKey: `${ALIAS_PREFIX}${path}` }
  }

  if (SAME_PAGE_ALIASES[path]) {
    return { kind: 'page', routeKey: SAME_PAGE_ALIASES[path] }
  }

  if (PAGE_ROUTE_SET.has(path)) {
    return { kind: 'page', routeKey: path }
  }

  // Dynamic segments collapse to one key each. Keeping the key space finite is
  // the point: per-course or per-folder keys would let any id become a row.
  // Individual notes are the deliberate exception and are counted by id in
  // note_reads, reported by NotesPage which already knows the note it loaded.
  if (path.startsWith('/notes/')) return { kind: 'page', routeKey: '/notes' }
  if (path.startsWith('/notes-browser/')) return { kind: 'page', routeKey: '/notes-browser' }
  if (path.startsWith('/courses/')) return { kind: 'page', routeKey: '/courses/:id' }

  return { kind: 'ignored', routeKey: null }
}

/** True for a key that counts as a page in rankings. */
export function isPageRoute(routeKey) {
  return typeof routeKey === 'string'
    && !routeKey.startsWith(ALIAS_PREFIX)
    && PAGE_ROUTE_SET.has(routeKey)
}

/** True for a key that is recordable at all (page or alias). */
export function isRecordableRoute(routeKey) {
  if (typeof routeKey !== 'string' || !routeKey) return false
  if (routeKey === ENTRY_ROUTE) return true
  if (routeKey.startsWith(ALIAS_PREFIX)) {
    return REDIRECT_SOURCE_SET.has(routeKey.slice(ALIAS_PREFIX.length))
  }
  return PAGE_ROUTE_SET.has(routeKey)
}

/** True only for a (tool, event) pair on the allowlist above. */
export function isToolEvent(toolKey, eventKey) {
  const allowed = TOOL_EVENTS[toolKey]
  return Array.isArray(allowed) && allowed.includes(eventKey)
}

/** Tool owning a canonical route, or null when the route is not a tool. */
export function toolForRoute(routeKey) {
  return TOOL_BY_ROUTE[routeKey] ?? null
}

/** Human label for a route key, falling back to the key itself. */
export function routeLabel(routeKey) {
  if (typeof routeKey !== 'string') return ''
  if (routeKey === ENTRY_ROUTE) return 'Direct / external'
  if (routeKey.startsWith(ALIAS_PREFIX)) {
    return `${routeKey.slice(ALIAS_PREFIX.length)} (redirect)`
  }
  return ROUTE_LABELS[routeKey] ?? routeKey
}

/** Human label for a tool key, falling back to the key itself. */
export function toolLabel(toolKey) {
  return TOOL_LABELS[toolKey] ?? toolKey
}
