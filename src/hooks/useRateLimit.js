import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ACTION_CONFIG = {
  post: {
    max: 50,
    windowSecs: 3600,
  },
  comment: {
    max: 10,
    windowSecs: 3600,
  },
  chat: {
    max: 20,
    windowSecs: 300,
  },
  vote: {
    max: 50,
    windowSecs: 3600,
  },
}

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

  const pending = supabase
    .from('bot_blacklist')
    .select('session_id')
    .eq('session_id', sessionId)
    .maybeSingle()
    .then(({ data, error }) => {
      // A lookup that failed must not be cached as "not blacklisted" for the
      // life of the page. Drop it so the next mount retries.
      if (error) {
        blacklistChecks.delete(sessionId)
        return false
      }
      return !!data?.session_id
    })
    .catch(() => {
      blacklistChecks.delete(sessionId)
      return false
    })

  blacklistChecks.set(sessionId, pending)
  return pending
}

export function useRateLimit() {
  const [sessionId, setSessionId] = useState(null)
  const [isBlacklisted, setIsBlacklisted] = useState(false)

  const checkAndIncrementPostCount = useCallback(async () => {
    try {
      if (!sessionId) return { allowed: true }

      const cfg = ACTION_CONFIG.post
      const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
        p_session_id: sessionId,
        p_action: 'post',
        p_max_count: cfg.max,
        p_window_secs: cfg.windowSecs,
      })

      if (error) {
        console.error('[RateLimit] Failed to check post rate limit:', error)
        return { allowed: true }
      }

      if (!data.allowed) {
        const secondsLeft = data.retry_after_seconds ?? 0

        // Blacklist if burst posting (within 2 minutes)
        if (secondsLeft > cfg.windowSecs - 2 * 60) {
          const { error: blacklistError } = await supabase.from('bot_blacklist').upsert({
            session_id: sessionId,
            reason: 'post_burst',
          })
          if (blacklistError) console.error('[RateLimit] Failed to upsert bot blacklist:', blacklistError)
          // The shared cache is holding a `false` from page load; correct it so
          // instances mounted after this point do not read the stale answer.
          if (!blacklistError) blacklistChecks.set(sessionId, Promise.resolve(true))
          setIsBlacklisted(true)
        }

        return { allowed: false, secondsLeft }
      }

      return { allowed: true }
    } catch (e) {
      console.error('[RateLimit] Post rate limit check failed:', e)
      return { allowed: true }
    }
  }, [sessionId])

  useEffect(() => {
    let isActive = true
    const id = getOrCreateSessionId()
    setSessionId(id)

    readBlacklist(id).then((blacklisted) => {
      if (isActive && blacklisted) setIsBlacklisted(true)
    })

    return () => {
      isActive = false
    }
  }, [])

  const checkLimit = useCallback(
    async (action) => {
      if (!sessionId) return false

      const cfg = ACTION_CONFIG[action]
      if (!cfg) return true

      if (action === 'post') {
        if (isBlacklisted) return false
        const res = await checkAndIncrementPostCount()
        return !!res.allowed
      }

      // For non-post actions, check without incrementing
      try {
        const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
          p_session_id: sessionId,
          p_action: action,
          p_max_count: cfg.max,
          p_window_secs: cfg.windowSecs,
        })

        if (error) {
          console.error(`[RateLimit] Failed to check ${action} rate limit:`, error)
          return false
        }

        // If not allowed, throw error with retry_after for countdown UI
        if (!data.allowed) {
          const err = new Error(`Rate limit exceeded for ${action}`)
          err.retryAfter = data.retry_after_seconds
          throw err
        }

        return data.allowed
      } catch (e) {
        console.error(`[RateLimit] ${action} rate limit check failed:`, e)
        // Re-throw if it has retryAfter (our custom error)
        if (e.retryAfter !== undefined) throw e
        return false
      }
    },
    [checkAndIncrementPostCount, isBlacklisted, sessionId]
  )

  const recordAction = useCallback(
    async (action) => {
      if (!sessionId) return

      // Post action is already recorded in checkAndIncrementPostCount
      if (action === 'post') return

      const cfg = ACTION_CONFIG[action]
      if (!cfg) return

      try {
        const { data, error } = await supabase.rpc('check_and_increment_rate_limit', {
          p_session_id: sessionId,
          p_action: action,
          p_max_count: cfg.max,
          p_window_secs: cfg.windowSecs,
        })

        if (error) {
          console.error(`[RateLimit] Failed to record ${action}:`, error)
          return
        }

        // If not allowed, throw error with retry_after for countdown UI
        if (!data.allowed) {
          const err = new Error(`Rate limit exceeded for ${action}`)
          err.retryAfter = data.retry_after_seconds
          throw err
        }
      } catch (e) {
        console.error(`[RateLimit] Failed to record ${action}:`, e)
        // Re-throw if it has retryAfter (our custom error)
        if (e.retryAfter !== undefined) throw e
      }
    },
    [sessionId]
  )

  return useMemo(
    () => ({
      checkLimit,
      recordAction,
      isBlacklisted,
    }),
    [checkLimit, isBlacklisted, recordAction]
  )
}
