/**
 * Visit-record and aiState-transition tests (T-094).
 * Run with: npm run test:sentinel
 *
 * Both modules are state machines fed by things that are awkward to reproduce
 * live: days passing, clocks moving backwards, a run of failures interrupted by
 * an unrelated idle. That is exactly the part worth testing without a renderer.
 */

import {
  STREAK_FLOOR,
  daysBetween,
  isLateHour,
  localDayKey,
  nextRecord,
  sessionMomentFor,
} from './session.js'
import { INITIAL_AI_MEMORY, INSTANT_MS, STRUGGLE_RUN, nextAIMemory } from './aiMoments.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

// Local noon, so no timezone this test could run in pushes these into a
// neighbouring day and makes the suite depend on where it is run.
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0).getTime()

// 1. Day keys are local, not UTC. A visitor studying late in a positive offset
// must not have their streak broken by a UTC midnight that already passed.
assert(localDayKey(at(2026, 8, 2)) === '2026-08-02', '1: a local day key')
assert(localDayKey(at(2026, 8, 2, 23)) === '2026-08-02', '1: late evening is still that day')
assert(localDayKey(at(2026, 8, 3, 1)) === '2026-08-03', '1: after midnight is the next day')
assert(localDayKey(at(2026, 1, 5)) === '2026-01-05', '1: month and day are zero-padded')

// 2. Day arithmetic, including across a month and a year boundary.
assert(daysBetween('2026-08-02', '2026-08-03') === 1, '2: consecutive days')
assert(daysBetween('2026-08-31', '2026-09-01') === 1, '2: across a month')
assert(daysBetween('2026-12-31', '2027-01-01') === 1, '2: across a year')
assert(daysBetween('2026-08-02', '2026-08-02') === 0, '2: the same day')
assert(daysBetween('2026-08-05', '2026-08-02') === -3, '2: backwards is negative')
assert(daysBetween('nonsense', '2026-08-02') === null, '2: junk is null, not NaN')

// 3. A first visit starts a run of one.
const first = nextRecord(null, at(2026, 8, 2))
assert(first.streak === 1, '3: a first visit is day one')
assert(first.lastDay === '2026-08-02', '3: and records the day')
assert(first.firstAt === at(2026, 8, 2), '3: and when it was')

// 4. A second load the same day advances nothing and breaks nothing. This is
// the common case by far: most visits are several page loads.
const sameDay = nextRecord(first, at(2026, 8, 2, 18))
assert(sameDay.streak === 1, '4: the same day does not advance the run')
assert(sameDay.firstAt === first.firstAt, '4: and keeps the original first visit')

// 5. Consecutive days build; a gap resets.
const day2 = nextRecord(first, at(2026, 8, 3))
assert(day2.streak === 2, '5: the next day continues the run')
const day3 = nextRecord(day2, at(2026, 8, 4))
assert(day3.streak === 3, '5: and again')
const afterGap = nextRecord(day3, at(2026, 8, 8))
assert(afterGap.streak === 1, '5: a missed day restarts the run')
assert(afterGap.firstAt === first.firstAt, '5: without forgetting the first visit')

// 6. A clock that moved backwards, or a corrupt record, restarts rather than
// producing a negative or absurd run.
assert(nextRecord(day3, at(2026, 7, 1)).streak === 1, '6: a backwards clock restarts')
assert(nextRecord({ lastDay: 'junk', streak: 9 }, at(2026, 8, 2)).streak === 1,
  '6: a corrupt day restarts')
assert(nextRecord({}, at(2026, 8, 2)).streak === 1, '6: an empty record is a first visit')

// 7. The timing remark. One at most, in priority order.
const NOON = at(2026, 8, 2, 12)
assert(sessionMomentFor({ now: NOON, record: { streak: 1, firstAt: NOON } }) === null,
  '7: an ordinary midday visit with no run says nothing')
assert(sessionMomentFor({ now: NOON, record: { streak: STREAK_FLOOR, firstAt: NOON } })?.id === 'streak',
  '7: a run at the floor is remarked on')
assert(sessionMomentFor({ now: NOON, record: { streak: STREAK_FLOOR, firstAt: NOON } })?.count === STREAK_FLOOR,
  '7: and carries the count for the line to interpolate')
assert(sessionMomentFor({ now: NOON, record: { streak: STREAK_FLOOR - 1, firstAt: NOON } }) === null,
  '7: one below the floor is not')

// A brand new visitor is already getting the one-time introduction, so nothing
// here may pile on top of it.
assert(sessionMomentFor({ now: at(2026, 8, 2, 2), record: { streak: 1, firstAt: NOON }, wasFirstEver: true }) === null,
  '7: a first-ever visitor is left to the greeting')

// Hours, and the priority between them and everything above.
assert(sessionMomentFor({ now: at(2026, 8, 2, 2), record: { streak: 1, firstAt: NOON } })?.id === 'late-night',
  '7: 2am is late')
assert(sessionMomentFor({ now: at(2026, 8, 2, 6), record: { streak: 1, firstAt: NOON } })?.id === 'early-start',
  '7: 6am is early')
assert(sessionMomentFor({ now: at(2026, 8, 2, 9), record: { streak: 1, firstAt: NOON } }) === null,
  '7: 9am is neither')
assert(sessionMomentFor({ now: at(2026, 8, 2, 2), record: { streak: 5, firstAt: NOON } })?.id === 'streak',
  '7: a run outranks the hour')
const yearAgo = at(2025, 7, 1)
assert(sessionMomentFor({ now: NOON, record: { streak: 5, firstAt: yearAgo } })?.id === 'anniversary',
  '7: a year outranks the run')

// 8. isLateHour is the same boundary the late-post quip uses.
assert(isLateHour(at(2026, 8, 2, 1)) === true, '8: 1am is late')
assert(isLateHour(at(2026, 8, 2, 4)) === true, '8: 4am is late')
assert(isLateHour(at(2026, 8, 2, 5)) === false, '8: 5am is not')
assert(isLateHour(at(2026, 8, 2, 23)) === false, '8: 11pm is not, by this definition')

// 9. aiState transitions: work that finished inside the dwell reads as instant.
let m = INITIAL_AI_MEMORY
let step = nextAIMemory(m, { previous: 'idle', next: 'thinking', now: 1000 })
assert(step.moment === null, '9: starting work says nothing')
step = nextAIMemory(step.memory, { previous: 'thinking', next: 'idle', now: 1000 + INSTANT_MS })
assert(step.moment?.id === 'instant', '9: work that resolved inside the window is remarked on')

// Work that genuinely took a while is not.
step = nextAIMemory(INITIAL_AI_MEMORY, { previous: 'idle', next: 'generating', now: 1000 })
step = nextAIMemory(step.memory, { previous: 'generating', next: 'idle', now: 1000 + INSTANT_MS + 1 })
assert(step.moment === null, '9: work past the window is not')

// A page moving between working states keeps its original start, so a long
// task is not credited as a quick one just because it changed state late on.
// (The focus state is a separate case, covered in 12.)
step = nextAIMemory(INITIAL_AI_MEMORY, { previous: 'idle', next: 'thinking', now: 1000 })
step = nextAIMemory(step.memory, { previous: 'thinking', next: 'generating', now: 5000 })
step = nextAIMemory(step.memory, { previous: 'generating', next: 'idle', now: 5200 })
assert(step.moment === null, '9: a mid-task state change does not restart the clock')

// 10. An error run is noticed once, at the threshold, not on every failure past it.
m = INITIAL_AI_MEMORY
for (let i = 1; i < STRUGGLE_RUN; i += 1) {
  step = nextAIMemory(m, { previous: 'thinking', next: 'error', now: i * 1000 })
  m = step.memory
  assert(step.moment === null, `10: failure ${i} of the run says nothing yet`)
}
step = nextAIMemory(m, { previous: 'thinking', next: 'error', now: 9000 })
m = step.memory
assert(step.moment?.id === 'struggling', '10: the run threshold is remarked on')
step = nextAIMemory(m, { previous: 'thinking', next: 'error', now: 10000 })
m = step.memory
assert(step.moment === null, '10: and not again on the next failure')

// 11. Recovery. The error state clears to idle on its own (App does this after
// 3s), and that clearing must not be mistaken for success.
step = nextAIMemory(m, { previous: 'error', next: 'idle', now: 11000 })
m = step.memory
assert(step.moment === null, '11: an error clearing is not a success')
assert(m.errorRun > 0, '11: and does not reset the run')

step = nextAIMemory(m, { previous: 'idle', next: 'thinking', now: 12000 })
m = step.memory
step = nextAIMemory(m, { previous: 'thinking', next: 'idle', now: 20000 })
assert(step.moment?.id === 'recovered', '11: the next real success is remarked on')
assert(step.memory.errorRun === 0, '11: and clears the run')

// Recovery outranks instant: after a run of failures, "there we go" is the
// thing to say, not "too easy".
let after = nextAIMemory({ errorRun: 2, startedAt: null }, { previous: 'idle', next: 'thinking', now: 100 })
after = nextAIMemory(after.memory, { previous: 'thinking', next: 'idle', now: 200 })
assert(after.moment?.id === 'recovered', '11: recovery wins over a quick finish')

// 12. Focus is not work. `observing` fires on click and on first keystroke, so
// treating it as work would announce "too easy" to anyone who clicked into an
// input and clicked away again.
let focus = nextAIMemory(INITIAL_AI_MEMORY, { previous: 'idle', next: 'observing', now: 1000 })
assert(focus.moment === null, '12: focusing an input says nothing')
assert(focus.memory.startedAt === null, '12: and does not start the clock')
focus = nextAIMemory(focus.memory, { previous: 'observing', next: 'idle', now: 1100 })
assert(focus.moment === null, '12: leaving it again says nothing either')

// Focus before real work still measures the work, not the focus.
let typed = nextAIMemory(INITIAL_AI_MEMORY, { previous: 'idle', next: 'observing', now: 1000 })
typed = nextAIMemory(typed.memory, { previous: 'observing', next: 'thinking', now: 9000 })
typed = nextAIMemory(typed.memory, { previous: 'thinking', next: 'idle', now: 9500 })
assert(typed.moment?.id === 'instant',
  '12: work after a long focus is timed from the work, not the click')

// And focus must not launder away an error run: the run has to survive both
// the error auto-clearing to idle and the visitor clicking back into the field.
let run = { errorRun: STRUGGLE_RUN, startedAt: null }
run = nextAIMemory(run, { previous: 'error', next: 'idle', now: 1000 }).memory
run = nextAIMemory(run, { previous: 'idle', next: 'observing', now: 2000 }).memory
run = nextAIMemory(run, { previous: 'observing', next: 'idle', now: 2500 }).memory
assert(run.errorRun === STRUGGLE_RUN, '12: an error run survives a focus round trip')
const recoveredAfterFocus = nextAIMemory(
  nextAIMemory(run, { previous: 'idle', next: 'thinking', now: 3000 }).memory,
  { previous: 'thinking', next: 'idle', now: 4000 },
)
assert(recoveredAfterFocus.moment?.id === 'recovered',
  '12: and the next real success still counts as recovery')

// 13. idle -> idle is not an event, whatever the memory says.
assert(nextAIMemory({ errorRun: 5, startedAt: null }, { previous: 'idle', next: 'idle', now: 1 }).moment === null,
  '13: idle to idle says nothing')

// A missing memory is treated as a fresh one rather than throwing.
assert(nextAIMemory(null, { previous: 'idle', next: 'thinking', now: 1 }).moment === null,
  '13: a null memory is survived')

if (failures > 0) {
  console.error(`sentinel session: ${failures} failure(s)`)
  process.exit(1)
}
console.log('sentinel session: all tests passed')
