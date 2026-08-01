// Title + body text, with the read-more affordance and the two inline
// destructive/edit states the card can enter.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import styles from './PostBody.module.css'

const MAX_EDIT_CHARS = 1000

export default function PostBody({
  title,
  content,
  isEditing,
  editValue,
  onEditChange,
  onEditCancel,
  onEditSave,
  isConfirmingDelete,
  onDeleteCancel,
  onDeleteConfirm,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef(null)

  // The old check counted newlines and sliced the string at four, so a single
  // long paragraph that wrapped to fifteen visual lines was never truncated
  // while a four-line haiku always was. Measuring the clamped box catches both.
  useLayoutEffect(() => {
    if (isExpanded || isEditing) return undefined
    const el = textRef.current
    if (!el) return undefined

    const measure = () => setIsOverflowing(el.scrollHeight - el.clientHeight > 4)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [content, isExpanded, isEditing])

  useEffect(() => {
    if (isEditing) setIsExpanded(true)
  }, [isEditing])

  const showToggle = !isEditing && (isOverflowing || isExpanded)

  return (
    <div className={styles.body}>
      {title && <h3 className={styles.title}>{title}</h3>}

      {!isEditing && (
        <>
          <div
            ref={textRef}
            className={[
              styles.text,
              isExpanded ? styles.textExpanded : '',
              !isExpanded && isOverflowing ? styles.textFading : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {content}
          </div>

          {showToggle && (
            <button
              type="button"
              className={styles.toggle}
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp size={14} aria-hidden="true" />
                </>
              ) : (
                <>
                  Read more <ChevronDown size={14} aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </>
      )}

      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <textarea
              className={styles.textarea}
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              maxLength={MAX_EDIT_CHARS}
              rows={5}
              aria-label="Edit post"
            />
            <div className={styles.panelActions}>
              <button type="button" className={styles.btn} onClick={onEditCancel}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={onEditSave}
                disabled={!editValue.trim()}
              >
                Save
              </button>
            </div>
          </motion.div>
        )}

        {isConfirmingDelete && (
          <motion.div
            className={`${styles.panel} ${styles.danger}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            role="alertdialog"
            aria-label="Confirm post deletion"
          >
            <p className={styles.dangerText}>Delete this post? This cannot be undone.</p>
            <div className={styles.panelActions}>
              <button type="button" className={styles.btn} onClick={onDeleteCancel}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={onDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
