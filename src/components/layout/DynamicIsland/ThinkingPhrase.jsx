import { useState, useEffect } from 'react'
import ThinkingAnimation from './ThinkingAnimation'
import { useAIActivity } from '../../../hooks/useAIActivity'

// Unlike GeneratingPhrase's escalating list (a network call has an end, so it
// holds on the last line), "thinking" can run indefinitely — a free-running
// circuit keeps this state up for as long as it ticks — so this loops instead
// of holding. This is the fallback for every "thinking" caller with nothing
// more specific to report (tree building, ERD generating); CircuitSandbox has
// real activity to report instead, see ACTIVITY below.
const PHRASES = [
  'Thinking...',
  'Crunching...',
  'Prospecting...',
  'Injecting signal...',
  'Untangling wires...',
  'Percolating...',
  'Settling...',
  'Tracing paths...',
]

// Slower than GeneratingPhrase's 1900ms and deliberately not the same number
// as the grid's own "slow" cadence (1500ms) — two loops on the same beat read
// as mechanically synced, off-beat reads as alive.
const PHRASE_MS = 2200

/**
 * What each CircuitSandbox activity kind (useAIActivity.jsx) looks and reads
 * like. `running` has no phrase at all: a label that changes with every pulse
 * reads as noise once a clock is actually ticking (owner report), so the
 * island says nothing and just shows the grid breathing in a circle instead
 * of a pill (ThinkingAnimation's `circle` mode). `stopping` is the one-shot
 * beat right after a free-run is paused, so stopping still gets a word even
 * though running doesn't.
 */
const ACTIVITY_STYLE = {
  running: { phrase: '', pattern: 'heartbeat', circle: true },
  stopping: { phrase: 'Stopping...', pattern: 'breathing' },
  unstable: { phrase: 'Oscillating...', pattern: 'twinkle' },
  invalid: { phrase: 'Resolving conflict...', pattern: 'ripple-in' },
  placing: { phrase: 'Placing a part...', pattern: 'plus-full' },
  dragging: { phrase: 'Rearranging...', pattern: 'wave-lr' },
}

export default function ThinkingPhrase() {
  const [index, setIndex] = useState(0)
  const activity = useAIActivity()
  const driven = activity && ACTIVITY_STYLE[activity.kind]

  useEffect(() => {
    // A real activity already says something specific — cycling the label out
    // from under it would contradict it a moment later for no reason.
    if (driven) return undefined
    const id = setInterval(() => setIndex(i => (i + 1) % PHRASES.length), PHRASE_MS)
    return () => clearInterval(id)
  }, [driven])

  if (driven) {
    return <ThinkingAnimation label={driven.phrase} pattern={driven.pattern} circle={driven.circle} />
  }
  return <ThinkingAnimation label={PHRASES[index]} />
}
