// The "add a comment" box. Split out of CommentSection so that file can be
// about the thread (header, sort, collapse) rather than about a form.
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AgentAvatar from '../../../effects/smoothui/agent-avatar'
import styles from './CommentComposer.module.css'

const MAX_CHARS = 500
const COUNTER_VISIBLE_FROM = 400

export default function CommentComposer({ sessionId, onSubmit }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [isPosting, setIsPosting] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight || '20') || 20
    const maxHeight = Math.round(lineHeight * 6 + 20)
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value])

  const trimmed = value.trim()
  // The action row only appears once the field is in use, so a closed thread
  // is not two buttons taller than it needs to be.
  const showActions = isFocused || value.length > 0

  const handlePost = async () => {
    if (!trimmed || isPosting) return
    setError(null)
    setIsPosting(true)
    const res = await onSubmit?.(trimmed)
    setIsPosting(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setValue('')
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className={styles.composer}>
      <div className={styles.avatar}>
        <AgentAvatar seed={sessionId || 'anon'} size={28} animated={true} />
      </div>

      <div className={styles.body}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Add a thoughtful reply"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={MAX_CHARS}
          rows={1}
          aria-label="Add a comment"
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {showActions && (
          <div className={styles.actions}>
            {value.length >= COUNTER_VISIBLE_FROM && (
              <span className={styles.count}>
                {value.length}/{MAX_CHARS}
              </span>
            )}
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                setValue('')
                setError(null)
              }}
              disabled={isPosting || !value}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handlePost}
              disabled={!trimmed || isPosting}
            >
              {isPosting && <Loader2 size={14} className={styles.spinner} aria-hidden="true" />}
              {isPosting ? 'Posting' : 'Comment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
