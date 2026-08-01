// The card's footer bar: vote, comments, and a flag state read-out. Flag
// itself moved into PostHeader's overflow menu — it was a rare, one-way
// action sitting at the same weight as voting, and it now only surfaces here
// as a status chip once the reader has actually flagged the post.
import { MessageSquare } from 'lucide-react'
import VoteControl from '../../ui/VoteControl/VoteControl'
import styles from './PostActions.module.css'

export default function PostActions({
  upvotes,
  downvotes,
  commentCount,
  userVote,
  isFlagged,
  onVote,
  onCommentToggle,
  isCommentOpen,
}) {
  const netScore = (upvotes ?? 0) - (downvotes ?? 0)
  const count = commentCount ?? 0

  return (
    <div className={styles.bar}>
      <VoteControl
        score={netScore}
        userVote={userVote}
        onVote={onVote}
        labelUp="Upvote post"
        labelDown="Downvote post"
      />

      <button
        type="button"
        className={`${styles.action} ${isCommentOpen ? styles.actionActive : ''}`}
        onClick={onCommentToggle}
        aria-expanded={isCommentOpen}
        aria-label={`${count} ${count === 1 ? 'comment' : 'comments'}`}
      >
        <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
        <span>{count}</span>
      </button>

      {isFlagged && (
        <span className={styles.flagged} title="You flagged this post for review">
          Flagged
        </span>
      )}
    </div>
  )
}
