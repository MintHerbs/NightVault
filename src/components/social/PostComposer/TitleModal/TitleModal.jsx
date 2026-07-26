import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Type, Sparkles, X } from 'lucide-react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import styles from './TitleModal.module.css'

export default function TitleModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const submitWithTitle = () => {
    const cleanTitle = title.trim()
    onSubmit?.(cleanTitle ? cleanTitle : null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submitWithTitle()
  }

  const charCount = title.length
  const maxChars = 100

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.overlay} onClick={() => onClose?.()}>
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div 
            className={styles.card} 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              type: 'spring',
              stiffness: 400,
              damping: 30
            }}
          >
            <motion.button
              className={styles.closeBtn}
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <X size={18} />
            </motion.button>

            <motion.div 
              className={styles.iconWrapper}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 500,
                damping: 25,
                delay: 0.1
              }}
            >
              <Type size={24} />
              <motion.div
                className={styles.sparkle}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <Sparkles size={14} />
              </motion.div>
            </motion.div>

            <div className={styles.heading}>Add a title to your post</div>
            <div className={styles.subtext}>
              Optional — A good title helps others understand your post at a glance
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.inputWrapper}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Need help with recursion..."
                  maxLength={maxChars}
                />
                <motion.div 
                  className={`${styles.charCount} ${charCount > 80 ? styles.charCountWarn : ''}`}
                  animate={{ 
                    scale: charCount > 80 ? [1, 1.1, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {charCount}/{maxChars}
                </motion.div>
              </div>

              <div className={styles.actions}>
                <RippleButton 
                  className={styles.ghostBtn} 
                  type="button" 
                  onClick={() => onSubmit?.(null)}
                  hoverScale={1.02}
                  tapScale={0.98}
                >
                  Skip & post
                  <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.2)" />
                </RippleButton>
                <RippleButton 
                  className={styles.primaryBtn} 
                  type="submit"
                  hoverScale={1.02}
                  tapScale={0.98}
                >
                  {title.trim() ? 'Post with title' : 'Post without title'}
                  <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
                </RippleButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
