import { forwardRef, memo, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import PostHeader from './PostHeader/PostHeader'
import PostBody from './PostBody/PostBody'
import PostPoll from './PostPoll/PostPoll'
import PostActions from '../PostActions/PostActions'
import CodeBlock from '../CodeBlock/CodeBlock'
import CommentSection from '../CommentSection/CommentSection'
import FlagConfirmDialog from '../FlagConfirmDialog/FlagConfirmDialog'
import styles from './PostCard.module.css'

const MAX_CODE_LINES = 15

function firstLines(text, count) {
  return String(text || '').split('\n').slice(0, count).join('\n')
}

const PostCard = forwardRef(function PostCard(
  { post, sessionId, isOwnPost, userVote, hasFlagged, onVote, onFlag, onEdit, onDelete, onPollVote },
  ref
) {
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post?.content || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showFlagDialog, setShowFlagDialog] = useState(false)
  const [isVotingPoll, setIsVotingPoll] = useState(false)
  const [isCodeExpanded, setIsCodeExpanded] = useState(false)

  useEffect(() => {
    setEditContent(post?.content || '')
  }, [post?.content])

  // Code stays sliced rather than CSS-clamped like the body text: CodeBlock
  // numbers the lines it is given, so hiding the overflow visually would leave
  // the gutter counting rows nobody can see.
  const codeLines = useMemo(() => String(post?.code || '').split('\n').length, [post?.code])
  const canToggleCode = codeLines > MAX_CODE_LINES
  const codeToShow = useMemo(
    () =>
      isCodeExpanded || !canToggleCode
        ? String(post?.code || '')
        : firstLines(post?.code, MAX_CODE_LINES),
    [canToggleCode, isCodeExpanded, post?.code]
  )

  // Polls arrive batched with the feed (usePosts). Each card used to run its
  // own `polls` query on mount, so a 50-post feed issued 50 extra requests.
  const poll = post?.poll ?? null
  const userPollVote = poll?.userOptionIndex ?? null

  const handlePollVote = async (idx) => {
    if (!poll?.id || !sessionId || userPollVote != null || isVotingPoll) return
    setIsVotingPoll(true)
    await onPollVote?.(post.id, poll.id, idx)
    setIsVotingPoll(false)
  }

  const handleSaveEdit = async () => {
    const res = await onEdit?.(post.id, { content: String(editContent || '').trim() })
    if (res?.error) return
    setIsEditing(false)
  }

  const handleConfirmDelete = async () => {
    const res = await onDelete?.(post.id)
    if (res?.error) {
      console.error('Failed to delete post:', res.error)
      return
    }
    setConfirmDelete(false)
  }

  return (
    <motion.article
      ref={ref}
      className={styles.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
    >
      <PostHeader
        postId={post?.id}
        createdAt={post?.created_at}
        isEdited={!!post?.is_edited}
        isOwnPost={isOwnPost}
        isFlagged={!!hasFlagged}
        menuOpen={menuOpen}
        onMenuToggle={setMenuOpen}
        onEdit={() => {
          setMenuOpen(false)
          setConfirmDelete(false)
          setIsEditing(true)
        }}
        onDelete={() => {
          setMenuOpen(false)
          setIsEditing(false)
          setConfirmDelete(true)
        }}
        onFlag={() => {
          setMenuOpen(false)
          setShowFlagDialog(true)
        }}
      />

      <PostBody
        title={post?.title}
        content={post?.content}
        isEditing={isEditing}
        editValue={editContent}
        onEditChange={setEditContent}
        onEditCancel={() => {
          setIsEditing(false)
          setEditContent(post?.content || '')
        }}
        onEditSave={handleSaveEdit}
        isConfirmingDelete={confirmDelete}
        onDeleteCancel={() => setConfirmDelete(false)}
        onDeleteConfirm={handleConfirmDelete}
      />

      {post?.code && (
        <div className={styles.attachment}>
          <CodeBlock code={codeToShow} language={post?.code_language || 'auto'} />
          {canToggleCode && (
            <button
              type="button"
              className={styles.codeToggle}
              onClick={() => setIsCodeExpanded((v) => !v)}
              aria-expanded={isCodeExpanded}
            >
              {isCodeExpanded ? 'Collapse snippet' : `Show ${codeLines - MAX_CODE_LINES} more lines`}
            </button>
          )}
        </div>
      )}

      {post?.gif_url && (
        <div className={styles.media}>
          <img className={styles.mediaImg} src={post.gif_url} alt="Attached GIF" loading="lazy" />
        </div>
      )}

      <PostPoll
        poll={poll}
        hasVoted={userPollVote != null}
        userOptionIndex={userPollVote}
        isVoting={isVotingPoll}
        onVote={handlePollVote}
      />

      <PostActions
        upvotes={post?.upvotes}
        downvotes={post?.downvotes}
        commentCount={post?.comment_count ?? 0}
        userVote={userVote}
        isFlagged={!!hasFlagged}
        onVote={(voteType) => onVote?.(post?.id, voteType)}
        onCommentToggle={() => setShowComments((v) => !v)}
        isCommentOpen={showComments}
      />

      <CommentSection postId={post?.id} sessionId={sessionId} isOpen={showComments} />

      <FlagConfirmDialog
        open={showFlagDialog}
        onClose={() => setShowFlagDialog(false)}
        onConfirm={() => onFlag?.(post?.id)}
        isFlagged={!!hasFlagged}
      />
    </motion.article>
  )
})

// Every feed-wide state change (any vote, by anyone) used to re-render all 50
// cards, and each re-render re-tokenised its whole code block. With stable
// scalar props from HomeFeedPage this shallow compare keeps that work to the
// one card that actually changed (T-064) — do not start passing object props.
export default memo(PostCard)
