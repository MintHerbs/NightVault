import { useState } from 'react'
import { CornerDownRight, Trash2 } from 'lucide-react'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import VoteControl from '../../ui/VoteControl/VoteControl'
import ReplyBox from './ReplyBox/ReplyBox'
import { formatAbsoluteTime, formatRelativeTime } from '../../../lib/social/relativeTime'
import styles from './CommentItem.module.css'

export default function CommentItem({
  comment,
  sessionId,
  isOwn = false,
  depth,
  onVote,
  onReply,
  onDelete,
  getUserVote,
  isOwnComment,
  isLast = true,
}) {
  const [showReply, setShowReply] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const userVote = getUserVote?.(comment?.id) ?? null
  const isRemoved = !!comment?.is_deleted
  const replies = Array.isArray(comment?.replies) ? comment.replies : []
  const isReply = depth === 1
  // The connector spine runs from this avatar down to the last reply's avatar,
  // crossing however many siblings sit between. No single element knows where
  // that last reply lands, so each element on the way paints its own segment
  // and they butt together across .body's flex gap.
  const hasReplies = !isReply && replies.length > 0

  const handlePostReply = async (content) => {
    const res = await onReply?.(content, comment.id)
    if (res?.error) return res
    setShowReply(false)
    return res
  }

  const handleConfirmDelete = async () => {
    const res = await onDelete?.(comment.id)
    if (res?.error) {
      console.error('Failed to delete comment:', res.error)
      return
    }
    setShowDeleteConfirm(false)
  }

  return (
    <div className={`${styles.item} ${isReply ? styles.indentReply : ''}`}>
      {/* Drops from the parent's avatar and curves into this one. A reply with
          another after it also carries the spine on down to it. */}
      {isReply && (
        <div
          className={`${styles.connector} ${isLast ? '' : styles.connectorContinues}`}
          aria-hidden="true"
        />
      )}

      <div className={styles.body}>
        <div className={`${styles.row} ${hasReplies ? styles.spineSegment : ''}`}>
          <div className={styles.avatar}>
            {/* Seeded on the comment's own id, not session_id (T-078) — see
                PostHeader's identical trade-off note. */}
            <AgentAvatar seed={comment?.id || 'anon'} size={24} animated={true} />
          </div>

          <div className={styles.bubble}>
            <div className={styles.meta}>
              <span className={styles.name}>Anon</span>
              <time
                className={styles.time}
                dateTime={comment?.created_at}
                title={formatAbsoluteTime(comment?.created_at)}
              >
                {formatRelativeTime(comment?.created_at)}
              </time>
            </div>

            <div className={`${styles.text} ${isRemoved ? styles.removed : ''}`}>
              {isRemoved ? '[Comment removed]' : comment?.content}
            </div>

            <div className={styles.actions}>
              {/* Same control as the post's, at the small size. Comments used
                  to show two loose buttons with separate up and down counts,
                  which read as a different mechanic from the post above. */}
              <VoteControl
                size="sm"
                score={(comment?.upvotes ?? 0) - (comment?.downvotes ?? 0)}
                userVote={userVote}
                onVote={(type) => onVote?.(comment.id, type)}
                disabled={isRemoved}
                labelUp="Upvote comment"
                labelDown="Downvote comment"
              />

              {depth === 0 && !isRemoved && (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setShowReply((v) => !v)}
                  aria-expanded={showReply}
                >
                  <CornerDownRight size={14} aria-hidden="true" />
                  Reply
                </button>
              )}

              {isOwn && !isRemoved && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionDanger}`}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className={styles.confirm} role="alertdialog" aria-label="Confirm comment deletion">
            <span className={styles.confirmText}>Delete this comment?</span>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {depth === 0 && showReply && (
          <ReplyBox
            className={hasReplies ? styles.spineFromTop : ''}
            hasSpine={hasReplies}
            onSubmit={handlePostReply}
            onCancel={() => setShowReply(false)}
          />
        )}

        {depth === 0 &&
          replies.map((r, i) => (
            <CommentItem
              key={r.id}
              comment={r}
              sessionId={sessionId}
              isOwn={isOwnComment ? isOwnComment(r.id) : false}
              depth={1}
              isLast={i === replies.length - 1}
              onVote={onVote}
              onReply={onReply}
              onDelete={onDelete}
              getUserVote={getUserVote}
            />
          ))}
      </div>
    </div>
  )
}
