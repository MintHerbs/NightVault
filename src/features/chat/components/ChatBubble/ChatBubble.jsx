// One message. Grouping is decided by ChatPanel and passed down as two flags,
// because a bubble cannot see its neighbours. Before T-087 every message
// rendered its own avatar and its own permanent timestamp, so five messages
// in a row from one person produced five of each.
import ChatAvatar from '../ChatAvatar/ChatAvatar'
import { formatClockTime } from '../../../../lib/social/relativeTime'
import styles from './ChatBubble.module.css'

export default function ChatBubble({ message, isOwnMessage, isGroupStart, isGroupEnd }) {
  const isMedia = !!message.attachment_url

  return (
    <div
      className={[
        styles.container,
        isOwnMessage ? styles.own : styles.other,
        isGroupStart ? styles.groupStart : '',
        isGroupEnd ? styles.groupEnd : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* The slot is always present so bubbles in a run stay aligned; only the
          last message of a run actually paints an avatar into it. */}
      <div className={styles.avatarSlot}>
        {isGroupEnd && <ChatAvatar sessionId={message.session_id} size={28} />}
      </div>

      <div className={styles.bubbleWrapper}>
        <div
          className={[
            styles.bubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
            isMedia ? styles.mediaBubble : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isMedia ? (
            <>
              <img
                className={styles.attachmentImg}
                src={message.attachment_url}
                alt={message.attachment_type === 'sticker' ? 'Sticker' : 'GIF'}
                loading="lazy"
              />
              {message.content && <span className={styles.mediaCaption}>{message.content}</span>}
            </>
          ) : (
            <span className={styles.text}>{message.content}</span>
          )}
        </div>

        {/* Revealed on hover or keyboard focus rather than printed under every
            bubble, but always in the DOM so assistive tech still reads it. */}
        <time className={styles.timestamp} dateTime={message.created_at}>
          {formatClockTime(message.created_at)}
        </time>
      </div>
    </div>
  )
}
