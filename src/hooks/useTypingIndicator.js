// Ephemeral "who is typing" state for the community chat.
//
// This rides on a Supabase Realtime *broadcast* channel rather than a table:
// typing is worthless a few seconds after the fact, so writing it to Postgres
// would mean a row insert plus a replication round trip per keystroke burst for
// data that is discarded almost immediately.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const CHANNEL = 'chat-typing'
/** A peer stays listed this long after their last ping. */
const TYPING_TTL_MS = 4000
/** At most one broadcast per this interval while someone keeps typing. */
const PING_THROTTLE_MS = 1800
const SWEEP_MS = 1000

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

export default function useTypingIndicator(sessionId) {
  const [typingSessions, setTypingSessions] = useState([])

  const channelRef = useRef(null)
  /** sessionId -> expiry timestamp. */
  const peersRef = useRef(new Map())
  const lastPingRef = useRef(0)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  const flush = useCallback(() => {
    const now = Date.now()
    const live = []
    for (const [id, expiry] of peersRef.current) {
      if (expiry > now) live.push(id)
      else peersRef.current.delete(id)
    }
    live.sort()
    setTypingSessions((prev) => (sameIds(prev, live) ? prev : live))
  }, [])

  useEffect(() => {
    const channel = supabase.channel(CHANNEL, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const id = payload?.sessionId
        if (!id || id === sessionId) return
        peersRef.current.set(id, Date.now() + TYPING_TTL_MS)
        flush()
      })
      .on('broadcast', { event: 'stopped' }, ({ payload }) => {
        const id = payload?.sessionId
        if (!id || id === sessionId) return
        peersRef.current.delete(id)
        flush()
      })
      .subscribe()

    channelRef.current = channel

    // A peer that closes the tab never sends `stopped`, so entries also have to
    // age out on their own.
    const sweep = window.setInterval(flush, SWEEP_MS)

    return () => {
      window.clearInterval(sweep)
      channelRef.current = null
      peersRef.current.clear()
      supabase.removeChannel(channel)
    }
  }, [flush, sessionId])

  const send = useCallback((event) => {
    const channel = channelRef.current
    // The unconfigured-Supabase stub exposes `on`/`subscribe` but no `send`.
    if (!channel || typeof channel.send !== 'function') return
    channel.send({ type: 'broadcast', event, payload: { sessionId: sessionIdRef.current } })
  }, [])

  const notifyTyping = useCallback(() => {
    if (!sessionIdRef.current) return
    const now = Date.now()
    if (now - lastPingRef.current < PING_THROTTLE_MS) return
    lastPingRef.current = now
    send('typing')
  }, [send])

  const notifyStopped = useCallback(() => {
    if (!sessionIdRef.current) return
    lastPingRef.current = 0
    send('stopped')
  }, [send])

  return { typingSessions, notifyTyping, notifyStopped }
}
