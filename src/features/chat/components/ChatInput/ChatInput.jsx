// Chat input: auto-growing pill field with an always-present send action
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Smile, X } from 'lucide-react'
import MediaPicker from '../../../../components/ui/MediaPicker/MediaPicker'
import styles from './ChatInput.module.css'

const MAX_WORDS = 500
const RATE_LIMIT_MESSAGES = 3
const RATE_LIMIT_WINDOW_MS = 5000 // 5 seconds
const LINE_HEIGHT = 22
const MAX_LINES = 8
const HINT_MS = 2200
const DRAWER_TABS = [
  { key: 'emoji', label: 'Emoji' },
  { key: 'gifs', label: 'GIFs' },
  { key: 'stickers', label: 'Stickers' },
]
/** MediaPicker's plural tab keys (KLIPY's own vocabulary) to the singular
    values messages.attachment_type and send_message actually accept. */
const ATTACHMENT_KIND = { gifs: 'gif', stickers: 'sticker' }

export default function ChatInput({ onSend, onSendMedia, onTyping, onIdle, disabled = false }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  // A picked GIF/sticker waits here until Send is pressed, rather than going
  // out the moment it's tapped — lets the sender add a caption or back out.
  const [pendingAttachment, setPendingAttachment] = useState(null)
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
    if ((!content && !pendingAttachment) || disabled) return

    // Previously this returned silently, so a rate-limited message just
    // vanished with no explanation and the input looked broken.
    if (isRateLimited()) {
      showHint('Slow down a moment before sending again')
      return
    }

    messageTimes.current.push(Date.now())
    if (pendingAttachment) {
      onSendMedia?.(pendingAttachment.url, pendingAttachment.kind, content)
    } else {
      onSend(content)
    }
    setValue('')
    setPendingAttachment(null)
    setHint(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDrawerSelect = (item, kind) => {
    // Emoji inserts into the field and leaves the drawer open for picking
    // more than one; GIFs/stickers are staged as a pending attachment so the
    // sender can add a caption (or change their mind) before it goes out.
    if (kind === 'emoji') {
      setValue((prev) => prev + item.char)
      textareaRef.current?.focus()
      return
    }

    if (disabled) return

    // MediaPicker's `kind` is 'gifs' / 'stickers' — plural, because that is
    // what the KLIPY search API (and its edge function) expects. The
    // messages table's attachment_type and the send_message RPC both check
    // against singular 'gif' / 'sticker', so every send failed that check
    // and got swallowed as a console-only error with no UI feedback.
    setPendingAttachment({
      url: item.fullUrl,
      kind: ATTACHMENT_KIND[kind] ?? kind,
      previewUrl: item.previewUrl,
      title: item.title,
    })
    setIsDrawerOpen(false)
    textareaRef.current?.focus()
  }

  const clearPendingAttachment = () => setPendingAttachment(null)

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

  const canSend = (value.trim().length > 0 || !!pendingAttachment) && !disabled

  return (
    <div className={styles.wrapper}>
      {isDrawerOpen && (
        <div className={styles.drawerWrapper}>
          <MediaPicker
            tabs={DRAWER_TABS}
            onSelect={handleDrawerSelect}
            onClose={() => setIsDrawerOpen(false)}
          />
        </div>
      )}

      {pendingAttachment && (
        <div className={styles.pendingAttachment}>
          <img
            className={styles.pendingAttachmentImg}
            src={pendingAttachment.previewUrl}
            alt={pendingAttachment.title || (pendingAttachment.kind === 'sticker' ? 'Sticker' : 'GIF')}
          />
          <button
            type="button"
            className={styles.pendingAttachmentRemove}
            onClick={clearPendingAttachment}
            aria-label="Remove attachment"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className={styles.container}>
        <button
          type="button"
          className={`${styles.drawerButton} ${isDrawerOpen ? styles.drawerButtonActive : ''}`}
          onClick={() => setIsDrawerOpen((v) => !v)}
          disabled={disabled}
          aria-label="Open emoji, GIF and sticker drawer"
          aria-expanded={isDrawerOpen}
        >
          <Smile size={18} aria-hidden="true" />
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={pendingAttachment ? 'Add a caption (optional)...' : 'Type a message...'}
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
