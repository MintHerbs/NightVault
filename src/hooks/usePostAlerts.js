import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getSessionId } from '../lib/sessionId'

/**
 * New-post alerts for the whole app (not just the feed page).
 *
 * usePosts owns the feed's own realtime subscription, but it only exists while
 * HomeFeedPage is mounted. The sidebar badge and the Dynamic Island have to
 * know about a new post while the visitor is somewhere else entirely, which is
 * what this hook is for. It deliberately holds no post list: only a counter
 * and the newest arrival.
 *
 * Mirrors useChat's unread contract so App can treat the two the same way.
 */

// Matches the badge's own max — counting past it just burns renders.
const MAX_UNREAD = 10

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The id itself is always present (src/lib/sessionId.js), so this is purely a
// shape guard now: `get_my_post_ids` takes a uuid, and a hand-edited storage
// value would fail the RPC rather than this check. Returning null skips the
// ownership lookup, which falls through to notifying.
function ownSessionId() {
  const id = getSessionId()
  return UUID_RE.test(id) ? id : null
}

/**
 * @param {boolean} isViewingFeed The visitor is looking at the feed right now,
 *   so a new post is not news and the count resets.
 */
export default function usePostAlerts(isViewingFeed = false) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastIncoming, setLastIncoming] = useState(null)
  const isViewingFeedRef = useRef(false)
  const channelName = useRef(
    `post-alerts-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )

  useEffect(() => {
    isViewingFeedRef.current = isViewingFeed
    if (isViewingFeed) setUnreadCount(0)
  }, [isViewingFeed])

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const post = payload.new
          // Same gate the feed applies: a post that arrives already removed or
          // auto-flagged was never visible, so it is not an event.
          if (!post?.id || post.is_deleted || post.is_flagged) return

          const sessionId = ownSessionId()
          if (sessionId) {
            // Ownership goes through the RPC rather than payload.new.session_id.
            // 0047 took that column off every read precisely so the client
            // stops depending on it; the realtime payload still carrying it is
            // a documented leak, not an interface to build on. One indexed
            // lookup per new post is affordable at this volume.
            const { data, error } = await supabase.rpc('get_my_post_ids', {
              p_post_ids: [post.id],
              p_session_id: sessionId,
            })
            // On error, fall through and notify: a missed alert is worse than
            // occasionally being told about your own post.
            if (!error && data?.length) return
          }

          setLastIncoming({ ...post, kind: 'post' })
          if (!isViewingFeedRef.current) {
            setUnreadCount((prev) => Math.min(prev + 1, MAX_UNREAD))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // No markRead counterpart to useChat's: the count resets from isViewingFeed
  // above, because arriving at the feed IS reading it. Nothing needs to say so
  // explicitly.
  return { unreadCount, lastIncoming }
}
