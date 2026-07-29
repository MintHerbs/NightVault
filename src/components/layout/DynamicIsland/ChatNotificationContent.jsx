import { ChatCircleDots } from '@phosphor-icons/react'
import styles from './DynamicIsland.module.css'

// The room is a single global anonymous channel and `messages` has no
// display-name column, so the pill leads with the event rather than a sender
// (T-079, open decision 1).
function primaryLabel(count) {
  return count === 1 ? 'New message' : `${count} new messages`
}

// An attachment-only message stores content as '' (the column is NOT NULL),
// so a snippet needs a stand-in.
function snippet(message) {
  if (message?.content?.trim()) return message.content.trim()
  if (message?.attachment_type === 'gif') return 'Sent a GIF'
  if (message?.attachment_type === 'sticker') return 'Sent a sticker'
  return 'Sent an attachment'
}

export default function ChatNotificationContent({ count, message }) {
  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatIcon}>
        <ChatCircleDots size={18} weight="fill" />
      </div>
      <div className={styles.chatText}>
        <div className={styles.chatTitle}>{primaryLabel(count)}</div>
        <div className={styles.chatSnippet}>{snippet(message)}</div>
      </div>
    </div>
  )
}
