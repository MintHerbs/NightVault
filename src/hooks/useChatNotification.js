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
// Refractory period after a dismissal, so an active conversation can't
// ping-pong the island.
const COOLDOWN_MS = 30000
// Pops allowed per session before the island goes quiet entirely. Reset when
// the visitor actually opens chat, since that proves they're engaged.
const SESSION_BUDGET = 5

/**
 * @param {object}  params
 * @param {object?} params.lastIncoming Newest message from another session.
 * @param {boolean} params.suppressed   Chat panel is open — never notify.
 * @param {boolean} params.blocked      Island is showing something with a
 *                                      higher claim (music panel, or live AI
 *                                      state). Chat is the lowest-priority
 *                                      occupant and never preempts them.
 * @param {boolean} params.paused       Pointer is over the pill — hold it open.
 */
export default function useChatNotification({
  lastIncoming,
  suppressed = false,
  blocked = false,
  paused = false,
}) {
  const [notification, setNotification] = useState(null)

  // Mirrors of the above, so the message handler can make decisions from
  // current values without re-subscribing on every change.
  const notificationRef = useRef(null)
  const suppressedRef = useRef(suppressed)
  const blockedRef = useRef(blocked)

  const cooldownUntilRef = useRef(0)
  const budgetSpentRef = useRef(0)
  // Guards against re-processing the same message when the effect re-runs.
  const lastSeenIdRef = useRef(null)

  suppressedRef.current = suppressed
  blockedRef.current = blocked

  const clear = useCallback((withCooldown) => {
    notificationRef.current = null
    setNotification(null)
    if (withCooldown) cooldownUntilRef.current = Date.now() + COOLDOWN_MS
  }, [])

  const dismiss = useCallback(() => clear(true), [clear])

  // Called when the visitor acts on the notification. No cooldown needed:
  // opening chat sets `suppressed`, which gates everything anyway.
  const acknowledge = useCallback(() => {
    budgetSpentRef.current = 0
    clear(false)
  }, [clear])

  useEffect(() => {
    if (!lastIncoming) return
    // Same message, re-rendered — not a new event.
    if (lastIncoming.id === lastSeenIdRef.current) return
    lastSeenIdRef.current = lastIncoming.id

    if (suppressedRef.current) return
    if (blockedRef.current) return

    const current = notificationRef.current

    // Already showing: coalesce into it and let the dismiss timer restart.
    if (current) {
      const merged = { count: current.count + 1, message: lastIncoming }
      notificationRef.current = merged
      setNotification(merged)
      return
    }

    if (Date.now() < cooldownUntilRef.current) return
    if (budgetSpentRef.current >= SESSION_BUDGET) return

    budgetSpentRef.current += 1
    const next = { count: 1, message: lastIncoming }
    notificationRef.current = next
    setNotification(next)
  }, [lastIncoming])

  // Auto-dismiss. `notification` gets a fresh identity on every coalesce, so
  // this effect re-runs and the window restarts on each new message. Hovering
  // holds the pill open by tearing the timer down entirely.
  useEffect(() => {
    if (!notification || paused) return undefined
    const timer = setTimeout(dismiss, BURST_WINDOW_MS)
    return () => clearTimeout(timer)
  }, [notification, paused, dismiss])

  // Something with a higher claim took the pill, or the visitor opened chat.
  // Either way the notification is over; don't let it resurface later.
  useEffect(() => {
    if ((blocked || suppressed) && notificationRef.current) clear(blocked)
  }, [blocked, suppressed, clear])

  // Opening chat is engagement, so the budget starts over.
  useEffect(() => {
    if (suppressed) budgetSpentRef.current = 0
  }, [suppressed])

  return { notification, dismiss, acknowledge }
}
