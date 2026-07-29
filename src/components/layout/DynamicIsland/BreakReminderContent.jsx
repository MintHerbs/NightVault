import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'
import styles from './DynamicIsland.module.css'

// Soft violet, and the only downward wave on this surface. Every AI state is
// already spoken for by a colour or a pattern (blue pulse plus-full, white
// stagger frame, amber stagger frame), red belongs to the error state and
// green to the presence dot and the progress ring. A wave falling top to
// bottom reads as winding down rather than working, and rounded cells with a
// little blur keep it a nudge instead of an alarm.
const BREAK_COLOR = '#a78bfa'

export default function BreakReminderContent({ message }) {
  return (
    <div className={styles.breakPanel}>
      <GridLoader
        blur={1.5}
        color={BREAK_COLOR}
        gap={1}
        mode="stagger"
        pattern="wave-tb"
        rounded
        size="sm"
      />
      <span className={styles.breakText}>{message}</span>
    </div>
  )
}
