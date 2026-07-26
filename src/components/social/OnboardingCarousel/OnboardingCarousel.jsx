import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Code2, MessageSquareText, ShieldCheck, Vote, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import styles from './OnboardingCarousel.module.css'

const slides = [
  {
    eyebrow: 'Global Feed',
    title: 'Speak freely. Stay anonymous.',
    body: 'Share what you think, ask for help, or say what is hard about studying right now. Your name never appears here.',
    icon: MessageSquareText,
  },
  {
    eyebrow: 'Study Tools',
    title: 'Questions can carry context.',
    body: 'Use polls when you need a quick read from classmates, or attach code when the answer depends on the exact snippet.',
    icon: Code2,
    secondaryIcon: Vote,
  },
  {
    eyebrow: 'Safety',
    title: 'The hexagon keeps the room clean.',
    body: 'Tap the hexagon to flag posts that cross the line. It changes color immediately so you know your report was counted.',
    icon: ShieldCheck,
  },
]

export default function OnboardingCarousel({ onComplete }) {
  const [slide, setSlide] = useState(0)
  const touchStartRef = useRef(null)

  const current = slides[slide]
  const Icon = current.icon
  const SecondaryIcon = current.secondaryIcon

  const goTo = (idx) => setSlide(Math.max(0, Math.min(slides.length - 1, idx)))
  const goNext = () => setSlide((s) => Math.min(slides.length - 1, s + 1))
  const goBack = () => setSlide((s) => Math.max(0, s - 1))

  const isLast = slide === slides.length - 1
  const isFirst = slide === 0

  const preview = useMemo(() => {
    if (slide === 1) {
      return (
        <motion.div 
          className={styles.preview}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>Poll Example</span>
          </div>
          <div className={styles.previewQuestion}>Which topic should we review next?</div>
          <motion.div 
            className={styles.pollLine}
            initial={{ width: 0 }}
            animate={{ width: '68%' }}
            transition={{ duration: 0.6, delay: 0.4 }}
          />
          <div className={styles.pollOption}>Recursion - 68%</div>
        </motion.div>
      )
    }

    if (slide === 2) {
      return (
        <motion.div 
          className={styles.flagPreview}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <motion.div 
            className={styles.hexagon}
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 0.6,
              delay: 0.3
            }}
          />
          <span>Flagged posts go to review.</span>
        </motion.div>
      )
    }

    return (
      <motion.div 
        className={styles.preview}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className={styles.previewMeta}>anon · just now</div>
        <div className={styles.previewText}>Does anyone else find recursion easier after drawing the stack?</div>
      </motion.div>
    )
  }, [slide])

  const finish = () => {
    localStorage.setItem('social_onboarded', 'true')
    onComplete?.()
  }

  const handleTouchStart = (e) => {
    const touch = e.touches?.[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const touch = e.changedTouches?.[0]
    if (!touch) return

    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) <= 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) goNext()
    else goBack()
  }

  return (
    <div className={styles.overlay}>
      <motion.div 
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <div className={styles.center}>
        <motion.div 
          className={styles.card} 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ 
            type: 'spring',
            stiffness: 300,
            damping: 30
          }}
        >
          <motion.button
            className={styles.skipBtn}
            onClick={finish}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={18} />
            Skip
          </motion.button>

          <motion.div 
            className={styles.iconStack}
            key={slide}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 400,
              damping: 25
            }}
          >
            <Icon size={34} />
            {SecondaryIcon && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <SecondaryIcon size={24} className={styles.secondaryIcon} />
              </motion.div>
            )}
          </motion.div>

          <motion.div 
            className={styles.eyebrow}
            key={`eyebrow-${slide}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {current.eyebrow}
          </motion.div>
          
          <motion.h2 
            className={styles.heading}
            key={`heading-${slide}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {current.title}
          </motion.h2>
          
          <motion.p 
            className={styles.body}
            key={`body-${slide}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {current.body}
          </motion.p>

          <AnimatePresence mode="wait">
            {preview}
          </AnimatePresence>

          <div className={styles.footer}>
            <div className={styles.dots}>
              {slides.map((_, i) => (
                <motion.button
                  key={i}
                  type="button"
                  className={`${styles.dot} ${slide === i ? styles.dotActive : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>

            <div className={styles.actions}>
              {!isFirst && (
                <motion.button 
                  type="button" 
                  className={styles.backBtn} 
                  onClick={goBack}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft size={16} />
                  Back
                </motion.button>
              )}

              <RippleButton 
                type="button" 
                className={styles.primaryBtn} 
                onClick={isLast ? finish : goNext}
                hoverScale={1.02}
                tapScale={0.98}
              >
                {isLast ? 'Enter feed' : 'Continue'}
                {!isLast && <ChevronRight size={16} />}
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
              </RippleButton>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link className={styles.guidelinesLink} to="/social/guidelines">
                Community guidelines
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
