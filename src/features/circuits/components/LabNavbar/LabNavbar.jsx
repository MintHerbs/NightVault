/**
 * LabNavbar - the Digital Logic Lab's top bar (T-092 follow-up).
 *
 * Replaces the "Mode" dropdown that used to float over each view. A dropdown
 * made the tool's four modes feel like a setting on the current page; they are
 * four places, so they are navigation, and navigation belongs in a navbar.
 *
 * Keyboard behaviour is the tablist convention: arrows move between modes, and
 * only the active one is in the tab order.
 *
 * @param {Object} props
 * @param {string} props.mode - active mode id
 * @param {Function} props.onModeChange
 * @param {Function} props.onBack
 * @param {React.ReactNode} [props.actions] - right-hand slot, e.g. the Timing button
 */
import { useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { MODES } from '../ModeSelect/ModeSelect'
import { md } from '../md'
import styles from './LabNavbar.module.css'

export default function LabNavbar({ mode, onModeChange, onBack, actions = null }) {
  const listRef = useRef(null)

  const onKeyDown = (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()

    const ready = MODES.filter(m => m.ready)
    const at = ready.findIndex(m => m.id === mode)
    const next = ready[(at + step + ready.length) % ready.length]
    onModeChange(next.id)

    // Follow the selection with focus, or the arrow keys move the highlight
    // and leave the keyboard behind on the old tab.
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-mode="${next.id}"]`)?.focus()
    })
  }

  return (
    <nav className={styles.bar} aria-label="Digital Logic Lab">
      <div className={styles.left}>
        <button type="button" className={`${styles.back} ${md.stateLayer}`} onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <span className={`${styles.brand} ${md.titleMedium}`}>Digital Logic</span>
      </div>

      <div
        ref={listRef}
        className={styles.modes}
        role="tablist"
        aria-label="Mode"
        onKeyDown={onKeyDown}
      >
        {MODES.map(item => {
          const active = item.id === mode
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-mode={item.id}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              disabled={!item.ready}
              className={`${styles.mode} ${md.stateLayer} ${md.labelLarge} ${active ? styles.modeActive : ''}`}
              onClick={() => onModeChange(item.id)}
              title={item.hint}
            >
              {item.label}
              {active && <span className={styles.indicator} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className={styles.right}>{actions}</div>
    </nav>
  )
}
