import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, CheckCircle2, Code2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import AgentAvatar from '../../effects/smoothui/agent-avatar'
import PollBuilder from './PollBuilder/PollBuilder'
import CodeAttachment from './CodeAttachment/CodeAttachment'
import TitleModal from './TitleModal/TitleModal'
import { detectCodeLanguage, normalizeLanguage } from '../../../lib/social/codeHighlighter'
import styles from './PostComposer.module.css'

export default function PostComposer({ onPost, sessionId }) {
  const [content, setContent] = useState('')
  const [code, setCode] = useState(null)
  const [codeLanguage, setCodeLanguage] = useState('auto')
  const [poll, setPoll] = useState(null)
  const [activeFeature, setActiveFeature] = useState(null)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState(null)
  const [shake, setShake] = useState(false)

  const textareaRef = useRef(null)
  const shakeTimeoutRef = useRef(null)

  const charCount = content.length
  const warnCount = charCount >= 900

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

  const resetState = () => {
    setContent('')
    setCode(null)
    setCodeLanguage('auto')
    setPoll(null)
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
    if (!content.trim()) {
      triggerShake()
      return
    }
    setShowTitleModal(true)
  }

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
            maxLength={1000}
            rows={1}
          />

          <div className={styles.bar}>
            <div className={styles.features}>
              <motion.button
                type="button"
                className={`${styles.featureBtn} ${activeFeature === 'poll' && poll?.type === 'binary' ? styles.featureBtnActive : ''}`}
                onClick={handleToggleVote}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <CheckCircle2 size={16} /> Vote
              </motion.button>

              <motion.button
                type="button"
                className={`${styles.featureBtn} ${activeFeature === 'poll' && poll?.type !== 'binary' ? styles.featureBtnActive : ''}`}
                onClick={handleTogglePoll}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <BarChart3 size={16} /> Poll
              </motion.button>

              <motion.button
                type="button"
                className={`${styles.featureBtn} ${activeFeature === 'code' ? styles.featureBtnActive : ''}`}
                onClick={handleToggleCode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Code2 size={16} /> Code
              </motion.button>
            </div>

            <motion.div 
              className={`${styles.charCount} ${warnCount ? styles.charCountWarn : ''}`}
              animate={{ 
                scale: warnCount ? [1, 1.1, 1] : 1,
                color: warnCount ? '#ff6464' : 'rgba(var(--color-fg-rgb), 0.35)'
              }}
              transition={{ duration: 0.3 }}
            >
              {charCount}/1000
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {activeFeature === 'poll' && (
              <motion.div 
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
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div 
                className={styles.error}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.footer}>
            <RippleButton 
              type="button" 
              className={styles.postBtn} 
              onClick={handlePostClick} 
              disabled={isPosting}
              hoverScale={1.02}
              tapScale={0.98}
            >
              {isPosting ? 'Posting…' : 'Post'}
              <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
            </RippleButton>
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
