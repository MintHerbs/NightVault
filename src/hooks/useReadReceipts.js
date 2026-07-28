// "Seen by" state for the community chat, on a Realtime Presence channel
// rather than a messages/sessions column: like typing presence, it is only
// meaningful for currently-connected peers and needs no schema change or
// persisted history — see useTypingIndicator.js for the same reasoning.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const CHANNEL = 'chat-read-receipts'

export default function useReadReceipts(sessionId) {
  const [seenAt, setSeenAt] = useState({})
  const channelRef = useRef(null)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    if (!sessionId) return undefined

    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: sessionId } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const next = {}
      for (const [id, entries] of Object.entries(state)) {
        if (id === sessionId) continue
        const latest = entries[entries.length - 1]
        if (latest?.lastReadAt) next[id] = latest.lastReadAt
      }
      setSeenAt(next)
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  const markRead = useCallback((timestamp) => {
    const channel = channelRef.current
    if (!channel || typeof channel.track !== 'function' || !timestamp) return
    channel.track({ sessionId: sessionIdRef.current, lastReadAt: timestamp })
  }, [])

  return { seenAt, markRead }
}
