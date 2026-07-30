import { useState, useEffect } from 'react'
import GeneratingAnimation from './GeneratingAnimation'

// The phrases escalate rather than loop, so a slow generation reads as the
// island noticing it is taking a while instead of cycling the same stock line.
// The last entry holds for as long as the wait continues.
const PHRASES = [
  'Thinking...',
  'Pondering...',
  'Reading your scenario...',
  'Sketching entities...',
  'Hmm.',
  'Wheezing...',
  'wtf?',
  'No wait, got it...',
  'Drawing the last few boxes...',
]

const PHRASE_MS = 1900

export default function GeneratingPhrase() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= PHRASES.length - 1) return
    const id = setTimeout(() => setIndex(i => i + 1), PHRASE_MS)
    return () => clearTimeout(id)
  }, [index])

  return <GeneratingAnimation label={PHRASES[index]} />
}
