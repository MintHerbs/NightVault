import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getSessionId } from '../lib/sessionId'

export function usePresence() {
  const [onlineCount, setOnlineCount] = useState(1)
  // The Dynamic Island's greeting state waits on this before labelling
  // itself, so it can't announce the placeholder "1 online" and then jump
  // to the real count mid-hold. Stays false forever when Supabase isn't
  // configured; callers must carry their own timeout for that case.
  const [presenceSynced, setPresenceSynced] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    // Minted by src/lib/sessionId.js at module init, not here. This hook used
    // to be the de-facto owner despite returning early whenever Supabase is
    // unconfigured, which meant the id's existence depended on a setting that
    // has nothing to do with identity.
    const sessionId = getSessionId()

    // Open one WebSocket channel — stays open until browser closes
    const channel = supabase.channel('online-users', {
      config: { presence: { key: sessionId } }
    })

    // When presence state changes, recount
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      setOnlineCount(Object.keys(state).length)
      setPresenceSynced(true)
    })

    // Subscribe and track this user
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Ensure session exists in sessions table
        await supabase
          .from('sessions')
          .upsert({ id: sessionId, last_seen: new Date().toISOString() })
        
        await channel.track({ session_id: sessionId, online_at: new Date().toISOString() })
      }
    })

    // Cleanup — unsubscribe when component unmounts
    // Supabase automatically removes user from presence on disconnect
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { onlineCount, presenceSynced }
}
