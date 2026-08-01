import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useComments } from '../../../hooks/useComments'
import CommentComposer from './CommentComposer/CommentComposer'
import CommentItem from '../CommentItem/CommentItem'
import styles from './CommentSection.module.css'

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'top', label: 'Top' },
]
/** Longer than this and the thread buries the next post in the feed. */
const COLLAPSE_AFTER = 5

function netScore(comment) {
  return (comment?.upvotes ?? 0) - (comment?.downvotes ?? 0)
}

export default function CommentSection({ postId, sessionId, isOpen }) {
  const [shouldInit, setShouldInit] = useState(false)
  const [sort, setSort] = useState('newest')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (isOpen) setShouldInit(true)
  }, [isOpen])

  const {
    comments,
    isLoading,
    createComment,
    voteComment,
    deleteComment,
    getUserCommentVote,
    isOwnComment,
  } = useComments(shouldInit ? postId : null)

  // Sorting is client-side on the already-fetched array: the thread is capped
  // small, and re-querying per sort would cost a round trip to reorder rows
  // the browser already holds. Replies stay chronological under either sort —
  // a reply out of order reads as a different conversation.
  const sorted = useMemo(() => {
    const list = [...(comments || [])]
    if (sort === 'top') {
      return list.sort(
        (a, b) => netScore(b) - netScore(a) || new Date(b.created_at) - new Date(a.created_at)
      )
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [comments, sort])

  const total = useMemo(
    () => (comments || []).reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0),
    [comments]
  )

  const isCollapsed = !showAll && sorted.length > COLLAPSE_AFTER
  const visible = isCollapsed ? sorted.slice(0, COLLAPSE_AFTER) : sorted
  const hiddenCount = sorted.length - visible.length

  return (
    <div className={styles.section}>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className={styles.wrapper}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <div className={styles.content}>
              <div className={styles.head}>
                <h4 className={styles.heading}>
                  Discussion
                  {total > 0 && <span className={styles.count}>{total}</span>}
                </h4>

                {sorted.length > 1 && (
                  <div className={styles.sort} role="group" aria-label="Sort comments">
                    {SORTS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.sortBtn} ${sort === key ? styles.sortBtnActive : ''}`}
                        onClick={() => setSort(key)}
                        aria-pressed={sort === key}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Composer first. It used to sit underneath the whole thread, so
                  replying to a busy post meant scrolling past every comment to
                  find the box. */}
              <CommentComposer
                sessionId={sessionId}
                onSubmit={(content) => createComment?.(content)}
              />

              <div className={styles.thread}>
                {isLoading && total === 0 ? (
                  <p className={styles.empty}>Loading comments…</p>
                ) : total === 0 ? (
                  <p className={styles.empty}>No comments yet. Start the discussion.</p>
                ) : (
                  <>
                    {visible.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        sessionId={sessionId}
                        isOwn={isOwnComment(c.id)}
                        depth={0}
                        onVote={(commentId, voteType) => voteComment?.(commentId, voteType)}
                        onReply={(content, parentId) => createComment?.(content, parentId)}
                        onDelete={(commentId) => deleteComment?.(commentId)}
                        getUserVote={getUserCommentVote}
                        isOwnComment={isOwnComment}
                      />
                    ))}

                    {sorted.length > COLLAPSE_AFTER && (
                      <button
                        type="button"
                        className={styles.more}
                        onClick={() => setShowAll((v) => !v)}
                        aria-expanded={showAll}
                      >
                        {isCollapsed
                          ? `Show ${hiddenCount} more ${hiddenCount === 1 ? 'comment' : 'comments'}`
                          : 'Collapse thread'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
