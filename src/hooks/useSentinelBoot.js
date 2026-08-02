/**
 * useSentinelBoot - the machine that walks the boot sequence, and the store two
 * very distant components read it from.
 *
 * A module-level store for the same reason useIslandDock is one: the island
 * (top of the tree, global chrome) and the sidebar's avatar slot (bottom-left,
 * inside Sidebar) both need this, and App sits between them with no reason to
 * care. Threading a callback down both branches to coordinate a flourish is the
 * shape this codebase already decided against.
 *
 * ## Why the decision is made at module init
 *
 * The sidebar avatar must be grey on its *first paint*, not one frame later.
 * Deciding in an effect would show the avatar in colour and then desaturate it,
 * which reads as a glitch rather than as an introduction. Module init runs
 * before any component renders, so `bootWillRun` is settled before anything can
 * paint.
 *
 * ## Why the timers live here rather than in the island
 *
 * The island mounts, unmounts and re-renders on things that have nothing to do
 * with the boot, and under StrictMode its effects run twice. A module-level
 * chain started through an idempotent `startBoot()` cannot double-advance or
 * lose its place, and `skipBoot()` has exactly one thing to cancel.
 */
import { useSyncExternalStore } from 'react'
import { BOOT_STAGES, INTEGRATE_STAGE } from '../lib/sentinel/boot.js'
import { isSentinelPersonalityEnabled } from './useSentinelPersonality.js'
import { wasMintedThisLoad } from '../lib/sessionId.js'

const VISITED_KEY = 'sentinel-visited'

// Same trade-off as useTheme and useSentinelPersonality: storage can be
// unavailable, and a flourish must never be the thing that throws at import
// time. Unreadable storage reads as a first visit, which at worst shows the
// introduction again.
function readVisited() {
  try {
    return localStorage.getItem(VISITED_KEY) === 'true'
  } catch {
    return false
  }
}

function markVisited() {
  try {
    localStorage.setItem(VISITED_KEY, 'true')
  } catch {
    // Holds for this page load, just not remembered.
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Development escape hatch: a once-ever cinematic is otherwise unreviewable. */
function forcedByQuery() {
  try {
    return new URLSearchParams(window.location.search).get('sentinel') === 'boot'
  } catch {
    return false
  }
}

const forced = forcedByQuery()
const firstVisit = !readVisited()

/**
 * Whether this load will run the sequence.
 *
 * Reduced motion skips it outright rather than playing it faster: the whole
 * thing is animation, and there is nothing left once that is removed
 * (docs/rules.md §10.3). Personality switched off skips it because the boot is
 * the loudest Sentinel moment there is.
 */
export const bootWillRun =
  forced || (firstVisit && isSentinelPersonalityEnabled() && !prefersReducedMotion())

// Marked now, whether or not the sequence actually plays. "Visited" means the
// visitor has loaded the site, which is true either way; somebody who has
// Sentinel switched off is not owed a cinematic later if they switch it on, and
// Appearance carries a replay for anyone who wants one.
if (firstVisit) markVisited()

/**
 * True once the avatar has been handed to the sidebar. When no boot runs this
 * starts true, so the ordinary case is "the avatar is simply in colour" with no
 * boot-shaped code path involved.
 */
let integrated = !bootWillRun
let stage = bootWillRun ? BOOT_STAGES[0].id : null
let active = bootWillRun

const listeners = new Set()
let timer = null
let started = false

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// A single frozen object per state change, because useSyncExternalStore
// compares snapshots by identity: building a fresh one per call would loop
// forever.
let snapshot = { active, stage, integrated }
function refresh() {
  snapshot = { active, stage, integrated }
  emit()
}

const getSnapshot = () => snapshot

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function enter(index) {
  const next = BOOT_STAGES[index]
  if (!next) {
    finish()
    return
  }

  stage = next.id
  // The handoff is the point of the sequence, so it is committed the moment the
  // stage is entered rather than when it ends. A visitor who skips during the
  // integrate beat still keeps their avatar in colour.
  if (next.id === INTEGRATE_STAGE) integrated = true
  refresh()

  timer = setTimeout(() => enter(index + 1), next.ms)
}

function finish() {
  clearTimer()
  active = false
  stage = null
  integrated = true
  refresh()
}

/**
 * Begin the sequence. Idempotent, so StrictMode's double-invoked effects and
 * any remount of the island are harmless.
 */
export function startBoot() {
  if (started || !bootWillRun) return
  started = true
  enter(0)
}

/**
 * End it early: a click, a keypress, Escape, or a page taking the island's
 * dock. Nothing is lost, because the session id was minted at module init and
 * the avatar is deterministic from it.
 */
export function skipBoot() {
  if (!active) return
  finish()
}

/**
 * Play it again from Appearance. Ignores every gate except reduced motion,
 * which has nothing to show.
 */
export function replayBoot() {
  if (prefersReducedMotion()) return
  clearTimer()
  started = true
  active = true
  integrated = false
  enter(0)
}

/** Whether this load created the session id, for the copy on the session beat. */
export function bootMintedSession() {
  return wasMintedThisLoad()
}

export default function useSentinelBoot() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * The sidebar's read: just the one boolean it needs, so a stage change during
 * the sequence does not re-render the whole rail seven times.
 */
export function useAvatarIntegrated() {
  return useSyncExternalStore(
    subscribe,
    () => integrated,
    () => true
  )
}
