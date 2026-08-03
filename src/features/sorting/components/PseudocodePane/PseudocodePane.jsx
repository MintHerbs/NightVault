// The listing beside the canvas, with the line the current step is executing
// highlighted (T-105).
//
// This is what turns "a cell moved" into "line 13 ran". The listing is
// direction-aware (pseudocodeFor), so what is highlighted always states the
// comparison the engine actually made.
import { useEffect, useRef } from 'react'
import { pseudocodeFor } from '../../../../lib/algo/sorting'
import styles from './PseudocodePane.module.css'

export default function PseudocodePane({ method, direction, activeLine, blurb }) {
  const lines = pseudocodeFor(method, direction)
  const activeRef = useRef(null)

  // Long listings (quicksort is 19 lines) can run past the pane on a short
  // viewport, and a highlight nobody can see is the same as no highlight.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeLine])

  return (
    <div className={styles.pane}>
      <ol className={styles.listing}>
        {lines.map((line, index) => {
          const isActive = index === activeLine
          return (
            <li
              key={index}
              ref={isActive ? activeRef : null}
              className={styles.line}
              data-active={isActive ? '' : undefined}
              data-blank={line.trim() === '' ? '' : undefined}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={styles.number}>{index + 1}</span>
              {/* A non-breaking space keeps a blank separator line at full
                  height, so the listing's shape does not change between steps. */}
              <code className={styles.code}>{line || ' '}</code>
            </li>
          )
        })}
      </ol>
      {blurb && <p className={styles.blurb}>{blurb}</p>}
    </div>
  )
}
