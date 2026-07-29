import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
  const [userComments, setUserComments] = useState({})
  const channelName = useRef(`comments-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  // Read inside voteComment so its identity stays stable across vote changes,
  // which keeps the hook's returned object from churning on every vote.
  // CommentItem itself is not memoised, and CommentSection hands it inline
  // handlers, so a vote still re-renders the thread; threads are small enough
  // that this has not been worth changing.
  const userVotesRef = useRef(userVotes)
  userVotesRef.current = userVotes

  const fetchComments = useCallback(async () => {
    if (!postId) {
      setComments([])
      setUserVotes({})
      return
    }

    setIsLoading(true)
    const sessionId = getOrCreateSessionId()

    // Explicit column list, not select('*'): comments.session_id has no
    // grant for anon/authenticated any more (T-078), and PostgREST 401s the
    // whole projection — not just the ungranted column — if `*` is asked to
    // expand over one.
    const { data, error } = await supabase
      .from('comments')
      .select('id, post_id, parent_comment_id, content, upvotes, downvotes, is_deleted, depth, created_at')
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

    // Vote tallies come straight off comments.upvotes/downvotes (already in
    // `flat` — denormalised, trigger-maintained since 0039). "My vote" and
    // "is this my own comment" (CommentItem used to get the latter by
    // comparing comment.session_id directly) come from RPCs keyed on the
    // caller's own session_id rather than a bulk `comment_votes`/`comments`
    // read: that column no longer exposes session_id to anon, since it was
    // the only "ownership" check vote_comment/soft_delete_comment trusted,
    // and reading a stranger's off the wire was enough to impersonate them
    // (T-078).
    const nextVotes = {}
    const nextOwn = {}

    if (commentIds.length) {
      const [{ data: voteRows }, { data: ownRows }] = await Promise.all([
        supabase.rpc('get_my_comment_votes', { p_comment_ids: commentIds, p_session_id: sessionId }),
        supabase.rpc('get_my_comment_ids', { p_comment_ids: commentIds, p_session_id: sessionId }),
      ])

      for (const row of voteRows || []) nextVotes[row.comment_id] = row.vote_type
      for (const row of ownRows || []) nextOwn[row.comment_id] = true
    }

    setComments(buildNestedComments(flat))
    setUserVotes(nextVotes)
    setUserComments(nextOwn)
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

      const trimmed = String(content ?? '').trim()
      if (!trimmed) return { error: 'Empty comment' }

      // Bot-blacklist, rate-limit, and parent-depth validation all happen
      // inside create_comment now — a direct REST insert used to be able to
      // skip all three (T-078). See db/sql/0048_social_write_hardening.sql.
      const { data: res, error } = await supabase.rpc('create_comment', {
        p_session_id: sessionId,
        p_post_id: postId,
        p_parent_comment_id: parentCommentId ?? null,
        p_content: trimmed,
      })

      if (error || !res?.success) return { data: null, error: res?.error || error?.message || 'Failed to comment' }
      return { data: res.comment, error: null }
    },
    [postId]
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
  const isOwnComment = useCallback((commentId) => !!userComments[commentId], [userComments])

  return useMemo(
    () => ({
      comments,
      isLoading,
      createComment,
      voteComment,
      deleteComment,
      getUserCommentVote,
      isOwnComment,
    }),
    [comments, createComment, deleteComment, getUserCommentVote, isLoading, isOwnComment, voteComment]
  )
}
