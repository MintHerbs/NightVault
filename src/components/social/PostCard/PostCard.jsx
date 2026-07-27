import { forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react'
import { DotsThreeVertical } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'motion/react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import PostActions from '../PostActions/PostActions'
import CodeBlock from '../CodeBlock/CodeBlock'
import CommentSection from '../CommentSection/CommentSection'
import styles from './PostCard.module.css'

function formatRelativeTime(iso) {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function getFirstLines(text, lineCount) {
  const lines = String(text || '').split('\n')
  return lines.slice(0, lineCount).join('\n')
}

function toPercent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

const PostCard = forwardRef(function PostCard(
  { post, sessionId, userVote, hasFlagged, onVote, onFlag, onEdit, onDelete, onPollVote },
  ref
) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCodeExpanded, setIsCodeExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post?.content || '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isVotingPoll, setIsVotingPoll] = useState(false)

  const menuRef = useRef(null)

  const isOwnPost = post?.session_id && sessionId && post.session_id === sessionId

  const timeLabel = useMemo(() => formatRelativeTime(post?.created_at), [post?.created_at])

  const contentLines = useMemo(() => String(post?.content || '').split('\n').length, [post?.content])
  const showReadMore = contentLines > 4 && !isExpanded && !isEditing
  const contentToShow = useMemo(() => {
    if (isEditing) return ''
    if (isExpanded) return String(post?.content || '')
    if (contentLines <= 4) return String(post?.content || '')
    return getFirstLines(post?.content || '', 4)
  }, [contentLines, isExpanded, isEditing, post?.content])

  // Code truncation logic
  const codeLines = useMemo(() => String(post?.code || '').split('\n').length, [post?.code])
  const MAX_CODE_LINES = 15
  const showCodeReadMore = codeLines > MAX_CODE_LINES && !isCodeExpanded
  const codeToShow = useMemo(() => {
    if (isCodeExpanded) return String(post?.code || '')
    if (codeLines <= MAX_CODE_LINES) return String(post?.code || '')
    return getFirstLines(post?.code || '', MAX_CODE_LINES)
  }, [codeLines, isCodeExpanded, post?.code])

  const commentCount = post?.comment_count ?? 0

  useEffect(() => {
    setEditContent(post?.content || '')
  }, [post?.content])

  useEffect(() => {
    if (!menuOpen) return undefined
    const handler = (e) => {
      if (!menuRef.current) return
      if (menuRef.current.contains(e.target)) return
      setMenuOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Polls arrive with the feed (usePosts batches them). Each card used to run
  // its own `polls` query on mount, so a 50-post feed issued 50 extra requests
  // even though most posts have no poll at all.
  const pollStats = post?.poll ?? null
  const userPollVote = pollStats?.userOptionIndex ?? null
  const hasVotedPoll = userPollVote != null

  const handlePollVote = async (idx) => {
    if (!pollStats?.id || !sessionId || hasVotedPoll || isVotingPoll) return
    setIsVotingPoll(true)
    await onPollVote?.(post.id, pollStats.id, idx)
    setIsVotingPoll(false)
  }

  const handleEdit = () => {
    setConfirmDelete(false)
    setMenuOpen(false)
    setIsEditing(true)
    setIsExpanded(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(post?.content || '')
  }

  const handleSaveEdit = async () => {
    const trimmed = String(editContent || '').trim()
    const res = await onEdit?.(post.id, { content: trimmed })
    if (res?.error) return
    setIsEditing(false)
  }

  const handleDeleteClick = () => {
    setMenuOpen(false)
    setIsEditing(false)
    setConfirmDelete(true)
  }

  const handleConfirmDelete = async () => {
    const res = await onDelete?.(post.id)
    if (res?.error) {
      console.error('Failed to delete post:', res.error)
      alert('Failed to delete post. Please try again.')
      setConfirmDelete(false)
      return
    }
    setConfirmDelete(false)
  }

  const handleCancelDelete = () => {
    setConfirmDelete(false)
  }

  return (
    <motion.div 
      ref={ref}
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.header}>
        <div className={styles.avatar}>
          <AgentAvatar seed={post?.session_id || 'anon'} size={32} animated={true} />
        </div>

        <div className={styles.meta}>
          <div className={styles.name}>Anon</div>
          <div className={styles.time}>{timeLabel}</div>
        </div>

        {isOwnPost && (
          <motion.button 
            type="button" 
            className={styles.menuBtn} 
            onClick={() => setMenuOpen((v) => !v)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <DotsThreeVertical size={18} />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div 
            className={styles.menu} 
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <motion.button 
              type="button" 
              className={styles.menuItem} 
              onClick={handleEdit}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.15 }}
            >
              Edit post
            </motion.button>
            <motion.button 
              type="button" 
              className={`${styles.menuItem} ${styles.menuDanger}`} 
              onClick={handleDeleteClick}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.15 }}
            >
              Delete post
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {post?.title && <div className={styles.title}>{post.title}</div>}

      {!isEditing && <div className={styles.content}>{contentToShow}</div>}

      {showReadMore && (
        <motion.div 
          className={styles.readMore} 
          onClick={() => setIsExpanded(true)}
          whileHover={{ x: 4 }}
          transition={{ duration: 0.2 }}
        >
          ...read more
        </motion.div>
      )}

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            className={styles.editArea}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <textarea
              className={styles.editTextarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={1000}
              rows={5}
            />
            <div className={styles.editActions}>
              <motion.button 
                type="button" 
                className={styles.btn} 
                onClick={handleCancelEdit}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
              <RippleButton 
                type="button" 
                className={`${styles.btn} ${styles.btnPrimary}`} 
                onClick={handleSaveEdit}
                hoverScale={1.05}
                tapScale={0.95}
              >
                Save
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
              </RippleButton>
            </div>
          </motion.div>
        )}

        {confirmDelete && (
          <motion.div 
            className={styles.confirm}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.confirmText}>Delete this post?</div>
            <div className={styles.editActions}>
              <motion.button 
                type="button" 
                className={styles.btn} 
                onClick={handleCancelDelete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
              <RippleButton 
                type="button" 
                className={`${styles.btn} ${styles.btnDanger}`} 
                onClick={handleConfirmDelete}
                hoverScale={1.05}
                tapScale={0.95}
              >
                Delete
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
              </RippleButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {post?.code && (
        <div className={styles.attachment}>
          <CodeBlock code={codeToShow} language={post?.code_language || 'auto'} />
          {showCodeReadMore && (
            <motion.div 
              className={styles.readMore} 
              onClick={() => setIsCodeExpanded(true)}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: '8px' }}
            >
              ...read more ({codeLines - MAX_CODE_LINES} more lines)
            </motion.div>
          )}
        </div>
      )}

      {post?.gif_url && <img className={styles.gif} src={post.gif_url} alt="GIF" />}

      {pollStats && pollStats.options.length > 0 && (
        <motion.div 
          className={styles.poll}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {!hasVotedPoll &&
            pollStats.options.map((opt, idx) => (
              <RippleButton
                key={idx}
                type="button"
                className={styles.pollOptionBtn}
                onClick={() => handlePollVote(idx)}
                disabled={isVotingPoll}
                hoverScale={1.02}
                tapScale={0.98}
              >
                {opt}
                <RippleButtonRipples color="rgba(var(--color-accent-rgb), 0.3)" />
              </RippleButton>
            ))}

          {hasVotedPoll &&
            pollStats.options.map((opt, idx) => {
              const count = pollStats.counts[idx] || 0
              const pct = toPercent(count, pollStats.total)
              const isSelected = userPollVote === idx
              return (
                <motion.div 
                  key={idx} 
                  className={styles.barRow}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <div className={styles.barTrack}>
                    <motion.div
                      className={`${styles.barFill} ${isSelected ? styles.barFillSelected : ''}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    />
                    <div className={styles.barContent}>
                      <span className={styles.barLabel}>{opt}</span>
                      <span className={styles.barPercent}>{pct}%</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          
          {hasVotedPoll && (
            <motion.div 
              className={styles.pollFooter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <span>{pollStats.total.toLocaleString()} vote{pollStats.total !== 1 ? 's' : ''}</span>
            </motion.div>
          )}
        </motion.div>
      )}

      {post?.is_edited && <div className={styles.edited}>edited</div>}

      <PostActions
        postId={post?.id}
        upvotes={post?.upvotes}
        downvotes={post?.downvotes}
        commentCount={commentCount}
        userVote={userVote}
        hasFlagged={hasFlagged}
        sessionId={sessionId}
        onVote={(voteType) => onVote?.(post?.id, voteType)}
        onFlag={(id) => onFlag?.(id)}
        onCommentToggle={() => setShowComments((v) => !v)}
        isCommentOpen={showComments}
      />

      <CommentSection
        postId={post?.id}
        commentCount={commentCount}
        sessionId={sessionId}
        isOpen={showComments}
      />
    </motion.div>
  )
})

// Every feed-wide state change (any vote, by anyone) used to re-render all 50
// cards, and each re-render re-tokenised its whole code block. With stable
// props from HomeFeedPage this shallow compare keeps that work to the one card
// that actually changed.
export default memo(PostCard)
