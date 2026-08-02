import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'
import styles from './DynamicIsland.module.css'

/**
 * QuipContent - Sentinel remarking on the thing that was just opened.
 *
 * The grid props arrive with the quip rather than being chosen here: every
 * quip owns a unique animation (T-094), and quips.test.js asserts no two share
 * one. This component only supplies the presentation the island imposes on all
 * of them, which is the part that must NOT vary: same size, same gap, same
 * blur, same rounded cells, so the pill reads as one voice.
 */
export default function QuipContent({ line, grid }) {
  return (
    <>
      <GridLoader
        blur={1.2}
        color={grid.color}
        gap={1}
        // A quip is Sentinel speaking, not the island reporting progress, so
        // the shared loader's default "Loading" label would be a lie to a
        // screen reader. The line itself is announced from the island's own
        // live region, which makes this glyph decorative.
        label=""
        mode={grid.mode}
        pattern={grid.pattern}
        rounded
        size="sm"
        speed={grid.speed}
      />
      <span className={styles.quipText}>{line}</span>
    </>
  )
}
