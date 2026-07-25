// Community chat panel - full screen overlay with messages and input
import { useEffect, useRef } from 'react'
import ChatBubble from '../ChatBubble/ChatBubble'
import ChatInput from '../ChatInput/ChatInput'
import Starfield from '../../../../components/effects/Starfield/Starfield'
import Loading from '../../../../components/ui/Loading'
import useChat from '../../../../hooks/useChat'
import styles from './ChatPanel.module.css'

export default function ChatPanel({ isOpen, onClose, sessionId }) {
  const { messages, sendMessage, isLoading } = useChat()
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
      {/* Starfield background */}
      <div className={styles.starfieldContainer}>
        <Starfield />
      </div>

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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  )
}
