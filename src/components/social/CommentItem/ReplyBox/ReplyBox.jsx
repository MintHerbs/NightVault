// The inline reply field under a top-level comment. Split out of CommentItem
// so that file stays about the thread structure and the recursion.
//
// `hasSpine` says whether a reply follows this box, which decides both the
// mobile indent (here) and the connector line drawn through it (painted by
// CommentItem via `className`, since the line's geometry lives in that
// module's custom properties).
import { useEffect, useRef, useState } from 'react'
import styles from './ReplyBox.module.css'

const MAX_CHARS = 500
const COUNTER_VISIBLE_FROM = 400

export default function ReplyBox({ className = '', hasSpine = false, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight || '20') || 20
    const maxHeight = Math.round(lineHeight * 6 + 20)
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const handlePost = async () => {
    const trimmed = value.trim()
    if (!trimmed || isPosting) return
    setIsPosting(true)
    const res = await onSubmit?.(trimmed)
    setIsPosting(false)
    if (res?.error) return
    setValue('')
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className={`${styles.box} ${hasSpine ? styles.boxSpine : ''} ${className}`}>
      <textarea
        ref={ref}
        className={styles.textarea}
        placeholder="Write a reply"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
        onKeyDown={handleKeyDown}
        maxLength={MAX_CHARS}
        rows={1}
        aria-label="Write a reply"
      />

      <div className={styles.actions}>
        {value.length >= COUNTER_VISIBLE_FROM && (
          <span className={styles.count}>
            {value.length}/{MAX_CHARS}
          </span>
        )}
        <button type="button" className={styles.btn} onClick={onCancel} disabled={isPosting}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handlePost}
          disabled={!value.trim() || isPosting}
        >
          {isPosting ? 'Posting' : 'Reply'}
        </button>
      </div>
    </div>
  )
}
