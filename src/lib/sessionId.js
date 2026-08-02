/**
 * The visitor's anonymous session id, and the only place it is created.
 *
 * Before this module there were four independent mint sites (usePresence,
 * useRateLimit, useComments, usePosts), each with its own copy of the same
 * read-or-create block, plus three components reading the key during render
 * with an `|| 'anonymous'` fallback. That fallback was not a safety net: on a
 * first-ever visit no effect has run yet, so App and Sidebar both rendered the
 * literal string 'anonymous', ChatAvatar seeded AgentAvatar from it, and every
 * first-time visitor was shown the same stranger's avatar until presence
 * happened to sync and re-render the tree. With Supabase unconfigured
 * usePresence returns early and never mints, so that wrong avatar could
 * survive for the whole page life.
 *
 * Minting happens here at module init, synchronously, before any component
 * renders. crypto.randomUUID() is instant, so there is nothing to await and no
 * window in which a reader can legitimately see a placeholder.
 *
 * The value is immutable for the life of the page: nothing clears it, and no
 * flow re-issues it. That is why there is no subscribe/emit store here the way
 * useIslandDock and useSentinelPersonality have one — there is no change to
 * notify anybody about, and an external store with a constant snapshot is just
 * ceremony. `useSessionId()` exists so call sites stay React-idiomatic and so
 * there is one place to change if that ever stops being true.
 */

const STORAGE_KEY = 'session_id'

/**
 * RFC-4122 v4 without crypto.randomUUID.
 *
 * Two callers can reach this: an insecure origin (randomUUID is restricted to
 * secure contexts) and the node test runner, where the default node here is 18
 * and the global did not land until 19. Math.random is not a CSPRNG, but this
 * id is an anonymous correlation handle rather than a credential, and the
 * alternative is throwing during module init.
 */
function fallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function newId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Falls through, same as an unavailable global.
  }
  return fallbackUuid()
}

// Same stance every other store in this codebase takes about storage being
// unavailable (private mode, blocked cookies): never throw. A per-load
// ephemeral id is strictly better than the old 'anonymous', which was a single
// value shared by every visitor who hit that path — it made them
// indistinguishable to presence, to rate limiting, and to their own avatar.
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return typeof raw === 'string' && raw ? raw : null
  } catch {
    return null
  }
}

function writeStored(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
    return true
  } catch {
    // The id holds for this page load, it just will not be remembered.
    return false
  }
}

const stored = readStored()
const sessionId = stored ?? newId()

/**
 * Whether this page load is what created the id.
 *
 * Read by the Sentinel boot sequence, which narrates the generation. Recorded
 * at module init rather than letting the boot mint the id itself: any hook
 * mounting before the cinematic reaches its "generating" beat would otherwise
 * mint first and make the beat a lie. The boot narrates a real generation that
 * happened milliseconds earlier, and the value it shows is the real one.
 */
const mintedThisLoad = stored === null

if (mintedThisLoad) writeStored(sessionId)

/** The session id. Always a real id, never a placeholder. */
export function getSessionId() {
  return sessionId
}

export function wasMintedThisLoad() {
  return mintedThisLoad
}

/**
 * The React read. Constant for the life of the page, so it is deliberately not
 * state and never triggers a re-render.
 */
export default function useSessionId() {
  return sessionId
}
