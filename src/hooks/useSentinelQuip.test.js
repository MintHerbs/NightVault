/**
 * Gating tests for the quip emitter (T-094).
 * Run with: npm run test:sentinel
 *
 * The catalog and the resolution ladder are covered in
 * src/lib/sentinel/quips.test.js; this covers the layer above it, which is
 * where the interesting failures live. Both were real defects caught in review
 * rather than hypotheticals: a quip marked seen but never shown spends a
 * two-week cooldown on a beat nobody saw, and a deferred quip overwritten by
 * the page arrival that follows it never speaks at all.
 *
 * Only the module-level emitter is exercised. The hook needs a renderer and is
 * verified in the browser pass, the same split useAIState.test.js takes (no
 * React test framework, T-039). Without a subscriber the emitter can never
 * reach its display path, so these cases assert the gates in front of it:
 * what gets dropped, what gets held, and what gets spent.
 */

function makeStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  }
}

// Installed before the module is imported: it reads storage at call time, not
// at load time, but the stubs have to exist before anything calls in.
globalThis.localStorage = makeStorage()
globalThis.sessionStorage = makeStorage()

const { deferQuip, fireQuip, setQuipBusy } = await import('./useSentinelQuip.js')
const { QUIP_MIN_GAP_MS } = await import('../lib/sentinel/quips.js')

const SEEN_KEY = 'sentinel-quips-seen'
const PENDING_KEY = 'sentinel-quip-pending'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}
const pending = () => {
  const raw = globalThis.sessionStorage.getItem(PENDING_KEY)
  return raw ? JSON.parse(raw) : null
}

// 1. With nothing subscribed, nothing is shown and nothing is spent. The
// island is the only subscriber, so this is also the state during a page load
// before it has mounted.
setQuipBusy(false)
globalThis.localStorage.clear()
globalThis.sessionStorage.clear()
assert(fireQuip({ kind: 'module', id: 'web' }) === false,
  '1: an unsubscribed island shows nothing')
assert(globalThis.localStorage.getItem(SEEN_KEY) === null,
  '1: and a quip nobody could see is not marked seen')

// 2. A busy island drops rather than spends. This is what the busy flag exists
// for: without it the quip goes on a two-week cooldown having never appeared.
setQuipBusy(true)
assert(fireQuip({ kind: 'module', id: 'web' }) === false, '2: a busy island shows nothing')
assert(globalThis.localStorage.getItem(SEEN_KEY) === null, '2: and does not mark it seen')
assert(pending() === null, '2: nor holds it, without deferIfBusy')

// 3. deferIfBusy holds it instead of dropping it. Some moments can only ever
// happen while the island is occupied: the skip buttons exist only inside the
// open music panel, which is itself a state that outranks a quip.
fireQuip({ kind: 'tool', id: 'btree' }, { deferIfBusy: true })
assert(pending()?.context?.id === 'btree', '3: a busy fire with deferIfBusy is held')
assert(pending()?.explicit === false, '3: and is marked opportunistic')

// 4. An opportunistic defer must not displace a deliberate one. Signing out
// stores "See you" and then hard-navigates to /admin, whose own arrival would
// otherwise overwrite it with "Boss mode" before either could be shown.
globalThis.sessionStorage.clear()
deferQuip({ kind: 'chrome', id: 'logout' })
fireQuip({ kind: 'chrome', id: 'admin' }, { deferIfBusy: true })
assert(pending()?.context?.id === 'logout',
  '4: a deliberate defer survives an opportunistic one landing on top')
assert(pending()?.explicit === true, '4: and stays marked deliberate')

// 5. Two opportunistic defers do overwrite each other: the newest is the page
// the visitor is actually looking at.
globalThis.sessionStorage.clear()
fireQuip({ kind: 'tool', id: 'btree' }, { deferIfBusy: true })
fireQuip({ kind: 'tool', id: 'erd' }, { deferIfBusy: true })
assert(pending()?.context?.id === 'erd', '5: the newer opportunistic defer wins')

// 6. A deliberate defer overwrites anything.
deferQuip({ kind: 'chrome', id: 'logout' })
assert(pending()?.context?.id === 'logout',
  '6: a deliberate defer overwrites an opportunistic one')

// 7. Settling drains the slot exactly once, whether or not the quip went on to
// pass its later gates. A slot that survived would re-fire on every settle for
// the rest of the session.
setQuipBusy(false)
assert(pending() === null, '7: settling clears the pending slot')
setQuipBusy(true)
setQuipBusy(false)
assert(pending() === null, '7: and a second settle finds nothing left to drain')

// 8. Storage being unavailable must not throw. Private mode and blocked
// cookies are ordinary, and every one of these runs inside a click handler or
// a navigation effect, where an exception costs the visitor the action.
const workingSession = globalThis.sessionStorage
const workingLocal = globalThis.localStorage
const hostile = {
  getItem() { throw new Error('denied') },
  setItem() { throw new Error('denied') },
  removeItem() { throw new Error('denied') },
}
globalThis.sessionStorage = hostile
globalThis.localStorage = hostile
let threw = false
try {
  deferQuip({ kind: 'chrome', id: 'logout' })
  fireQuip({ kind: 'module', id: 'web' })
  fireQuip({ kind: 'module', id: 'web' }, { deferIfBusy: true })
  setQuipBusy(true)
  setQuipBusy(false)
} catch {
  threw = true
}
assert(!threw, '8: hostile storage never throws out of the emitter')
globalThis.sessionStorage = workingSession
globalThis.localStorage = workingLocal

// 9. Corrupt stored values read as absent rather than crashing on parse. These
// keys are visitor-writable through devtools and survive across deploys, so a
// shape change must degrade rather than break the pill.
globalThis.sessionStorage.setItem(PENDING_KEY, '{not json')
globalThis.localStorage.setItem(SEEN_KEY, 'also not json')
threw = false
try {
  setQuipBusy(true)
  setQuipBusy(false)
  fireQuip({ kind: 'module', id: 'web' })
  deferQuip({ kind: 'chrome', id: 'logout' }, { explicit: false })
} catch {
  threw = true
}
assert(!threw, '9: corrupt storage is survived')

// A pending entry in the old shape (a bare context, before `explicit` existed)
// must not be mistaken for a deliberate one, and must not crash the drain.
globalThis.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ kind: 'chrome', id: 'admin' }))
threw = false
try {
  setQuipBusy(true)
  setQuipBusy(false)
} catch {
  threw = true
}
assert(!threw, '9: a pending entry in the old shape is survived')

// 10. The floor between quips is long enough that clicking through folders is
// not a running commentary.
assert(QUIP_MIN_GAP_MS >= 10000, '10: at least ten seconds between quips')

if (failures > 0) {
  console.error(`sentinel emitter: ${failures} failure(s)`)
  process.exit(1)
}
console.log('sentinel emitter: all tests passed')
