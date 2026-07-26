import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { colors } from '../../../constants/colors'
import BackButton from '../../../components/common/BackButton/BackButton'
import CpaMode from './CpaMode'
import MinMaxMode from './MinMaxMode'
import styles from './GradeToolkitPage.module.css'

// The two tools this page fuses. `key` is what lives in the ?mode= query param
// so the old standalone routes can deep-link straight into the right mode.
const MODES = [
  {
    key: 'cpa',
    label: 'My CPA',
    blurb: 'You know your marks; see what your CPA turns into.',
  },
  {
    key: 'minmax',
    label: 'Min effort, max result',
    blurb: 'Know the minimum exam mark you need for the grade you want.',
  },
]

export default function GradeToolkitPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('mode')
  const initial = MODES.some(m => m.key === requested) ? requested : 'cpa'

  const [mode, setMode] = useState(initial)
  const [reduceMotion, setReduceMotion] = useState(false)

  // Same reduced-motion contract the Card primitive and ScrambleText follow.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(query.matches)
    const onChange = e => setReduceMotion(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const changeMode = next => {
    setMode(next)
    // Keep the URL shareable/deep-linkable without stacking history entries.
    setSearchParams(next === 'cpa' ? {} : { mode: next }, { replace: true })
  }

  const active = MODES.find(m => m.key === mode) ?? MODES[0]

  return (
    <main
      className={styles.page}
      style={{
        '--tool-error': colors.error,
        '--tool-warning': colors.warning,
        '--tool-success': colors.success,
      }}
    >
      <BackButton onClick={() => navigate('/home')} />
      <div className={styles.content}>
        <motion.header
          className={styles.header}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        >
          <h1 className={styles.title}>Grade Toolkit</h1>
          <p className={styles.subtitle}>{active.blurb}</p>

          {/* M3 segmented button - single-select, one active segment. */}
          <div
            className={styles.segmented}
            role="tablist"
            aria-label="Grade Toolkit mode"
          >
            {MODES.map(m => {
              const selected = m.key === mode
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`${styles.segment} ${selected ? styles.segmentActive : ''}`}
                  onClick={() => changeMode(m.key)}
                >
                  {selected && (
                    <motion.span
                      layoutId={reduceMotion ? undefined : 'segmentIndicator'}
                      className={styles.segmentIndicator}
                      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                    />
                  )}
                  <span className={styles.segmentLabel}>{m.label}</span>
                </button>
              )
            })}
          </div>
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          >
            {mode === 'cpa' ? (
              <CpaMode reduceMotion={reduceMotion} />
            ) : (
              <MinMaxMode reduceMotion={reduceMotion} />
            )}
          </motion.div>
        </AnimatePresence>

        <p className={styles.privacy}>
          🔐 Fully static. Your marks never leave this page. Nothing is
          collected, logged, or stored. Made with love ❤️ from CS 2023.
        </p>
      </div>
    </main>
  )
}
