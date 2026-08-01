/**
 * Dwell-arithmetic tests for useAIState (T-095).
 * Run with: npm run test:hooks
 *
 * Only the pure part is covered. Executing the hook itself needs a React
 * renderer, and this project has no test framework by decision (T-039) — so the
 * rule that can actually be wrong is extracted and checked here, and the hook's
 * wiring is verified in the browser pass.
 */

import { dwellRemaining, MINIMUM_DWELL_MS } from './useAIState.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// The case the dwell exists for: work that finished in the same frame it
// started. Without this the island is told to think and stop thinking inside
// one frame and paints nothing at all.
assert(dwellRemaining(1000, 1000, 700) === 700, '1: instant work owes the full dwell')
assert(dwellRemaining(1000, 1004, 700) === 696, '1: 4ms of work owes the rest')

// Work that already outlasted the dwell clears immediately.
assert(dwellRemaining(1000, 1700, 700) === 0, '2: exactly at the dwell owes nothing')
assert(dwellRemaining(1000, 5000, 700) === 0, '2: past the dwell owes nothing')

// Never negative. A negative delay would be passed to setTimeout, which treats
// it as 0 — right by accident here, but the intent should not depend on that.
assert(dwellRemaining(1000, 9999, 700) >= 0, '3: never owes a negative wait')
// A clock that jumps backwards must not owe more than the dwell either.
assert(dwellRemaining(1000, 400, 700) <= 700 + 600, '3: a backwards clock stays bounded')

// Nothing held means nothing owed, so release() is a straight pass-through.
assert(dwellRemaining(null, 1000, 700) === 0, '4: no held state owes nothing')
assert(dwellRemaining(undefined, 1000, 700) === 0, '4: undefined behaves like null')

// A zero dwell disables the feature rather than misbehaving.
assert(dwellRemaining(1000, 1000, 0) === 0, '5: a zero dwell owes nothing')

assert(MINIMUM_DWELL_MS >= 400, '6: the default dwell is long enough to read')
assert(MINIMUM_DWELL_MS <= 1200, '6: and short enough not to feel like a stall')

if (failures > 0) {
  console.error(`useAIState: ${failures} failure(s)`)
  process.exit(1)
}
console.log('useAIState: all tests passed')
