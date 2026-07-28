// Single chat message with avatar and bubble
import ChatAvatar from '../ChatAvatar/ChatAvatar'
import styles from './ChatBubble.module.css'

export default function ChatBubble({ message, isOwnMessage }) {
  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`${styles.container} ${isOwnMessage ? styles.own : styles.other}`}>
      <ChatAvatar sessionId={message.session_id} size={32} />
      
      <div className={styles.bubbleWrapper}>
        <div
          className={`${styles.bubble} ${isOwnMessage ? styles.ownBubble : styles.otherBubble} ${
            message.attachment_url ? styles.mediaBubble : ''
          }`}
        >
          {message.attachment_url ? (
            <img
              className={styles.attachmentImg}
              src={message.attachment_url}
              alt={message.attachment_type === 'sticker' ? 'Sticker' : 'GIF'}
              loading="lazy"
            />
          ) : (
            message.content
          )}
        </div>
        <div className={styles.timestamp}>{timestamp}</div>
      </div>
    </div>
  )
}
