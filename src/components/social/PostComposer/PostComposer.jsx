import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, CheckCircle2, Code2, AlertCircle, ImagePlay, Loader2, Send, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import PollBuilder from './PollBuilder/PollBuilder'
import CodeAttachment from './CodeAttachment/CodeAttachment'
import TitleModal from './TitleModal/TitleModal'
import MediaPicker from '../../ui/MediaPicker/MediaPicker'
import { detectCodeLanguage, normalizeLanguage } from '../../../lib/social/codeHighlighter'
import styles from './PostComposer.module.css'

const MAX_CHARS = 1000
/** Below this the counter is noise, so it stays hidden (M3 supporting text). */
const COUNTER_VISIBLE_FROM = 800

export default function PostComposer({ onPost, sessionId }) {
  const [content, setContent] = useState('')
  const [code, setCode] = useState(null)
  const [codeLanguage, setCodeLanguage] = useState('auto')
  const [poll, setPoll] = useState(null)
  const [gif, setGif] = useState(null)
  const [activeFeature, setActiveFeature] = useState(null)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState(null)
  const [shake, setShake] = useState(false)

  const textareaRef = useRef(null)
  const shakeTimeoutRef = useRef(null)

  const charCount = content.length
  const showCounter = charCount >= COUNTER_VISIBLE_FROM
  const warnCount = charCount >= 900
  const hasContent = content.trim().length > 0

  const isExpanded = useMemo(() => {
    if (!content) return false
    if (content.includes('\n')) return true
    return content.length > 80
  }, [content])

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const computed = window.getComputedStyle(el)
    const lineHeight = Number.parseFloat(computed.lineHeight || '20') || 20
    const maxHeight = Math.round(lineHeight * 6 + 20)
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useEffect(() => {
    resizeTextarea()
  }, [content])

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current)
    }
  }, [])

  const handleContentChange = (e) => {
    setError(null)
    setContent(e.target.value)
  }

  const handleToggleVote = () => {
    setError(null)
    if (activeFeature === 'poll' && poll?.type === 'binary') {
      setActiveFeature(null)
      setPoll(null)
      return
    }
    setActiveFeature('poll')
    setPoll({ type: 'binary', options: ['Yes', 'No'] })
  }

  const handleTogglePoll = () => {
    setError(null)
    if (activeFeature === 'poll' && poll?.type !== 'binary') {
      setActiveFeature(null)
      setPoll(null)
      return
    }
    setActiveFeature('poll')
    setPoll({ type: 'poll', options: ['', ''] })
  }

  const handleToggleCode = () => {
    setError(null)
    if (activeFeature === 'code') {
      setActiveFeature(null)
      return
    }
    setActiveFeature('code')
    if (code == null) setCode('')
  }

  const handleToggleGif = () => {
    setError(null)
    setActiveFeature((prev) => (prev === 'gif' ? null : 'gif'))
  }

  const resetState = () => {
    setContent('')
    setCode(null)
    setCodeLanguage('auto')
    setPoll(null)
    setGif(null)
    setActiveFeature(null)
    setShowTitleModal(false)
    setError(null)
  }

  const doPost = async ({ title } = {}) => {
    if (isPosting) return
    setError(null)

    const cleanContent = content.trim()

    if (!cleanContent) {
      setError('Post content is required')
      return
    }
    const cleanTitle = String(title || '').trim()

    const normalizedCodeLanguage = normalizeLanguage(codeLanguage)
    const resolvedCodeLanguage = code
      ? normalizedCodeLanguage === 'auto'
        ? detectCodeLanguage(code)
        : normalizedCodeLanguage
      : undefined

    const postData = {
      content: cleanContent,
      title: cleanTitle ? cleanTitle : undefined,
      code: code ? String(code) : undefined,
      codeLanguage: resolvedCodeLanguage,
      poll: poll || undefined,
      gifUrl: gif?.fullUrl || undefined,
    }

    setIsPosting(true)
    try {
      const res = await onPost?.(postData)
      if (res?.error) {
        setError(res.error)
        return
      }
      resetState()
      textareaRef.current?.focus()
    } catch (e) {
      setError('Failed to post')
    } finally {
      setIsPosting(false)
    }
  }

  const triggerShake = () => {
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current)
    setShake(true)
    shakeTimeoutRef.current = window.setTimeout(() => setShake(false), 450)
  }

  const handlePostClick = () => {
    if (isPosting) return
    if (!hasContent) {
      // Kept clickable rather than disabled so an empty click still explains
      // itself; a dead button just reads as broken.
      triggerShake()
      return
    }
    setShowTitleModal(true)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePostClick()
    }
  }

  const features = [
    {
      key: 'vote',
      icon: CheckCircle2,
      label: 'Vote',
      hint: 'Attach a yes / no vote',
      active: activeFeature === 'poll' && poll?.type === 'binary',
      onClick: handleToggleVote,
    },
    {
      key: 'poll',
      icon: BarChart3,
      label: 'Poll',
      hint: 'Attach a multi-option poll',
      active: activeFeature === 'poll' && poll?.type !== 'binary',
      onClick: handleTogglePoll,
    },
    {
      key: 'code',
      icon: Code2,
      label: 'Code',
      hint: 'Attach a code snippet',
      active: activeFeature === 'code',
      onClick: handleToggleCode,
    },
    {
      key: 'gif',
      icon: ImagePlay,
      label: 'GIF',
      hint: 'Attach a GIF or sticker',
      active: activeFeature === 'gif' || !!gif,
      onClick: handleToggleGif,
    },
  ]

  return (
    <div className={`${styles.composer} ${shake ? styles.shake : ''}`}>
      <div className={styles.row}>
        <div className={styles.avatar}>
          <AgentAvatar seed={sessionId || 'anon'} size={32} animated={true} />
        </div>

        <div className={styles.inputs}>
          <textarea
            ref={textareaRef}
            className={`${styles.textarea} ${isExpanded ? styles.textareaExpanded : ''}`}
            placeholder="What's on your mind?"
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            maxLength={MAX_CHARS}
            rows={1}
          />

          <AnimatePresence mode="wait">
            {activeFeature === 'poll' && (
              <motion.div
                key="poll"
                className={styles.panel}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PollBuilder poll={poll} onChange={setPoll} />
              </motion.div>
            )}

            {activeFeature === 'code' && (
              <motion.div
                key="code"
                className={styles.panel}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CodeAttachment
                  code={code || ''}
                  language={codeLanguage}
                  onChange={(nextCode, lang) => {
                    setCode(nextCode)
                    setCodeLanguage(lang)
                  }}
                  onRemove={() => {
                    setCode(null)
                    setCodeLanguage('auto')
                    setActiveFeature(null)
                  }}
                />
              </motion.div>
            )}

            {activeFeature === 'gif' && (
              <motion.div
                key="gif"
                className={styles.panel}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MediaPicker
                  onSelect={(item) => setGif({ previewUrl: item.previewUrl, fullUrl: item.fullUrl })}
                  onClose={() => setActiveFeature(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {gif && (
            <div className={styles.gifPreview}>
              <img className={styles.gifPreviewImg} src={gif.previewUrl} alt="Selected GIF" />
              <button
                type="button"
                className={styles.gifRemove}
                onClick={() => setGif(null)}
                aria-label="Remove GIF"
                title="Remove GIF"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                className={styles.error}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                role="alert"
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* One action bar: attachment toggles on the left, the primary action
              on the right. The toggles are M3 toggle chips — outlined when off,
              tonal-filled when on — so their state is legible without relying
              on a text-shadow glow. */}
          <div className={styles.bar}>
            <div className={styles.features}>
              {features.map(({ key, icon: Icon, label, hint, active, onClick }) => (
                <motion.button
                  key={key}
                  type="button"
                  className={`${styles.featureBtn} ${active ? styles.featureBtnActive : ''}`}
                  onClick={onClick}
                  title={hint}
                  aria-label={hint}
                  aria-pressed={active}
                  whileTap={{ scale: 0.96 }}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span className={styles.featureLabel}>{label}</span>
                </motion.button>
              ))}
            </div>

            <div className={styles.barRight}>
              {showCounter && (
                <span className={`${styles.charCount} ${warnCount ? styles.charCountWarn : ''}`}>
                  {charCount}/{MAX_CHARS}
                </span>
              )}

              <RippleButton
                type="button"
                className={`${styles.postBtn} ${hasContent ? '' : styles.postBtnIdle}`}
                onClick={handlePostClick}
                disabled={isPosting}
                aria-label="Post"
                hoverScale={1.02}
                tapScale={0.98}
              >
                {isPosting ? (
                  <Loader2 size={16} className={styles.spinner} strokeWidth={2.5} />
                ) : (
                  <Send size={16} strokeWidth={2.5} />
                )}
                <span>{isPosting ? 'Posting' : 'Post'}</span>
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
              </RippleButton>
            </div>
          </div>
        </div>
      </div>

      <TitleModal
        open={showTitleModal}
        onClose={() => setShowTitleModal(false)}
        onSubmit={(nextTitle) => doPost({ title: nextTitle })}
      />
    </div>
  )
}
