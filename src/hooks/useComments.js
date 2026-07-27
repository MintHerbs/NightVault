import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRateLimit } from './useRateLimit'

function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem('session_id', sessionId)
  }
  return sessionId
}

function buildNestedComments(flatComments) {
  const topLevel = (flatComments || []).filter((c) => !c.parent_comment_id)

  const repliesByParent = new Map()
  for (const c of flatComments || []) {
    if (!c.parent_comment_id) continue
    const list = repliesByParent.get(c.parent_comment_id) || []
    list.push(c)
    repliesByParent.set(c.parent_comment_id, list)
  }

  return topLevel.map((c) => ({
    ...c,
    replies: repliesByParent.get(c.id) || [],
  }))
}

/** Apply `fn` to one comment anywhere in the two-level tree, leaving the rest untouched. */
function mapComment(tree, commentId, fn) {
  return tree.map((c) => {
    if (c.id === commentId) return { ...fn(c), replies: c.replies }
    if (!c.replies?.some((r) => r.id === commentId)) return c
    return { ...c, replies: c.replies.map((r) => (r.id === commentId ? fn(r) : r)) }
  })
}

function adjustVoteCounts(comment, from, to) {
  let upvotes = comment.upvotes ?? 0
  let downvotes = comment.downvotes ?? 0
  if (from === 'up') upvotes -= 1
  else if (from === 'down') downvotes -= 1
  if (to === 'up') upvotes += 1
  else if (to === 'down') downvotes += 1
  return { ...comment, upvotes: Math.max(0, upvotes), downvotes: Math.max(0, downvotes) }
}

export function useComments(postId) {
  const [comments, setComments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [userVotes, setUserVotes] = useState({})
  const channelName = useRef(`comments-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  // Read inside voteComment so its identity stays stable across vote changes,
  // which keeps the hook's returned object from churning on every vote.
  // CommentItem itself is not memoised, and CommentSection hands it inline
  // handlers, so a vote still re-renders the thread; threads are small enough
  // that this has not been worth changing.
  const userVotesRef = useRef(userVotes)
  userVotesRef.current = userVotes

  const { checkLimit, recordAction } = useRateLimit()

  const fetchComments = useCallback(async () => {
    if (!postId) {
      setComments([])
      setUserVotes({})
      return
    }

    setIsLoading(true)
    const sessionId = getOrCreateSessionId()

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (error) {
      setComments([])
      setIsLoading(false)
      return
    }

    const flat = data || []
    const commentIds = flat.map((c) => c.id).filter(Boolean)

    // One request, one pass. This used to be two `comment_votes` queries: one
    // for the tallies and a second re-reading the same table filtered to our own
    // session. Asking for `session_id` up front makes the caller's own vote fall
    // out of the tallies for free, which is what `loadFeedExtras` does for post
    // votes.
    const countsById = {}
    const nextVotes = {}

    if (commentIds.length) {
      const { data: voteRows } = await supabase
        .from('comment_votes')
        .select('comment_id, session_id, vote_type')
        .in('comment_id', commentIds)

      for (const row of voteRows || []) {
        let bucket = countsById[row.comment_id]
        if (!bucket) {
          bucket = { upvotes: 0, downvotes: 0 }
          countsById[row.comment_id] = bucket
        }
        if (row.vote_type === 'up') bucket.upvotes += 1
        else if (row.vote_type === 'down') bucket.downvotes += 1
        if (row.session_id === sessionId) nextVotes[row.comment_id] = row.vote_type
      }
    }

    setComments(
      buildNestedComments(
        flat.map((c) => ({
          ...c,
          upvotes: countsById[c.id]?.upvotes ?? 0,
          downvotes: countsById[c.id]?.downvotes ?? 0,
        }))
      )
    )
    setUserVotes(nextVotes)
    setIsLoading(false)
  }, [postId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  useEffect(() => {
    if (!postId) return undefined

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        () => {
          fetchComments()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchComments, postId])

  const createComment = useCallback(
    async (content, parentCommentId) => {
      if (!postId) return { error: 'Missing postId' }
      const sessionId = getOrCreateSessionId()

      const allowed = await checkLimit('comment')
      if (!allowed) return { error: 'Rate limited' }

      const trimmed = String(content ?? '').trim()
      if (!trimmed) return { error: 'Empty comment' }

      let depth = 0
      let parentId = parentCommentId ?? null

      if (parentId) {
        const { data: parentRow } = await supabase
          .from('comments')
          .select('id, depth')
          .eq('id', parentId)
          .maybeSingle()

        if (!parentRow?.id || parentRow.depth !== 0) return { error: 'Invalid parent comment' }
        depth = 1
      }

      const { data: botCheck } = await supabase.rpc('check_bot_blacklist', {
        p_session_id: localStorage.getItem('session_id')
      })
      if (botCheck?.is_blacklisted) throw new Error('Unable to post at this time.')

      const { data: inserted, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          parent_comment_id: parentId,
          session_id: sessionId,
          content: trimmed,
          depth,
        })
        .select('*')
        .single()

      if (!error) await recordAction('comment')
      return { data: inserted ?? null, error: error ?? null }
    },
    [checkLimit, postId, recordAction]
  )

  /** Move the caller's vote marker and the visible tallies together. */
  const applyVote = useCallback((commentId, from, to) => {
    setUserVotes((prev) => {
      const next = { ...prev }
      if (to === null) delete next[commentId]
      else next[commentId] = to
      return next
    })
    setComments((prev) => mapComment(prev, commentId, (c) => adjustVoteCounts(c, from, to)))
  }, [])

  const voteComment = useCallback(
    async (commentId, voteType) => {
      if (voteType !== 'up' && voteType !== 'down') return { error: 'Invalid vote type' }
      const sessionId = getOrCreateSessionId()

      const previousVote = userVotesRef.current[commentId] ?? null
      const nextVote = previousVote === voteType ? null : voteType

      // Paint first, then write. This used to wait on the write and then call
      // fetchComments(), which is three more queries, so a single click cost
      // four round trips before the arrow moved.
      applyVote(commentId, previousVote, nextVote)

      // Same RLS problem as post votes: `comment_votes` has no UPDATE policy,
      // so switching a vote errored, and `delete_comment_votes` could never
      // match, so removing one silently did nothing. See T-069.
      const { data: res, error } = await supabase.rpc('vote_comment', {
        p_comment_id: commentId,
        p_session_id: sessionId,
        p_vote_type: nextVote,
      })

      if (error || !res?.success) {
        applyVote(commentId, nextVote, previousVote)
        return { error: nextVote === null ? 'Failed to remove vote' : 'Failed to vote' }
      }

      return { data: nextVote }
    },
    [applyVote]
  )

  const deleteComment = useCallback(async (commentId) => {
    // No withSession() here: soft_delete_comment is SECURITY DEFINER and
    // filters on p_session_id itself, so the extra round trip only ever set a
    // transaction-local GUC that the next request could not see. See T-069.
    const { data, error } = await supabase.rpc('soft_delete_comment', {
      p_comment_id: commentId,
      p_session_id: localStorage.getItem('session_id'),
    })

    if (error || !data?.success) return { error: data?.error || 'Failed to delete comment' }

    // The realtime UPDATE for this row refreshes the thread; nothing to do here.
    return { data: true }
  }, [])

  const getUserCommentVote = useCallback((commentId) => userVotes[commentId] ?? null, [userVotes])

  return useMemo(
    () => ({
      comments,
      isLoading,
      createComment,
      voteComment,
      deleteComment,
      getUserCommentVote,
    }),
    [comments, createComment, deleteComment, getUserCommentVote, isLoading, voteComment]
  )
}
