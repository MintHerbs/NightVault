/**
 * useAIActivity - a side channel for *why* the island is showing "thinking".
 *
 * aiState itself (useAIState.js) stays a plain enum shared by every tool —
 * widening it with sandbox-specific values would mean every other consumer
 * (WaitingAnimation, the island's own data-ai-state, the live-region
 * announcement) now has to know about them too. This is additive instead: a
 * context only CircuitSandbox writes to and only ThinkingPhrase reads, so
 * every other "thinking" caller (the tree building, ERD generating) is
 * unaffected and keeps its own generic cycling animation.
 *
 * Default is `null` — no provider, or no sandbox currently driving it — and
 * every consumer treats that as "fall back to the generic behaviour" rather
 * than throwing, since most of the tree never renders inside a provider at
 * all in tests.
 */
import { createContext, useContext, useMemo, useState } from 'react'

const AIActivityContext = createContext(null)

export function AIActivityProvider({ children }) {
  const [activity, setActivity] = useState(null)
  const value = useMemo(() => [activity, setActivity], [activity])
  return <AIActivityContext.Provider value={value}>{children}</AIActivityContext.Provider>
}

/** What the sandbox is doing right now, or null. See ThinkingPhrase.jsx for the shape. */
export function useAIActivity() {
  return useContext(AIActivityContext)?.[0] ?? null
}

/** The setter a page's own sandbox calls into. A no-op outside a provider. */
export function useSetAIActivity() {
  return useContext(AIActivityContext)?.[1] ?? (() => {})
}
