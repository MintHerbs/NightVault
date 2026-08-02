/**
 * useSentinelGreeting - the welcome-back line on the island's entrance.
 *
 * One line picked at random from a small pool, so a repeat visit doesn't read
 * identically every time. Decided once per hook instance via lazy state, not
 * recomputed on re-render, so the line can't change mid-hold if something else
 * re-renders DynamicIsland.
 *
 * This used to own the first-visit test as well, returning `isFirstVisit` and
 * a one-time "Hi, I'm Sentinel" for it. The boot sequence is the introduction
 * now (src/hooks/useSentinelBoot.js, T-099), and it owns both the read and the
 * write of `sentinel-visited` — two hooks deciding separately what counts as a
 * first visit is exactly the disagreement that flag cannot survive. What is
 * left here is the returning case, which is the only one this hook ever
 * rendered for anyway.
 */
import { useState } from 'react'

const WELCOME_BACK_LINES = [
  'Welcome back',
  'Glad to see you',
  'Good to see you again',
  "Hey, you're back",
  'Missed you',
]

export default function useSentinelGreeting() {
  const [greeting] = useState(() => ({
    line: WELCOME_BACK_LINES[Math.floor(Math.random() * WELCOME_BACK_LINES.length)],
  }))

  return greeting
}
