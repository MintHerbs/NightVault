import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRateLimit } from './useRateLimit'

const FEED_LIMIT = 50

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('session_id', sessionId)
  }
  return sessionId
}

function stripHtmlTags(value) {
  if (!value) return ''
  return String(value).replace(/<[^>]*>/g, '')
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

/**
 * Fetch every derived value the feed needs in a fixed number of round trips.
 *
 * The previous implementation called a per-post `getPostCounts()` inside a
 * `Promise.all` over the page (2 queries each) and every PostCard separately
 * queried `polls` on mount — roughly 150 requests for a 50-post feed. These
 * `.in(...)` batches are 4 queries (5 when any post carries a poll) regardless
 * of page size, and vote rows are read once and bucketed in a single pass so
 * the caller's own vote falls out of the same response as the totals.
 */
async function loadFeedExtras(postIds, sessionId) {
  const empty = { countsById: {}, pollsByPostId: {}, userVotes: {}, userFlags: {} }
  if (!postIds.length) return empty

  const [voteRes, commentRes, pollRes, flagRes] = await Promise.all([
    supabase.from('post_votes').select('post_id, session_id, vote_type').in('post_id', postIds),
    supabase.from('comments').select('post_id').in('post_id', postIds).eq('is_deleted', false),
    supabase.from('polls').select('id, post_id, options').in('post_id', postIds),
    sessionId
      ? supabase.from('post_flags').select('post_id').eq('session_id', sessionId).in('post_id', postIds)
      : Promise.resolve({ data: [] }),
  ])

  const countsById = {}
  for (const id of postIds) countsById[id] = { upvotes: 0, downvotes: 0, comment_count: 0 }

  const userVotes = {}
  for (const row of voteRes.data || []) {
    const bucket = countsById[row.post_id]
    if (!bucket) continue
    if (row.vote_type === 'up') bucket.upvotes += 1
    else if (row.vote_type === 'down') bucket.downvotes += 1
    if (sessionId && row.session_id === sessionId) userVotes[row.post_id] = row.vote_type
  }

  for (const row of commentRes.data || []) {
    const bucket = countsById[row.post_id]
    if (bucket) bucket.comment_count += 1
  }

  const userFlags = {}
  for (const row of flagRes.data || []) userFlags[row.post_id] = true

  const pollRows = pollRes.data || []
  const pollsByPostId = {}

  if (pollRows.length) {
    const pollIds = pollRows.map((p) => p.id)
    const { data: pollVoteRows } = await supabase
      .from('poll_votes')
      .select('poll_id, session_id, option_index')
      .in('poll_id', pollIds)

    const votesByPollId = new Map()
    for (const row of pollVoteRows || []) {
      const entry = votesByPollId.get(row.poll_id) || { counts: new Map(), mine: null }
      entry.counts.set(row.option_index, (entry.counts.get(row.option_index) || 0) + 1)
      if (sessionId && row.session_id === sessionId) entry.mine = row.option_index
      votesByPollId.set(row.poll_id, entry)
    }

    for (const row of pollRows) {
      pollsByPostId[row.post_id] = buildPoll(row, votesByPollId.get(row.id))
    }
  }

  return { countsById, pollsByPostId, userVotes, userFlags }
}

function buildPoll(pollRow, voteEntry) {
  const options = Array.isArray(pollRow.options) ? pollRow.options : []
  const counts = options.map((_, idx) => voteEntry?.counts.get(idx) || 0)
  return {
    id: pollRow.id,
    options,
    counts,
    total: counts.reduce((a, b) => a + b, 0),
    userOptionIndex: voteEntry?.mine ?? null,
  }
}

/** Poll + counts for a single post, used when realtime hands us a row we have not seen. */
async function hydratePost(post, sessionId) {
  const { countsById, pollsByPostId, userVotes, userFlags } = await loadFeedExtras([post.id], sessionId)
  return {
    merged: {
      ...post,
      ...(countsById[post.id] || { upvotes: 0, downvotes: 0, comment_count: 0 }),
      poll: pollsByPostId[post.id] ?? null,
    },
    userVote: userVotes[post.id] ?? null,
    hasFlag: !!userFlags[post.id],
  }
}

/**
 * Authoritative vote tallies for one post, as two head-only counts so the
 * response size does not grow with the number of votes on the post.
 *
 * Only used to repair the one realtime case a delta cannot describe; the feed
 * itself never calls this.
 */
async function fetchVoteCounts(postId) {
  const countOf = (voteType) =>
    supabase
      .from('post_votes')
      .select('post_id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('vote_type', voteType)

  const [up, down] = await Promise.all([countOf('up'), countOf('down')])
  if (up.error || down.error) return null
  return { upvotes: up.count ?? 0, downvotes: down.count ?? 0 }
}

function adjustCounts(post, from, to) {
  let upvotes = post.upvotes ?? 0
  let downvotes = post.downvotes ?? 0
  if (from === 'up') upvotes -= 1
  else if (from === 'down') downvotes -= 1
  if (to === 'up') upvotes += 1
  else if (to === 'down') downvotes += 1
  return { ...post, upvotes: Math.max(0, upvotes), downvotes: Math.max(0, downvotes) }
}

export function usePosts() {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [userVotes, setUserVotes] = useState({})
  const [userFlags, setUserFlags] = useState({})
  const channelName = useRef(`posts-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  // Mirrored into refs so the mutation callbacks below can read current state
  // without listing it as a dependency. Keeping their identities stable is what
  // lets HomeFeedPage hand them straight to a memoised PostCard.
  const userVotesRef = useRef(userVotes)
  userVotesRef.current = userVotes
  const userFlagsRef = useRef(userFlags)
  userFlagsRef.current = userFlags
  const postsRef = useRef(posts)
  postsRef.current = posts
  const sessionIdRef = useRef(null)

  const { checkLimit, recordAction, isBlacklisted } = useRateLimit()

  useEffect(() => {
    let isActive = true

    const fetchPosts = async () => {
      setIsLoading(true)
      const sessionId = getOrCreateSessionId()
      sessionIdRef.current = sessionId

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('is_deleted', false)
        .eq('is_flagged', false)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)

      if (!isActive) return

      if (error) {
        setPosts([])
        setIsLoading(false)
        return
      }

      const rows = data || []
      const extras = await loadFeedExtras(rows.map((p) => p.id).filter(Boolean), sessionId)
      if (!isActive) return

      setPosts(
        rows.map((post) => ({
          ...post,
          ...(extras.countsById[post.id] || { upvotes: 0, downvotes: 0, comment_count: 0 }),
          poll: extras.pollsByPostId[post.id] ?? null,
        }))
      )
      setUserVotes(extras.userVotes)
      setUserFlags(extras.userFlags)
      setIsLoading(false)
    }

    fetchPosts()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const next = payload.new
          if (!next?.id || next.is_deleted || next.is_flagged) return
          const { merged } = await hydratePost(next, sessionIdRef.current)
          setPosts((prev) => {
            if (prev.some((p) => p.id === merged.id)) return prev
            return sortByCreatedAtDesc([merged, ...prev]).slice(0, FEED_LIMIT)
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        async (payload) => {
          const next = payload.new
          if (!next?.id) return

          if (next.is_deleted || next.is_flagged) {
            setPosts((prev) => prev.filter((p) => p.id !== next.id))
            return
          }

          // An edit never changes vote or comment totals, so carry the ones we
          // already hold instead of re-querying them.
          if (postsRef.current.some((p) => p.id === next.id)) {
            setPosts((prev) => prev.map((p) => (p.id === next.id ? { ...p, ...next } : p)))
            return
          }

          const { merged } = await hydratePost(next, sessionIdRef.current)
          setPosts((prev) =>
            prev.some((p) => p.id === merged.id)
              ? prev
              : sortByCreatedAtDesc([merged, ...prev]).slice(0, FEED_LIMIT)
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          const oldRow = payload.old
          if (!oldRow?.id) return
          setPosts((prev) => prev.filter((p) => p.id !== oldRow.id))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_votes' },
        async (payload) => {
          const newRow = payload.new
          const oldRow = payload.old
          const postId = newRow?.post_id ?? oldRow?.post_id
          if (!postId) return

          // Our own writes are already reflected optimistically; applying the
          // echo too would double-count. DELETE only carries session_id when
          // the table is REPLICA IDENTITY FULL. When it is not, postId is
          // absent as well and we returned above; see T-067 for that gap.
          const actor = newRow?.session_id ?? oldRow?.session_id
          if (actor && actor === sessionIdRef.current) return

          // A vote we cannot see is not worth a repair query.
          if (!postsRef.current.some((p) => p.id === postId)) return

          // An UPDATE is someone switching up to down, so the delta needs the
          // previous vote_type. `payload.old` only carries it under REPLICA
          // IDENTITY FULL; under the default identity it holds the key columns
          // and nothing else, and treating a missing value as "no previous
          // vote" would add the new vote without removing the old one and drift
          // the count upwards. Branch on whether it is actually present, so if
          // the table's replica identity is ever widened this repair query
          // retires itself instead of lingering as dead cost.
          if (payload.eventType === 'UPDATE' && oldRow?.vote_type == null) {
            const counts = await fetchVoteCounts(postId)
            if (counts) setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...counts } : p)))
            return
          }

          const from = payload.eventType === 'INSERT' ? null : oldRow?.vote_type ?? null
          const to = payload.eventType === 'DELETE' ? null : newRow?.vote_type ?? null
          if (from === to) return

          setPosts((prev) => prev.map((p) => (p.id === postId ? adjustCounts(p, from, to) : p)))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        async (payload) => {
          const newRow = payload.new
          const oldRow = payload.old
          const postId = newRow?.post_id ?? oldRow?.post_id
          if (!postId) return

          let delta = null
          if (payload.eventType === 'INSERT') delta = newRow.is_deleted ? 0 : 1
          else if (payload.eventType === 'DELETE') delta = -1
          else if (typeof oldRow?.is_deleted === 'boolean') {
            delta = oldRow.is_deleted === newRow.is_deleted ? 0 : newRow.is_deleted ? -1 : 1
          }

          if (delta === 0) return

          if (delta === null) {
            // Soft delete arrives as an UPDATE, and without the previous row we
            // cannot tell whether it changed the visible count. Rare enough to
            // pay for one authoritative count.
            const { count } = await supabase
              .from('comments')
              .select('id', { count: 'exact', head: true })
              .eq('post_id', postId)
              .eq('is_deleted', false)
            setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comment_count: count ?? 0 } : p)))
            return
          }

          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) + delta) } : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const createPost = useCallback(
    async (data) => {
      const sessionId = getOrCreateSessionId()
      const allowed = await checkLimit('post')
      if (!allowed) {
        const { data: blacklistRow } = await supabase
          .from('bot_blacklist')
          .select('session_id')
          .eq('session_id', sessionId)
          .maybeSingle()

        if (blacklistRow?.session_id || isBlacklisted) return { error: 'Unable to post at this time' }
        return { error: 'Rate limited' }
      }

      if (isBlacklisted) return { error: 'Unable to post at this time' }

      await supabase.from('sessions').upsert({ id: sessionId, last_seen: new Date().toISOString() })

      const content = stripHtmlTags(data?.content).trim()
      if (content.length > 1000) return { error: 'Content too long' }

      const title = data?.title != null && String(data.title).trim() !== '' ? stripHtmlTags(data.title).trim() : null

      const insertPayload = {
        session_id: sessionId,
        title,
        content,
        code: data?.code ?? null,
        code_language: data?.codeLanguage ?? data?.code_language ?? null,
        gif_url: data?.gifUrl ?? data?.gif_url ?? null,
      }

      const { data: botCheck } = await supabase.rpc('check_bot_blacklist', {
        p_session_id: sessionId,
      })
      if (botCheck?.is_blacklisted) return { error: 'Unable to post at this time' }

      const { data: postRow, error: postError } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select('*')
        .single()

      if (postError) return { error: 'Failed to create post' }

      if (data?.poll) {
        const options = Array.isArray(data.poll?.options) ? data.poll.options : data.poll
        const { error: pollError } = await supabase.from('polls').insert({ post_id: postRow.id, options })
        if (pollError) return { error: 'Failed to create poll' }
      }

      await recordAction('post')
      return { data: postRow }
    },
    [checkLimit, isBlacklisted, recordAction]
  )

  const updatePost = useCallback(async (id, data) => {
    const sessionId = getOrCreateSessionId()
    const patch = {}

    if (data?.title !== undefined) {
      patch.title = data.title != null && String(data.title).trim() !== '' ? stripHtmlTags(data.title).trim() : null
    }

    if (data?.content !== undefined) {
      const content = stripHtmlTags(data.content).trim()
      if (content.length > 1000) return { error: 'Content too long' }
      patch.content = content
    }

    if (data?.code !== undefined) patch.code = data.code ?? null
    if (data?.codeLanguage !== undefined) patch.code_language = data.codeLanguage ?? null
    if (data?.gifUrl !== undefined) patch.gif_url = data.gifUrl ?? null

    // Ownership is enforced inside the RPC, which filters on session_id. The
    // direct `.update()` this replaces could never match a row: the
    // `update_own_posts` policy reads a transaction-local GUC that no longer
    // exists by the time the request arrives. See T-069.
    const { data: res, error } = await supabase.rpc('update_own_post', {
      p_post_id: id,
      p_session_id: sessionId,
      p_patch: patch,
    })

    if (error || !res?.success) return { error: res?.error || 'Failed to update post' }

    const applied = { ...patch, is_edited: true, updated_at: new Date().toISOString() }
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...applied } : p)))
    return { data: applied }
  }, [])

  const deletePost = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('soft_delete_post', {
      p_post_id: id,
      p_session_id: localStorage.getItem('session_id'),
    })

    if (error || !data?.success) return { error: data?.error || 'Failed to delete post' }

    setPosts((prev) => prev.filter((p) => p.id !== id))
    return { data: true }
  }, [])

  /** Move both the caller's vote marker and the visible tallies in one commit. */
  const applyVote = useCallback((postId, from, to) => {
    setUserVotes((prev) => {
      const next = { ...prev }
      if (to === null) delete next[postId]
      else next[postId] = to
      return next
    })
    setPosts((prev) => prev.map((p) => (p.id === postId ? adjustCounts(p, from, to) : p)))
  }, [])

  const votePost = useCallback(
    async (postId, voteType) => {
      if (voteType !== 'up' && voteType !== 'down') return { error: 'Invalid vote type' }
      const sessionId = getOrCreateSessionId()
      sessionIdRef.current = sessionId

      const previousVote = userVotesRef.current[postId] ?? null
      const nextVote = previousVote === voteType ? null : voteType

      // Paint first. The old flow waited on a SELECT and then an UPSERT before
      // the arrow changed colour, which is the lag users were reporting; we
      // already know the current vote from state, so the SELECT is redundant.
      applyVote(postId, previousVote, nextVote)

      // Routed through an RPC rather than writing `post_votes` directly.
      // `post_votes` has no UPDATE policy, so the upsert this replaces errored
      // outright whenever the write hit a conflict, which is exactly the
      // up-to-down switch; and `delete_own_votes` could never match, so
      // removing a vote silently affected zero rows. See T-069.
      const { data: res, error } = await supabase.rpc('vote_post', {
        p_post_id: postId,
        p_session_id: sessionId,
        p_vote_type: nextVote,
      })

      if (error || !res?.success) {
        applyVote(postId, nextVote, previousVote)
        return { error: nextVote === null ? 'Failed to remove vote' : 'Failed to vote' }
      }

      return { data: nextVote }
    },
    [applyVote]
  )

  const flagPost = useCallback(async (postId) => {
    const sessionId = getOrCreateSessionId()
    const wasFlagged = !!userFlagsRef.current[postId]

    setUserFlags((prev) => {
      const next = { ...prev }
      if (wasFlagged) delete next[postId]
      else next[postId] = true
      return next
    })

    // `post_flags` has no DELETE policy at all, so unflagging used to affect
    // zero rows and report success. The RPC also swallows a double-flag with
    // ON CONFLICT DO NOTHING, so the duplicate-message sniffing this replaces
    // is no longer needed. See T-069.
    const { data: res, error } = await supabase.rpc('flag_post', {
      p_post_id: postId,
      p_session_id: sessionId,
      p_flagged: !wasFlagged,
    })

    if (error || !res?.success) {
      setUserFlags((prev) => {
        const next = { ...prev }
        if (wasFlagged) next[postId] = true
        else delete next[postId]
        return next
      })
      return { error: wasFlagged ? 'Failed to unflag post' : 'Failed to flag post' }
    }

    return { data: !wasFlagged }
  }, [])

  /** Optimistic poll vote; PostCard renders straight from `post.poll`. */
  const votePoll = useCallback(async (postId, pollId, optionIndex) => {
    const sessionId = getOrCreateSessionId()
    if (!pollId) return { error: 'Missing poll' }

    const current = postsRef.current.find((p) => p.id === postId)
    const rollback = current?.poll
    if (!rollback || rollback.userOptionIndex != null) return { data: null }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !p.poll) return p
        const counts = p.poll.counts.map((c, i) => (i === optionIndex ? c + 1 : c))
        return { ...p, poll: { ...p.poll, counts, total: p.poll.total + 1, userOptionIndex: optionIndex } }
      })
    )

    const { error } = await supabase
      .from('poll_votes')
      .upsert({ poll_id: pollId, session_id: sessionId, option_index: optionIndex }, { onConflict: 'poll_id,session_id' })

    if (error) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, poll: rollback } : p)))
      return { error: 'Failed to vote' }
    }

    return { data: optionIndex }
  }, [])

  return useMemo(
    () => ({
      posts,
      isLoading,
      userVotes,
      userFlags,
      createPost,
      updatePost,
      deletePost,
      votePost,
      votePoll,
      flagPost,
    }),
    [createPost, deletePost, flagPost, isLoading, posts, updatePost, userFlags, userVotes, votePoll, votePost]
  )
}
