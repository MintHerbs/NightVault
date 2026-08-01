/**
 * StageRail - the stage switcher across a multi-stage result (T-089).
 *
 * M3 primary tabs: a sliding active indicator under the selected tab rather
 * than a pill, which is what M3 uses for switching between views of the same
 * content. Stages unlock one at a time so the student walks the problem in the
 * order the exam asks for it; "Show all" is the escape for anyone who only
 * wants the answer.
 *
 * No arrow glyphs. The earlier version put a literal "→" in the next-stage
 * label; the tab order already says which way the work runs, and a text arrow
 * is not something M3 uses.
 *
 * @param {Object} props
 * @param {Array<{id: string, label: string}>} props.stages
 * @param {string} props.active
 * @param {number} props.unlocked - how many stages are reachable
 * @param {Function} props.onSelect
 * @param {Function} props.onRevealAll
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button, md } from '../md'
import styles from './StageRail.module.css'

export default function StageRail({ stages, active, unlocked, onSelect, onRevealAll }) {
  const listRef = useRef(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const activeIndex = stages.findIndex(s => s.id === active)
  const allShown = unlocked >= stages.length
  const nextStage = activeIndex < stages.length - 1 ? stages[activeIndex + 1] : null
  const nextReachable = nextStage && activeIndex + 1 < unlocked

  // Measured rather than computed from flex ratios: the tabs are content-width,
  // so the indicator can only track them by reading the laid-out boxes.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const tab = list.querySelector(`[data-stage="${active}"]`)
    if (!tab) return
    setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth })
  }, [active, stages, unlocked])

  return (
    <div className={styles.rail}>
      <div className={styles.tabs} role="tablist" aria-label="Working stages" ref={listRef}>
        {stages.map((stage, index) => {
          const locked = index >= unlocked
          const selected = stage.id === active
          return (
            <button
              key={stage.id}
              type="button"
              role="tab"
              data-stage={stage.id}
              aria-selected={selected}
              disabled={locked}
              className={[
                styles.tab,
                md.stateLayer,
                md.titleSmall,
                selected ? styles.tabSelected : '',
                locked ? styles.tabLocked : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelect(stage.id)}
            >
              {locked
                ? <Lock size={14} aria-hidden="true" />
                : <span className={styles.tabIndex}>{index + 1}</span>}
              {stage.label}
            </button>
          )
        })}
        <span
          className={styles.indicator}
          style={{ transform: `translateX(${indicator.left}px)`, width: `${indicator.width}px` }}
          aria-hidden="true"
        />
      </div>

      <div className={styles.actions}>
        {nextStage && (
          <Button
            variant={nextReachable ? 'text' : 'tonal'}
            onClick={() => onSelect(nextStage.id)}
          >
            {nextReachable ? `Go to ${nextStage.label}` : `Reveal ${nextStage.label}`}
          </Button>
        )}
        {!allShown && (
          <Button variant="text" onClick={onRevealAll}>Show all</Button>
        )}
      </div>
    </div>
  )
}
