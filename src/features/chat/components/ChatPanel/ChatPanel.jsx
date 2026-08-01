// Community chat panel - full screen overlay with messages and input
import { useEffect, useRef } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import ChatBubble from '../ChatBubble/ChatBubble'
import ChatInput from '../ChatInput/ChatInput'
import TypingIndicator from '../TypingIndicator/TypingIndicator'
import SeenIndicator from '../SeenIndicator/SeenIndicator'
import Starfield from '../../../../components/effects/Starfield/Starfield'
import Loading from '../../../../components/ui/Loading'
import useChat from '../../../../hooks/useChat'
import useTypingIndicator from '../../../../hooks/useTypingIndicator'
import useReadReceipts from '../../../../hooks/useReadReceipts'
import styles from './ChatPanel.module.css'

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

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
    <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
      {/* Starfield background */}
      <div className={styles.starfieldContainer}>
        <Starfield />
      </div>

      {/* The panel is an overlay, so dismissing it reveals the route already
          underneath, which is /social/feed on every path that reaches chat
          from the sidebar. No navigation needed, and a visitor who opened chat
          from the Dynamic Island elsewhere gets their own page back rather
          than being dropped into social. */}
      <button
        type="button"
        className={styles.backButton}
        onClick={onClose}
        aria-label="Back to feed"
        title="Back to feed"
      >
        <ArrowLeft size={20} weight="regular" />
      </button>

      {/* Messages Area */}
      <div className={styles.messagesArea}>
        {isLoading && messages.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Loading />
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            No messages yet. Say hi!
          </div>
        ) : (
          <div className={styles.messagesContent}>
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                isOwnMessage={message.session_id === sessionId}
              />
            ))}
            <SeenIndicator sessionIds={seenByIds} />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
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
