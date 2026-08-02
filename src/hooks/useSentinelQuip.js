/**
 * useSentinelQuip - the delivery half of the quip system (see
 * src/lib/sentinel/quips.js for the catalog and the resolution ladder).
 *
 * A module-level emitter rather than a context provider on purpose. Quips fire
 * from navigation handlers, a theme setter and two admin sign-out paths, none
 * of which sit under a shared provider or receive island props; threading a
 * callback to each would mean editing every component between App and the
 * click. `fireQuip()` is importable from anywhere and the island is the only
 * subscriber.
 *
 * Three gates stand between a fire and the pill, in the order they are cheapest
 * to check:
 *
 *   busy       the island is showing something that outranks flavour. Dropped
 *              without marking the quip seen, so the joke is not burned by a
 *              beat the visitor never saw.
 *   min gap    a floor between any two quips, whatever fired them, so a fast
 *              click-through of four folders is not four remarks.
 *   freshness  a quip on cooldown is skipped outright; one that has come off
 *              cooldown fires on a coin toss. A first-ever sighting always
 *              fires.
 *
 * Dropping rather than queueing matches the island's existing stance for chat
 * notifications: a reaction that arrives after the moment has passed is noise.
 */
import { useEffect, useState } from 'react'
import {
  QUIP_COOLDOWN_MS,
  QUIP_HOLD_MS,
  QUIP_MIN_GAP_MS,
  QUIP_REPEAT_CHANCE,
  resolveQuip,
} from '../lib/sentinel/quips.js'

const SEEN_KEY = 'sentinel-quips-seen'
const PENDING_KEY = 'sentinel-quip-pending'

let listener = null
let lastFiredAt = 0
let busy = false

// Same trade-off useSentinelGreeting and useTheme take: storage can be
// unavailable (private mode, blocked cookies), and a personality flourish must
// never be the thing that throws inside a navigation handler. Losing the record
// only means a quip can repeat sooner than intended.
function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    // Nothing to do about it, and nothing that depends on it.
  }
}

/**
 * Record a sighting, dropping entries that are already off cooldown.
 *
 * The prune is what keeps the key bounded: without it the object grows one
 * entry per quip id forever, and ids are added every time the catalog does.
 */
function markSeen(id, now) {
  const seen = readSeen()
  const next = {}
  for (const [key, at] of Object.entries(seen)) {
    if (typeof at === 'number' && now - at < QUIP_COOLDOWN_MS) next[key] = at
  }
  next[id] = now
  writeSeen(next)
}

/**
 * Hold a quip for the next time the island is free, here or on the next page.
 *
 * Two callers. Explicitly, for actions that end in a hard navigation: signing
 * out replaces the document, so a quip fired inline would be discarded before
 * it painted, and delaying the redirect to show one would put a joke in front
 * of the visitor's logout. Implicitly, via fireQuip's `deferIfBusy`, for
 * moments that can only occur while the island is occupied.
 *
 * sessionStorage rather than localStorage, so it dies with the tab and cannot
 * surface days later attached to nothing. Only one quip is ever pending, and
 * which one survives a collision is decided by `explicit` below.
 */
export function deferQuip(context, { explicit = true } = {}) {
  try {
    if (!explicit) {
      const existing = readPending()
      // An opportunistic defer must never displace a deliberate one. Signing
      // out stores "See you" and then hard-navigates to /admin, whose own
      // arrival would otherwise overwrite it with "Boss mode" before either
      // could be shown. Two opportunistic defers still overwrite each other,
      // which is right: the newest is the page the visitor is actually on.
      if (existing?.explicit) return
    }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ context, explicit }))
  } catch {
    // Same stance as everywhere else here: a flourish never breaks a flow.
  }
}

function readPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && parsed.context ? parsed : null
  } catch {
    return null
  }
}

function takePending() {
  const pending = readPending()
  try {
    // Cleared whether or not the quip goes on to pass its gates, so one that
    // cannot fire is spent rather than retried on every later settle.
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Nothing to do about it.
  }
  return pending?.context ?? null
}

/**
 * Tell the emitter whether the island currently has something better to show.
 * Called by DynamicIsland; nothing else should.
 *
 * The settle (busy going false) is also when a deferred quip gets its chance:
 * on a fresh load the island is hidden and then greeting, and only once that
 * finishes is there a pill free to speak from.
 */
export function setQuipBusy(next) {
  const wasBusy = busy
  busy = next
  if (wasBusy && !next) {
    const pending = takePending()
    if (pending) fireQuip(pending)
  }
}

/**
 * Ask Sentinel to react to something. Safe to call from any handler: it
 * resolves, gates, and either shows a quip or does nothing at all.
 *
 * @param {object} context - see resolveQuip in src/lib/sentinel/quips.js
 * @param {object} [options]
 * @param {boolean} [options.deferIfBusy] - hold the quip for the next settle
 *   instead of dropping it. For moments that can only ever happen while the
 *   island is occupied, which would otherwise never speak at all: skipping
 *   tracks is only possible from the open music panel, and a fresh load
 *   straight onto a tool page arrives while the pill is still greeting.
 * @returns {boolean} whether a quip was actually shown
 */
export function fireQuip(context, { deferIfBusy = false } = {}) {
  if (busy) {
    if (deferIfBusy) deferQuip(context, { explicit: false })
    return false
  }
  if (!listener) return false

  const now = Date.now()
  if (now - lastFiredAt < QUIP_MIN_GAP_MS) return false

  const quip = resolveQuip({ ...context, now })
  if (!quip) return false

  const seenAt = readSeen()[quip.id]
  if (typeof seenAt === 'number') {
    if (now - seenAt < QUIP_COOLDOWN_MS) return false
    if (Math.random() > QUIP_REPEAT_CHANCE) return false
  }

  lastFiredAt = now
  markSeen(quip.id, now)
  listener(quip)
  return true
}

/**
 * Subscribe the island to quips. Single-subscriber by design: two pills
 * reacting to one click would be a bug, so a second mount replaces the first
 * rather than fanning out.
 */
export default function useSentinelQuip() {
  const [quip, setQuip] = useState(null)

  useEffect(() => {
    listener = setQuip
    return () => {
      if (listener === setQuip) listener = null
    }
  }, [])

  // Self-clearing, so no caller has to remember to dismiss one. Keyed on the
  // quip object rather than on its id: the same quip firing twice in a row
  // still restarts the hold.
  useEffect(() => {
    if (!quip) return undefined
    const timeout = setTimeout(() => {
      // Only clear what this effect was scheduled for, so a quip that arrived
      // during the wait keeps its full time on screen.
      setQuip((current) => (current === quip ? null : current))
    }, QUIP_HOLD_MS)
    return () => clearTimeout(timeout)
  }, [quip])

  return quip
}
