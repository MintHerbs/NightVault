import { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown, MessageCircle } from 'lucide-react'
import { motion } from 'motion/react'
import FlagConfirmDialog from '../FlagConfirmDialog/FlagConfirmDialog'
import styles from './PostActions.module.css'

export default function PostActions({
  postId,
  upvotes,
  downvotes,
  commentCount,
  userVote,
  hasFlagged,
  onVote,
  onFlag,
  onCommentToggle,
  isCommentOpen,
}) {
  const [localFlagged, setLocalFlagged] = useState(!!hasFlagged)
  const [showFlagDialog, setShowFlagDialog] = useState(false)
  const safeUpvotes = upvotes ?? 0
  const safeDownvotes = downvotes ?? 0
  const safeCommentCount = commentCount ?? 0
  const isFlagged = localFlagged || !!hasFlagged

  // Calculate net score (upvotes - downvotes)
  const netScore = safeUpvotes - safeDownvotes

  useEffect(() => {
    setLocalFlagged(!!hasFlagged)
  }, [hasFlagged])

  const handleFlagClick = () => {
    setShowFlagDialog(true)
  }

  const handleFlagConfirm = async () => {
    const newFlagState = !isFlagged
    setLocalFlagged(newFlagState)
    const res = await onFlag?.(postId)
    if (res?.error) setLocalFlagged(!!hasFlagged)
  }

  return (
    <>
      <div className={styles.actions}>
        {/* Vote pill with up/down arrows and net score */}
        <div className={styles.votePill}>
          <motion.button
            type="button"
            className={`${styles.voteBtn} ${userVote === 'up' ? styles.upActive : ''}`}
            onClick={() => onVote('up')}
            aria-label="Upvote"
            whileHover={{ scale: 1.15, y: -2 }}
            whileTap={{ scale: 0.9 }}
            animate={{ 
              color: userVote === 'up' ? '#22c55e' : 'rgba(var(--color-fg-rgb), 0.6)',
              y: userVote === 'up' ? -2 : 0
            }}
            transition={{ duration: 0.2 }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </motion.button>
          
          <div className={styles.voteDivider} />
          
          <motion.span 
            className={styles.voteCount}
            key={netScore}
            initial={{ scale: 1.2, color: netScore > 0 ? '#22c55e' : netScore < 0 ? '#ef4444' : 'rgba(var(--color-fg-rgb), 0.8)' }}
            animate={{ scale: 1, color: 'rgba(var(--color-fg-rgb), 0.8)' }}
            transition={{ duration: 0.3 }}
          >
            {netScore}
          </motion.span>
          
          <div className={styles.voteDivider} />
          
          <motion.button
            type="button"
            className={`${styles.voteBtn} ${userVote === 'down' ? styles.downActive : ''}`}
            onClick={() => onVote('down')}
            aria-label="Downvote"
            whileHover={{ scale: 1.15, y: 2 }}
            whileTap={{ scale: 0.9 }}
            animate={{ 
              color: userVote === 'down' ? '#ef4444' : 'rgba(var(--color-fg-rgb), 0.6)',
              y: userVote === 'down' ? 2 : 0
            }}
            transition={{ duration: 0.2 }}
          >
            <ArrowDown size={16} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* Comments pill */}
        <motion.button 
          type="button" 
          className={`${styles.commentPill} ${isCommentOpen ? styles.commentPillActive : ''}`}
          onClick={onCommentToggle}
          aria-label={`${safeCommentCount} comments`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageCircle size={16} strokeWidth={2} />
          <motion.span
            key={safeCommentCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {safeCommentCount}
          </motion.span>
        </motion.button>

        {/* Flag pill with hexagon icon */}
        <motion.button
          type="button"
          className={`${styles.flagPill} ${isFlagged ? styles.flagged : ''}`}
          onClick={handleFlagClick}
          aria-label={isFlagged ? 'Unflag post' : 'Flag post'}
          title={isFlagged ? 'Click to unflag this post' : 'Flag as inappropriate'}
          whileHover={{ scale: 1.1, rotate: isFlagged ? 0 : 15 }}
          whileTap={{ scale: 0.9 }}
          animate={{ 
            rotate: isFlagged ? [0, -10, 10, -10, 0] : 0,
            color: isFlagged ? '#ef4444' : 'rgba(var(--color-fg-rgb), 0.5)'
          }}
          transition={{ duration: 0.3 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1L14.06 4.5V11.5L8 15L1.94 11.5V4.5L8 1Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill={isFlagged ? 'currentColor' : 'none'}
            />
          </svg>
        </motion.button>
      </div>

      <FlagConfirmDialog
        open={showFlagDialog}
        onClose={() => setShowFlagDialog(false)}
        onConfirm={handleFlagConfirm}
        isFlagged={isFlagged}
      />
    </>
  )
}
