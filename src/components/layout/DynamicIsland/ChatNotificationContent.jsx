import { ChatCircleDots, Notepad } from '@phosphor-icons/react'
import styles from './DynamicIsland.module.css'

// The room is a single global anonymous channel and neither `messages` nor
// `posts` has a display-name column, so the pill leads with the event rather
// than a sender (T-079, open decision 1).
function primaryLabel(count, kind) {
  if (kind === 'post') {
    return count === 1 ? 'New post' : `${count} new posts`
  }
  if (kind === 'mixed') {
    return `${count} new updates`
  }
  return count === 1 ? 'New message' : `${count} new messages`
}

// An attachment-only message stores content as '' (the column is NOT NULL),
// so a snippet needs a stand-in. A post leads with its title when it has one,
// since that is what the card shows first.
function snippet(message) {
  if (message?.kind === 'post') {
    return message.title?.trim() || message.content?.trim() || 'Tap to read'
  }
  if (message?.content?.trim()) return message.content.trim()
  if (message?.attachment_type === 'gif') return 'Sent a GIF'
  if (message?.attachment_type === 'sticker') return 'Sent a sticker'
  return 'Sent an attachment'
}

export default function ChatNotificationContent({ count, message, kind = 'chat' }) {
  // 'mixed' follows the newest arrival, so the icon matches the snippet
  // underneath it rather than the burst as a whole.
  const showPostIcon = kind === 'post' || (kind === 'mixed' && message?.kind === 'post')

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatIcon}>
        {showPostIcon
          ? <Notepad size={18} weight="fill" />
          : <ChatCircleDots size={18} weight="fill" />}
      </div>
      <div className={styles.chatText}>
        <div className={styles.chatTitle}>{primaryLabel(count, kind)}</div>
        <div className={styles.chatSnippet}>{snippet(message)}</div>
      </div>
    </div>
  )
}
