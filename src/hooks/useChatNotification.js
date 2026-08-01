import { useCallback, useEffect, useRef, useState } from 'react'

// Chat notification gating for the Dynamic Island (T-079).
//
// The room is a single global anonymous channel, so every message from every
// visitor is a candidate notification. A queue (what the upstream SmoothUI
// component ships) would turn ten messages into ten sequential pops, so this
// coalesces instead: the first message opens the pill and later messages in
// the same burst mutate it in place, relabelling to "3 new messages".
//
// The division of labour that makes this safe to be stingy with: the island
// is the transient, interruptive, strictly-budgeted channel; the Sidebar
// unread badge is the lossless one that never drops a message. So whenever a
// gate here says no, we DROP rather than defer — a chat notification landing
// 40 seconds late is pure noise, and the badge already carries the signal.

// Silence required before a shown pill dismisses itself.
const BURST_WINDOW_MS = 4000
// Absolute ceiling on how long a pill can stay up, measured from when it
// first appeared. Without this, coalescing restarted the burst window on every
// arrival, so any room busier than one message per 4s pinned the pill open
// forever with a churning count. The burst window still applies underneath;
// this only caps the case where it never gets a chance to expire.
const MAX_DISPLAY_MS = 8000
// Refractory period after a dismissal, so an active conversation can't
// ping-pong the island.
const COOLDOWN_MS = 30000
// A burst this size means the room is simply busy, not that one thing
// happened worth reading. Returning to the standard cooldown there would
// re-pop every 30s until the budget drained, which is the spam this avoids.
const BUSY_BURST = 5
const BUSY_COOLDOWN_MS = 300000
// Pops allowed per session before the island goes quiet entirely. Reset when
// the visitor actually opens chat, since that proves they're engaged.
const SESSION_BUDGET = 5

/**
 * @param {object}  params
 * @param {object?} params.lastIncoming Newest event from another session. Carries
 *                                      a `kind` of 'chat' or 'post'.
 * @param {object}  params.suppressedKinds Per-kind "the surface this event is
 *                                      about is already open, so it isn't news":
 *                                      `{ chat: <panel open>, post: <on feed> }`.
 *                                      Per-kind rather than one flag because
 *                                      reading the feed must not silence chat.
 * @param {boolean} params.blocked      Island is showing something with a
 *                                      higher claim (music panel, or live AI
 *                                      state). Notifications are the lowest-
 *                                      priority occupant and never preempt them.
 * @param {boolean} params.paused       Pointer is over the pill — hold it open.
 */
export default function useChatNotification({
  lastIncoming,
  suppressedKinds = { chat: false, post: false },
  blocked = false,
  paused = false,
}) {
  const [notification, setNotification] = useState(null)

  // Mirrors of the above, so the message handler can make decisions from
  // current values without re-subscribing on every change.
  const notificationRef = useRef(null)
  const suppressedRef = useRef(suppressedKinds)
  const blockedRef = useRef(blocked)

  // Chat opening is the engagement signal that resets the budget, and the
  // signal that an in-flight chat notification is moot.
  const chatSuppressed = !!suppressedKinds.chat

  const cooldownUntilRef = useRef(0)
  const budgetSpentRef = useRef(0)
  // When the pill currently on screen first appeared, for MAX_DISPLAY_MS.
  const shownAtRef = useRef(0)
  // Guards against re-processing the same message when the effect re-runs.
  const lastSeenIdRef = useRef(null)

  suppressedRef.current = suppressedKinds
  blockedRef.current = blocked

  const clear = useCallback((withCooldown) => {
    const cleared = notificationRef.current
    notificationRef.current = null
    setNotification(null)
    if (withCooldown) {
      const wasBusy = (cleared?.count ?? 0) >= BUSY_BURST
      cooldownUntilRef.current =
        Date.now() + (wasBusy ? BUSY_COOLDOWN_MS : COOLDOWN_MS)
    }
  }, [])

  const dismiss = useCallback(() => clear(true), [clear])

  // Called when the visitor acts on the notification. No cooldown needed:
  // opening chat sets suppressedKinds.chat, which gates everything anyway.
  const acknowledge = useCallback(() => {
    budgetSpentRef.current = 0
    clear(false)
  }, [clear])

  useEffect(() => {
    if (!lastIncoming) return
    // Same message, re-rendered — not a new event.
    if (lastIncoming.id === lastSeenIdRef.current) return
    lastSeenIdRef.current = lastIncoming.id

    const kind = lastIncoming.kind === 'post' ? 'post' : 'chat'
    if (suppressedRef.current?.[kind]) return
    if (blockedRef.current) return

    const current = notificationRef.current

    // Already showing: coalesce into it and let the dismiss timer restart.
    // A burst spanning both kinds collapses to 'mixed', which the pill labels
    // generically rather than claiming the wrong one.
    if (current) {
      const merged = {
        count: current.count + 1,
        message: lastIncoming,
        kind: current.kind === kind ? kind : 'mixed',
      }
      notificationRef.current = merged
      setNotification(merged)
      return
    }

    if (Date.now() < cooldownUntilRef.current) return
    if (budgetSpentRef.current >= SESSION_BUDGET) return

    budgetSpentRef.current += 1
    shownAtRef.current = Date.now()
    const next = { count: 1, message: lastIncoming, kind }
    notificationRef.current = next
    setNotification(next)
  }, [lastIncoming])

  // Auto-dismiss. `notification` gets a fresh identity on every coalesce, so
  // this effect re-runs and the burst window restarts on each new message —
  // which is why it is clamped to whatever is left of MAX_DISPLAY_MS. In a
  // quiet room the burst window wins and nothing changes; in a busy one the
  // ceiling wins and the pill leaves with a final count instead of living
  // there. Hovering still holds it open by tearing the timer down entirely:
  // that is the visitor explicitly asking to read it.
  useEffect(() => {
    if (!notification || paused) return undefined
    const remaining = MAX_DISPLAY_MS - (Date.now() - shownAtRef.current)
    const delay = Math.max(0, Math.min(BURST_WINDOW_MS, remaining))
    const timer = setTimeout(dismiss, delay)
    return () => clearTimeout(timer)
  }, [notification, paused, dismiss])

  // Something with a higher claim took the pill, or the visitor opened the
  // surface this notification was about. Either way it is over; don't let it
  // resurface later.
  useEffect(() => {
    const current = notificationRef.current
    if (!current) return
    // 'mixed' is only moot once both surfaces are open, which in practice
    // never happens — so it survives until its own timer dismisses it.
    const answered = current.kind !== 'mixed' && suppressedKinds?.[current.kind]
    if (blocked || answered) clear(blocked)
  }, [blocked, suppressedKinds, clear])

  // Opening chat is engagement, so the budget starts over.
  useEffect(() => {
    if (chatSuppressed) budgetSpentRef.current = 0
  }, [chatSuppressed])

  return { notification, dismiss, acknowledge }
}
