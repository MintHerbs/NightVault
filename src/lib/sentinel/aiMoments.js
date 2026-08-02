/**
 * Tool moments derived from the aiState stream.
 *
 * Ten tool pages already report `observing`/`thinking`/`generating`/`error`
 * through one channel (docs/rules.md §15), and App is where that channel
 * lands. Reading the transitions there gives every tool the same three
 * reactions for free, and means a new tool inherits them without knowing
 * Sentinel exists.
 *
 * Pure and separate so the state machine can be tested without a renderer: it
 * is the part with edges (an error run that must not reset on an unrelated
 * idle, a "that was quick" that must not fire after a failure).
 */

/** Starting point for a page load. */
export const INITIAL_AI_MEMORY = { errorRun: 0, startedAt: null }

/** Consecutive failures before Sentinel says something kind about it. */
export const STRUGGLE_RUN = 3

/**
 * Work that resolved inside this window was effectively instant.
 *
 * useAIState holds every state for MINIMUM_DWELL_MS (700ms) so it paints at
 * all, which means work finishing in 4ms and work finishing in 690ms are
 * indistinguishable from here: both show up as a state that lasted exactly the
 * dwell. That is precisely the case worth remarking on, so the threshold sits
 * just above the dwell rather than at some smaller number that could never be
 * observed.
 */
export const INSTANT_MS = 800

/**
 * States that mean work is happening.
 *
 * `observing` is deliberately absent. It means "the input has focus"
 * (docs/rules.md §15.1) and fires on click and on first keystroke, so counting
 * it would make clicking into a field and clicking away again register as a
 * piece of work that finished instantly. It is presence, not progress, and the
 * machine treats it exactly like idle.
 */
const WORK_STATES = new Set(['thinking', 'generating', 'processing', 'waiting'])

/**
 * Fold one aiState transition into the memory, and say what it earned.
 *
 * @param {{ errorRun: number, startedAt: number|null }} memory
 * @param {object} transition
 * @param {string} transition.previous
 * @param {string} transition.next
 * @param {number} transition.now
 * @returns {{ memory: object, moment: { kind: 'moment', id: string }|null }}
 */
export function nextAIMemory(memory, { previous, next, now }) {
  const current = memory ?? INITIAL_AI_MEMORY

  if (next === 'error') {
    const errorRun = current.errorRun + 1
    return {
      memory: { errorRun, startedAt: null },
      // Only on the run's threshold, not on every failure past it: the point
      // is to notice a pattern once, not to comment on every attempt after.
      moment: errorRun === STRUGGLE_RUN ? { kind: 'moment', id: 'struggling' } : null,
    }
  }

  if (next !== 'idle') {
    // Focus is not work: hold everything and wait for something real.
    if (!WORK_STATES.has(next)) return { memory: current, moment: null }
    // Work starting. The clock survives a state change mid-task, so a page
    // moving thinking -> generating is one piece of work rather than two, and
    // the second half is not credited as having finished quickly.
    return {
      memory: { ...current, startedAt: current.startedAt ?? now },
      moment: null,
    }
  }

  // next === 'idle': work stopped, an error cleared, or focus left an input.
  if (!WORK_STATES.has(previous)) {
    // None of those is a success, and none may reset an error run: the error
    // state clears itself to idle after three seconds (App.jsx), and the run
    // has to survive that to be recognised when the next real attempt lands.
    return { memory: { ...current, startedAt: null }, moment: null }
  }

  if (current.errorRun > 0) {
    return {
      memory: { errorRun: 0, startedAt: null },
      moment: { kind: 'moment', id: 'recovered' },
    }
  }

  const elapsed = current.startedAt === null ? null : now - current.startedAt
  return {
    memory: { errorRun: 0, startedAt: null },
    moment: elapsed !== null && elapsed <= INSTANT_MS
      ? { kind: 'moment', id: 'instant' }
      : null,
  }
}
