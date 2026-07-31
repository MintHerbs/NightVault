// Exercises the allowlist boundary in api/analytics.js (T-086).
//
// This is the only thing between the analytics tables and arbitrary
// caller-supplied keys. The tables have no anon grants, so a bug here is not a
// write-anything hole, but it would let junk keys accumulate permanently in a
// dataset whose whole value is being trustworthy.
//
// Run via npm run test:analytics.
import { sanitise } from '../../../api/analytics.js'

let failures = 0
const check = (name, cond, detail = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const SESSION = '3f2a9c10-4b8e-4c21-9a77-15de3b6c8a90'
const NOTE = '9f8e7d6c-1234-4321-abcd-0123456789ab'

console.log('\nCase 1: a well-formed batch survives intact')
{
  const { batch, accepted, dropped } = sanitise({
    pages: [{ route_key: '/tree', session_id: SESSION, hits: 3 }],
    notes: [{ note_id: NOTE, session_id: SESSION, hits: 1 }],
    transitions: [{ from_route: '/home', to_route: '/tree', count: 1 }],
    tools: [{ tool_key: 'tree', event_key: 'insert', session_id: SESSION, count: 12 }],
  })
  check('all four accepted', accepted === 4, `accepted=${accepted}`)
  check('nothing dropped', dropped === 0, `dropped=${dropped}`)
  check('page hits preserved', batch.pages[0].hits === 3)
  check('tool count preserved', batch.tools[0].count === 12)
}

console.log('\nCase 2: unknown keys are dropped, not stored')
{
  const { batch, accepted, dropped } = sanitise({
    pages: [
      { route_key: '/tree', session_id: SESSION },
      { route_key: '/not-a-route', session_id: SESSION },
      { route_key: 'DROP TABLE page_hits', session_id: SESSION },
      { route_key: '/admin/editor', session_id: SESSION },
    ],
    tools: [
      { tool_key: 'tree', event_key: 'insert', session_id: SESSION },
      { tool_key: 'tree', event_key: 'exfiltrate', session_id: SESSION },
      { tool_key: 'made-up', event_key: 'open', session_id: SESSION },
    ],
  })
  check('only the valid page kept', batch.pages.length === 1 && batch.pages[0].route_key === '/tree')
  check('only the valid tool event kept', batch.tools.length === 1 && batch.tools[0].event_key === 'insert')
  check('accepted counts the survivors', accepted === 2, `accepted=${accepted}`)
  check('dropped counts the rest', dropped === 5, `dropped=${dropped}`)
}

console.log('\nCase 3: one bad entry never discards the whole batch')
// A queued beacon can legitimately carry a stale note id after a note is
// deleted. Losing that one entry is correct; losing the session is not.
{
  const { batch, accepted } = sanitise({
    pages: [
      { route_key: 'garbage', session_id: SESSION },
      { route_key: '/erd', session_id: SESSION },
      { route_key: '/home', session_id: SESSION },
    ],
  })
  check('valid entries still present', batch.pages.length === 2, `kept=${batch.pages.length}`)
  check('accepted reflects them', accepted === 2)
}

console.log('\nCase 4: aliases are recordable as pages but never as edges')
// An alias is a redirect source. Letting one into a transition would insert a
// navigation hop that never happened.
{
  const { batch } = sanitise({
    pages: [{ route_key: 'alias:/tools/cpa-calculator', session_id: SESSION }],
    transitions: [
      { from_route: 'alias:/', to_route: '/home', count: 1 },
      { from_route: '/home', to_route: 'alias:/', count: 1 },
      { from_route: '(entry)', to_route: '/home', count: 1 },
    ],
  })
  check('alias accepted as a page hit', batch.pages.length === 1)
  check('alias rejected on both ends of an edge', batch.transitions.length === 1, `kept=${batch.transitions.length}`)
  check('entry sentinel accepted as a source', batch.transitions[0].from_route === '(entry)')
}

console.log('\nCase 5: session ids are bounded')
{
  const bad = ['', 'short', 'x'.repeat(200), 'has spaces in it', "'; drop--", null, 42]
  for (const session_id of bad) {
    const { accepted } = sanitise({ pages: [{ route_key: '/tree', session_id }] })
    check(`rejected ${JSON.stringify(session_id)?.slice(0, 24)}`, accepted === 0)
  }
  const { accepted } = sanitise({ pages: [{ route_key: '/tree', session_id: SESSION }] })
  check('accepts a real uuid', accepted === 1)
}

console.log('\nCase 6: note ids must be uuids')
{
  const { accepted } = sanitise({
    notes: [
      { note_id: NOTE, session_id: SESSION },
      { note_id: 'not-a-uuid', session_id: SESSION },
      { note_id: '../../etc/passwd', session_id: SESSION },
    ],
  })
  check('only the uuid kept', accepted === 1, `accepted=${accepted}`)
}

console.log('\nCase 7: counts are clamped, not trusted')
{
  const { batch } = sanitise({
    pages: [
      { route_key: '/tree', session_id: SESSION, hits: 999_999_999 },
      { route_key: '/erd', session_id: SESSION, hits: -50 },
      { route_key: '/home', session_id: SESSION, hits: 'lots' },
      { route_key: '/about', session_id: SESSION, hits: 2.7 },
    ],
  })
  const byRoute = Object.fromEntries(batch.pages.map(p => [p.route_key, p.hits]))
  check('huge clamped to 1000', byRoute['/tree'] === 1000, String(byRoute['/tree']))
  check('negative floored to 1', byRoute['/erd'] === 1, String(byRoute['/erd']))
  check('non-numeric defaults to 1', byRoute['/home'] === 1, String(byRoute['/home']))
  check('fractional truncated', byRoute['/about'] === 2, String(byRoute['/about']))
}

console.log('\nCase 8: batch size is bounded and junk shapes do not throw')
{
  const flood = Array.from({ length: 5000 }, () => ({ route_key: '/tree', session_id: SESSION }))
  const { batch } = sanitise({ pages: flood })
  check('capped at 200 entries', batch.pages.length === 200, `kept=${batch.pages.length}`)

  for (const shape of [null, undefined, {}, { pages: 'nope' }, { pages: [null, 7, 'x'] }, { tools: {} }]) {
    let threw = false
    try { sanitise(shape) } catch { threw = true }
    check(`no throw on ${JSON.stringify(shape)?.slice(0, 22)}`, !threw)
  }
}

console.log(`\n${failures === 0 ? 'All analytics handler checks passed.' : `${failures} check(s) FAILED.`}\n`)
process.exit(failures === 0 ? 0 : 1)
