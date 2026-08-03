// Method dropdown and Ascending/Descending chips, on one row under the pill
// (T-105).
//
// This sits *beside* the shared PillInput rather than replacing it, which is
// what docs/rules.md §14.2 allows: the rule is about the input control, and a
// mode selector next to it is explicitly fine. The placement copies
// RecurrenceInput's method row; the text field does not, because that one is a
// bespoke textarea and §14.1 makes the shared pill mandatory.
//
// Order is two chips rather than a second dropdown: the choice is binary, and a
// dropdown holding two items costs a click to reveal what a pair of chips shows
// for free.
import { useEffect, useRef, useState } from 'react'
import { ASC, DESC, METHODS } from '../../../../lib/algo/sorting'
import { fireAck } from '../../../../hooks/useSentinelQuip'
import styles from './RunOptions.module.css'

export default function RunOptions({ method, direction, onMethodChange, onDirectionChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // A dropdown that only closes by picking something is a trap on touch, where
  // there is no Escape key to fall back on.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const active = METHODS.find((m) => m.id === method) || METHODS[0]

  const selectMethod = (id) => {
    setOpen(false)
    if (id === method) return
    onMethodChange(id)
    // Switching method sets no aiState of its own, so without this the press is
    // silent on the island (docs/rules.md §15.5).
    fireAck('mode-switch')
  }

  const selectDirection = (next) => {
    if (next === direction) return
    onDirectionChange(next)
    // Same verb, same glyph: order and method are both "change how this runs".
    fireAck('mode-switch')
  }

  return (
    <div className={styles.row} ref={wrapperRef}>
      <div className={styles.group}>
        <span className={styles.label}>Method:</span>
        <button
          type="button"
          className={styles.methodButton}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {active.label}
        </button>

        {open && (
          <div className={styles.dropdown} role="listbox" aria-label="Sorting method">
            {METHODS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={entry.id === method}
                className={`${styles.option} ${entry.id === method ? styles.selected : ''}`}
                onClick={() => selectMethod(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.group} role="group" aria-label="Sort order">
        <span className={styles.label}>Order:</span>
        {[
          [ASC, 'Ascending'],
          [DESC, 'Descending'],
        ].map(([value, text]) => (
          <button
            key={value}
            type="button"
            className={`${styles.chip} ${direction === value ? styles.chipActive : ''}`}
            onClick={() => selectDirection(value)}
            aria-pressed={direction === value}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
