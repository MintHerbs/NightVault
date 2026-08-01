// Community chat panel: full-screen overlay with header, message list, input.
import { useEffect, useMemo, useRef } from 'react'
import ChatHeader from '../ChatHeader/ChatHeader'
import ChatBubble from '../ChatBubble/ChatBubble'
import ChatInput from '../ChatInput/ChatInput'
import DayDivider from '../DayDivider/DayDivider'
import TypingIndicator from '../TypingIndicator/TypingIndicator'
import SeenIndicator from '../SeenIndicator/SeenIndicator'
import Starfield from '../../../../components/effects/Starfield/Starfield'
import Loading from '../../../../components/ui/Loading'
import useChat from '../../../../hooks/useChat'
import useTypingIndicator from '../../../../hooks/useTypingIndicator'
import useReadReceipts from '../../../../hooks/useReadReceipts'
import { isDifferentDay } from '../../../../lib/social/relativeTime'
import styles from './ChatPanel.module.css'

/** Two messages further apart than this start a new run, even from one sender. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

function sameRun(a, b) {
  if (!a || !b) return false
  if (a.session_id !== b.session_id) return false
  if (isDifferentDay(a.created_at, b.created_at)) return false
  return Math.abs(new Date(b.created_at) - new Date(a.created_at)) <= GROUP_WINDOW_MS
}

export default function ChatPanel({ isOpen, onClose, sessionId }) {
  const { messages, sendMessage, sendAttachment, isLoading } = useChat()
  const { typingSessions, notifyTyping, notifyStopped } = useTypingIndicator(sessionId)
  const { seenAt, markRead } = useReadReceipts(sessionId)
  const messagesEndRef = useRef(null)

  const handleSend = (content) => {
    notifyStopped()
    sendMessage(content)
  }

  const handleSendMedia = (url, kind) => {
    notifyStopped()
    sendAttachment(url, kind)
  }

  // Grouping is computed once over the message list rather than inside each
  // bubble, which would need every bubble to know about its neighbours.
  const rows = useMemo(
    () =>
      messages.map((message, i) => {
        const prev = messages[i - 1]
        const next = messages[i + 1]
        return {
          message,
          showDayDivider: !prev || isDifferentDay(prev.created_at, message.created_at),
          isGroupStart: !sameRun(prev, message),
          isGroupEnd: !sameRun(message, next),
        }
      }),
    [messages]
  )

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Escape closes the panel, matching every other overlay in the app. Bound
  // only while open, so it cannot swallow Escape on the routes underneath.
  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Only counts as "read" while the panel is actually open — the hook stays
  // subscribed regardless, so peers keep seeing whatever was last marked.
  const lastMessage = messages[messages.length - 1]
  useEffect(() => {
    if (!isOpen || !lastMessage) return
    markRead(lastMessage.created_at)
  }, [isOpen, lastMessage, markRead])

  const seenByIds = lastMessage
    ? Object.entries(seenAt)
        .filter(([, at]) => at >= lastMessage.created_at)
        .map(([id]) => id)
    : []

  return (
    <div
      className={`${styles.panel} ${isOpen ? styles.open : ''}`}
      role="dialog"
      aria-label="Community chat"
      aria-hidden={!isOpen}
    >
      <div className={styles.starfieldContainer}>
        <Starfield />
      </div>

      {/* The panel is an overlay, so closing it reveals the route already
          underneath, which is /social/feed on every path that reaches chat
          from the sidebar, and a visitor who opened chat from the Dynamic
          Island elsewhere gets their own page back rather than being dropped
          into social. */}
      <ChatHeader onClose={onClose} />

      <div className={styles.messagesArea}>
        {isLoading && messages.length === 0 ? (
          <div className={styles.centered}>
            <Loading />
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.centered}>
            <p className={styles.emptyTitle}>No messages yet</p>
            <p className={styles.emptyBody}>Say hi. Everyone here is anonymous.</p>
          </div>
        ) : (
          <div className={styles.messagesContent}>
            {rows.map(({ message, showDayDivider, isGroupStart, isGroupEnd }) => (
              <div key={message.id}>
                {showDayDivider && <DayDivider iso={message.created_at} />}
                <ChatBubble
                  message={message}
                  isOwnMessage={message.session_id === sessionId}
                  isGroupStart={isGroupStart}
                  isGroupEnd={isGroupEnd}
                />
              </div>
            ))}
            <SeenIndicator sessionIds={seenByIds} />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <TypingIndicator sessionIds={typingSessions} />
        <ChatInput
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          onTyping={notifyTyping}
          onIdle={notifyStopped}
        />
      </div>
    </div>
  )
}
