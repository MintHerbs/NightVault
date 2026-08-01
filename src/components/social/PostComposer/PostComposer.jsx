import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import ComposerAttachments from './ComposerAttachments/ComposerAttachments'
import ComposerBar from './ComposerBar/ComposerBar'
import useComposerAttachments from '../../../hooks/useComposerAttachments'
import styles from './PostComposer.module.css'

const MAX_CHARS = 1000
const MAX_TITLE_CHARS = 100
/** Below this the counter is noise, so it stays hidden (M3 supporting text). */
const COUNTER_VISIBLE_FROM = 800

export default function PostComposer({ onPost, sessionId }) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [isEngaged, setIsEngaged] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState(null)
  const [shake, setShake] = useState(false)

  const textareaRef = useRef(null)
  const shakeTimeoutRef = useRef(null)

  const clearError = useCallback(() => setError(null), [])
  const attachments = useComposerAttachments({ onOpen: clearError })

  const hasContent = content.trim().length > 0

  // Progressive disclosure: the composer is a single line until you engage
  // with it, then it grows the title field, the chips and the primary action.
  // It stays open while there is anything to lose. Publishing a one-line
  // thought used to cost a full modal round trip (the old mandatory
  // TitleModal, which allowed an empty title anyway).
  const isOpen = isEngaged || hasContent || attachments.hasAttachment || !!title

  const isTall = useMemo(
    () => !!content && (content.includes('\n') || content.length > 80),
    [content]
  )

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight || '20') || 20
    const maxHeight = Math.round(lineHeight * 8 + 20)
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [content])

  useEffect(() => () => window.clearTimeout(shakeTimeoutRef.current), [])

  const handlePost = async () => {
    if (isPosting) return
    if (!hasContent) {
      // Kept clickable rather than disabled so an empty click still explains
      // itself; a dead button just reads as broken.
      window.clearTimeout(shakeTimeoutRef.current)
      setShake(true)
      shakeTimeoutRef.current = window.setTimeout(() => setShake(false), 450)
      textareaRef.current?.focus()
      return
    }

    setError(null)
    setIsPosting(true)
    try {
      const res = await onPost?.({
        content: content.trim(),
        title: title.trim() || undefined,
        ...attachments.buildPayload(),
      })
      if (res?.error) {
        setError(res.error)
        return
      }
      setContent('')
      setTitle('')
      setIsEngaged(false)
      attachments.reset()
    } catch {
      setError('Failed to post')
    } finally {
      setIsPosting(false)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className={`${styles.composer} ${shake ? styles.shake : ''}`}>
      <div className={styles.row}>
        <div className={styles.avatar}>
          <AgentAvatar seed={sessionId || 'anon'} size={36} animated={true} />
        </div>

        <div className={styles.inputs}>
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                key="title"
                className={styles.titleWrap}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                <input
                  className={styles.title}
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_CHARS))}
                  onFocus={() => setIsEngaged(true)}
                  placeholder="Add a title (optional)"
                  maxLength={MAX_TITLE_CHARS}
                  aria-label="Post title, optional"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            className={`${styles.textarea} ${isTall ? styles.textareaTall : ''}`}
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => {
              setError(null)
              setContent(e.target.value)
            }}
            onFocus={() => setIsEngaged(true)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_CHARS}
            rows={1}
            aria-label="Post content"
          />

          <ComposerAttachments
            activeFeature={attachments.activeFeature}
            poll={attachments.poll}
            code={attachments.code}
            codeLanguage={attachments.codeLanguage}
            gif={attachments.gif}
            onPollChange={attachments.setPoll}
            onCodeChange={attachments.changeCode}
            onGifChange={attachments.setGif}
            onClearFeature={attachments.clearFeature}
          />

          <AnimatePresence>
            {error && (
              <motion.div
                className={styles.error}
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <AlertCircle size={14} aria-hidden="true" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {isOpen && (
              <ComposerBar
                key="bar"
                features={attachments.features}
                charCount={content.length}
                maxChars={MAX_CHARS}
                showCounter={content.length >= COUNTER_VISIBLE_FROM}
                warnCount={content.length >= 900}
                hasContent={hasContent}
                isPosting={isPosting}
                onPost={handlePost}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
