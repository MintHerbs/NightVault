// Chat input: auto-growing pill field with an always-present send action
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import styles from './ChatInput.module.css'

const MAX_WORDS = 500
const RATE_LIMIT_MESSAGES = 3
const RATE_LIMIT_WINDOW_MS = 5000 // 5 seconds
const LINE_HEIGHT = 22
const MAX_LINES = 8
const HINT_MS = 2200

export default function ChatInput({ onSend, onTyping, onIdle, disabled = false }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(null)
  const textareaRef = useRef(null)
  const messageTimes = useRef([]) // Track message timestamps for rate limiting
  const hintTimer = useRef(null)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  const showHint = useCallback((message) => {
    setHint(message)
    if (hintTimer.current) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(hintTimer.current), [])

  // Tell peers we stopped if the component goes away mid-compose.
  useEffect(() => () => onIdleRef.current?.(), [])

  // Single source of truth for the height. It used to be duplicated between an
  // effect and the change handler, with a CSS `transition: height` fighting
  // both, which is what made the field jitter while typing.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_LINES
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value])

  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length

  const isRateLimited = () => {
    const now = Date.now()
    messageTimes.current = messageTimes.current.filter((time) => now - time < RATE_LIMIT_WINDOW_MS)
    return messageTimes.current.length >= RATE_LIMIT_MESSAGES
  }

  const handleSend = () => {
    const content = value.trim()
    if (!content || disabled) return

    // Previously this returned silently, so a rate-limited message just
    // vanished with no explanation and the input looked broken.
    if (isRateLimited()) {
      showHint('Slow down a moment before sending again')
      return
    }

    messageTimes.current.push(Date.now())
    onSend(content)
    setValue('')
    setHint(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    const newValue = e.target.value
    if (countWords(newValue) > MAX_WORDS) {
      // Still refuses the keystroke, but now says why rather than appearing
      // to have frozen.
      showHint(`Messages are capped at ${MAX_WORDS} words`)
      return
    }
    if (hint) setHint(null)
    setValue(newValue)
    // The hook throttles these, so firing per keystroke costs one broadcast
    // every couple of seconds rather than one per character.
    if (newValue.trim()) onTyping?.()
    else onIdle?.()
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          enterKeyHint="send"
          aria-label="Message"
        />

        {/* Always rendered. The old version mounted it only once you had typed,
            leaving a permanently empty 32px strip under the field and popping
            a control into existence mid-keystroke. */}
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          type="button"
        >
          <Send size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {hint && (
        <div className={styles.hint} role="status">
          {hint}
        </div>
      )}
    </div>
  )
}
