import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Rate limiting and bot-blacklist enforcement for posts/comments/chat/votes
// now live entirely inside create_post/create_comment/send_message/vote_post/
// vote_comment/vote_poll (see db/sql/0048_social_write_hardening.sql) — a
// direct REST write used to be able to skip a client-side pre-check
// entirely, so the check has to be where the write actually happens (T-078).
// This hook is left with exactly the part of the old surface that still has
// a caller: a passive "is this session already blacklisted" read, used to
// warm a UI hint before the visitor tries to do anything.

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('session_id', sessionId)
  }
  return sessionId
}

/**
 * One blacklist lookup per session id, shared by every hook instance.
 *
 * `useRateLimit` is mounted once by the feed page, once inside `usePosts`, and
 * once inside `useComments`. A `CommentSection` (so a `useComments`) is mounted
 * for every card in the feed, so a 50-post load fired 52 identical
 * `bot_blacklist` selects, all asking the same question about the same session
 * and all guaranteed the same answer. Cached here rather than gated in
 * `useComments` so that every present and future caller inherits the fix.
 */
const blacklistChecks = new Map()

function readBlacklist(sessionId) {
  const cached = blacklistChecks.get(sessionId)
  if (cached) return cached

  // Routed through an RPC (T-078): bot_blacklist no longer grants anon any
  // direct access at all (nothing legitimate ever needed to read a row other
  // than "is this my own session in it"), so this has to ask is_session_
  // blacklisted for its own session_id rather than select the column back.
  const pending = supabase
    .rpc('is_session_blacklisted', { p_session_id: sessionId })
    .then(({ data, error }) => {
      // A lookup that failed must not be cached as "not blacklisted" for the
      // life of the page. Drop it so the next mount retries.
      if (error) {
        blacklistChecks.delete(sessionId)
        return false
      }
      return !!data
    })
    .catch(() => {
      blacklistChecks.delete(sessionId)
      return false
    })

  blacklistChecks.set(sessionId, pending)
  return pending
}

export function useRateLimit() {
  const [isBlacklisted, setIsBlacklisted] = useState(false)

  useEffect(() => {
    let isActive = true
    const id = getOrCreateSessionId()

    readBlacklist(id).then((blacklisted) => {
      if (isActive && blacklisted) setIsBlacklisted(true)
    })

    return () => {
      isActive = false
    }
  }, [])

  return { isBlacklisted }
}
