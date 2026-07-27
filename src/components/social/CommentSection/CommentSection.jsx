import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useComments } from '../../../hooks/useComments'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import styles from './CommentSection.module.css'
import CommentItem from '../CommentItem/CommentItem'

const MAX_CHARS = 500
const COUNTER_VISIBLE_FROM = 400

export default function CommentSection({ postId, sessionId, isOpen }) {
  const [shouldInit, setShouldInit] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState(null)
  const [isPosting, setIsPosting] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const textareaRef = useRef(null)

  useEffect(() => {
    if (isOpen) setShouldInit(true)
  }, [isOpen])

  const { comments, isLoading, createComment, voteComment, deleteComment, getUserCommentVote } = useComments(
    shouldInit ? postId : null
  )

  const isExpanded = useMemo(() => {
    if (!newContent) return false
    if (newContent.includes('\n')) return true
    return newContent.length > 80
  }, [newContent])

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const computed = window.getComputedStyle(el)
    const lineHeight = Number.parseFloat(computed.lineHeight || '20') || 20
    const maxHeight = Math.round(lineHeight * 6 + 20)
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useEffect(() => {
    resizeTextarea()
  }, [newContent])

  const trimmed = newContent.trim()
  const canPost = trimmed.length > 0 && !isPosting
  // The action row only appears once the field is in use, so a closed comment
  // thread is not two buttons taller than it needs to be.
  const showActions = isFocused || newContent.length > 0

  const handlePost = async () => {
    if (!canPost) return
    setError(null)
    setIsPosting(true)
    const res = await createComment?.(trimmed)
    if (res?.error) {
      setError(res.error)
      setIsPosting(false)
      return
    }
    setNewContent('')
    setIsPosting(false)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePost()
    }
  }

  const handleReply = async (content, parentId) => {
    const res = await createComment?.(content, parentId)
    return res
  }

  const total = (comments || []).reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)

  return (
    <div className={styles.section}>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className={styles.panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className={styles.content}>
              <div className={styles.threadHeader}>
                Discussion
                {total > 0 && <span className={styles.threadCount}>{total}</span>}
              </div>

              {/* Composer first. It used to sit underneath the whole thread,
                  so replying to a busy post meant scrolling past every comment
                  to find the box. */}
              <div className={styles.newComment}>
                <div className={styles.newCommentAvatar}>
                  <AgentAvatar seed={sessionId || 'anon'} size={28} animated={true} />
                </div>

                <div className={styles.newCommentBody}>
                  <textarea
                    ref={textareaRef}
                    className={`${styles.textarea} ${isExpanded ? styles.textareaExpanded : ''}`}
                    placeholder="Add a thoughtful reply"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value.slice(0, MAX_CHARS))}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    maxLength={MAX_CHARS}
                    rows={1}
                    aria-label="Add a comment"
                  />

                  {error && (
                    <div className={styles.error} role="alert">
                      {error}
                    </div>
                  )}

                  {showActions && (
                    <div className={styles.actions}>
                      {newContent.length >= COUNTER_VISIBLE_FROM && (
                        <span className={styles.charCount}>
                          {newContent.length}/{MAX_CHARS}
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                          setNewContent('')
                          setError(null)
                        }}
                        disabled={isPosting || !newContent}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={handlePost}
                        disabled={!canPost}
                      >
                        {isPosting && <Loader2 size={14} className={styles.spinner} />}
                        {isPosting ? 'Posting' : 'Comment'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.thread}>
                {isLoading && total === 0 ? (
                  <div className={styles.threadEmpty}>Loading comments…</div>
                ) : total === 0 ? (
                  <div className={styles.threadEmpty}>No comments yet. Start the discussion.</div>
                ) : (
                  (comments || []).map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      sessionId={sessionId}
                      depth={0}
                      onVote={(commentId, voteType) => voteComment?.(commentId, voteType)}
                      onReply={handleReply}
                      onDelete={(commentId) => deleteComment?.(commentId)}
                      getUserVote={getUserCommentVote}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
