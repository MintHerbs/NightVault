// Guards the analytics allowlist and route canonicalisation (T-086).
//
// This module is the only thing standing between the database and arbitrary
// caller-supplied keys, and it is also where every ranking-correctness rule
// lives. The two failure directions are not symmetric:
//
//   - Letting an unknown path through pollutes the tables permanently.
//   - Mis-collapsing a known path silently splits or merges a page's traffic,
//     which does not look like a bug — it looks like a ranking.
//
// The second is the one these cases mostly protect.

import {
  ALIAS_PREFIX,
  ENTRY_ROUTE,
  PAGE_ROUTES,
  ROUTE_LABELS,
  TOOL_BY_ROUTE,
  TOOL_EVENTS,
  classifyPath,
  isPageRoute,
  isRecordableRoute,
  isToolEvent,
  routeLabel,
  toolForRoute,
} from '../../lib/analytics/eventSchema.js'

let failures = 0
const check = (name, cond, detail = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('\nCase 1: canonical pages classify as pages')
for (const route of ['/home', '/tree', '/erd', '/logic/proof', '/about', '/experimental']) {
  const r = classifyPath(route)
  check(route, r.kind === 'page' && r.routeKey === route, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 2: same-component aliases collapse to one key')
// These render the same component with no redirect, so they must merge or the
// page under-ranks. Tableaux answers to three paths.
const collapses = [
  ['/logic/truth-tree', '/logic/tableaux'],
  ['/logic/semantic-tableaux', '/logic/tableaux'],
  ['/algo/code-complexity', '/algo/complexity'],
  ['/algo/recurrence-relation', '/algo/recurrence'],
]
for (const [from, to] of collapses) {
  const r = classifyPath(from)
  check(`${from} -> ${to}`, r.kind === 'page' && r.routeKey === to, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 3: redirect sources are aliases, not pages')
// <Navigate> fires a second pageview at the destination, so counting these as
// pages would invent pages and inflate their targets.
for (const path of ['/', '/tools/cpa-calculator', '/tools/lazy-grades']) {
  const r = classifyPath(path)
  check(path, r.kind === 'alias' && r.routeKey === `${ALIAS_PREFIX}${path}`, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 4: the /notes-browser prefix collision')
// Bare '/notes-browser' redirects home; '/notes-browser/<course>' is a real
// page. The shorter string is a prefix of the longer, so ordering matters.
const bare = classifyPath('/notes-browser')
check('bare /notes-browser is an alias', bare.kind === 'alias', `${bare.kind}:${bare.routeKey}`)
const scoped = classifyPath('/notes-browser/computer-science')
check('scoped is a page', scoped.kind === 'page' && scoped.routeKey === '/notes-browser', `${scoped.kind}:${scoped.routeKey}`)
const deep = classifyPath('/notes-browser/cs/web/folder')
check('deep is the same page key', deep.kind === 'page' && deep.routeKey === '/notes-browser', deep.routeKey)

console.log('\nCase 5: dynamic segments collapse to a finite key space')
const dynamic = [
  ['/notes/web/ch16-platforms', '/notes'],
  ['/notes/database/ch1', '/notes'],
  ['/courses/9f8e7d6c-1234-4321-abcd-0123456789ab', '/courses/:id'],
  ['/courses/computer-science', '/courses/:id'],
]
for (const [from, to] of dynamic) {
  const r = classifyPath(from)
  check(`${from} -> ${to}`, r.kind === 'page' && r.routeKey === to, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 6: admin surfaces are never recorded')
for (const path of ['/admin', '/admin/editor', '/admin/analytics', '/admin/editor/web/notes/ch1']) {
  const r = classifyPath(path)
  check(path, r.kind === 'ignored' && r.routeKey === null, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 7: unknown paths are dropped, not stored')
const unknown = ['/nope', '/tree/../../etc/passwd', '/HOME', '/logic', '', null, undefined, 42, '/notes-browser-x']
for (const path of unknown) {
  const r = classifyPath(path)
  check(JSON.stringify(path), r.kind === 'ignored', `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 8: query strings, hashes and trailing slashes normalise')
const normalise = [
  ['/tools/grade-toolkit?mode=minmax', '/tools/grade-toolkit'],
  ['/tree/', '/tree'],
  ['/tree#node-3', '/tree'],
  ['/home?utm_source=whatsapp', '/home'],
]
for (const [from, to] of normalise) {
  const r = classifyPath(from)
  check(`${from} -> ${to}`, r.kind === 'page' && r.routeKey === to, `${r.kind}:${r.routeKey}`)
}

console.log('\nCase 9: isPageRoute excludes aliases and junk')
check('page key accepted', isPageRoute('/tree'))
check('alias key rejected', !isPageRoute(`${ALIAS_PREFIX}/`))
check('entry sentinel rejected', !isPageRoute(ENTRY_ROUTE))
check('unknown rejected', !isPageRoute('/whatever'))

console.log('\nCase 10: isRecordableRoute is the server-side gate')
check('page accepted', isRecordableRoute('/erd'))
check('entry sentinel accepted', isRecordableRoute(ENTRY_ROUTE))
check('known alias accepted', isRecordableRoute(`${ALIAS_PREFIX}/tools/lazy-grades`))
check('invented alias rejected', !isRecordableRoute(`${ALIAS_PREFIX}/made-up`))
check('unknown rejected', !isRecordableRoute('/made-up'))
check('empty rejected', !isRecordableRoute(''))

console.log('\nCase 11: tool events are allowlisted')
check('tree insert allowed', isToolEvent('tree', 'insert'))
check('tree open allowed', isToolEvent('tree', 'open'))
check('unknown event rejected', !isToolEvent('tree', 'drop-table'))
check('unknown tool rejected', !isToolEvent('nope', 'open'))
check('cross-tool event rejected', !isToolEvent('complexity', 'insert'))

console.log('\nCase 12: schema is internally consistent')
// These catch the realistic future mistake: adding a tool or a route and
// forgetting the matching entry elsewhere, which shows up as a silently
// unreportable tool rather than an error.
for (const [route, tool] of Object.entries(TOOL_BY_ROUTE)) {
  check(`${route} is a canonical page`, PAGE_ROUTES.includes(route))
  check(`${tool} has an event list`, Array.isArray(TOOL_EVENTS[tool]))
  check(`${tool} reserves 'open'`, TOOL_EVENTS[tool]?.includes('open'))
  check(`toolForRoute(${route})`, toolForRoute(route) === tool)
}
const mappedTools = new Set(Object.values(TOOL_BY_ROUTE))
for (const tool of Object.keys(TOOL_EVENTS)) {
  check(`${tool} is reachable from a route`, mappedTools.has(tool))
}
for (const route of PAGE_ROUTES) {
  check(`${route} has a label`, typeof ROUTE_LABELS[route] === 'string' && ROUTE_LABELS[route].length > 0)
}

console.log('\nCase 13: labels stay readable for non-page keys')
check('entry sentinel labelled', routeLabel(ENTRY_ROUTE) === 'Direct / external')
check('alias labelled as redirect', routeLabel(`${ALIAS_PREFIX}/tools/lazy-grades`).includes('redirect'))
check('unknown falls back to the key', routeLabel('/mystery') === '/mystery')

console.log(`\n${failures === 0 ? 'All analytics schema checks passed.' : `${failures} check(s) FAILED.`}\n`)
process.exit(failures === 0 ? 0 : 1)
