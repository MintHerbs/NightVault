/**
 * WaveformPanel - rolling timing diagram (T-089 phase 2).
 *
 * The payoff for building a simulator at all. "My counter is wrong" is
 * unanswerable from a static schematic and obvious from a waveform, and it is
 * how a student checks that a sequence detector actually detects the sequence.
 *
 * One row per input, flip-flop and probe, over the last N clock cycles, aligned
 * to the clock.
 *
 * @param {Object} props
 * @param {Object} props.simulation
 * @param {Array<Record<string, 0|1|'x'>>} props.trace - oldest first
 * @param {number} props.version - bumped by the parent on every tick, so the
 *   panel repaints even though `simulation` is mutated in place
 */
import { md } from '../md'
import styles from './WaveformPanel.module.css'

const STEP = 26
const ROW = 30
const HIGH = 6
const LOW = 22
const LABEL_WIDTH = 78

export default function WaveformPanel({ simulation, trace }) {
  const rows = simulation.traceable()

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={`${md.bodySmall} ${md.variantText}`}>
          Add an input, a flip-flop or a probe and the timing diagram appears here.
        </p>
      </div>
    )
  }

  if (trace.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={`${md.bodySmall} ${md.variantText}`}>
          Step or run the clock to record a timing diagram.
        </p>
      </div>
    )
  }

  const width = LABEL_WIDTH + trace.length * STEP + 12
  const height = rows.length * ROW + 24

  return (
    <div className={styles.panel}>
      <h3 className={`${styles.title} ${md.titleSmall}`}>
        Timing diagram
        <span className={`${md.bodySmall} ${md.variantText}`}>
          last {trace.length} cycle{trace.length === 1 ? '' : 's'}
        </span>
      </h3>

      <div className={styles.scroller}>
        <svg width={width} height={height} className={styles.svg} role="img" aria-label="Timing diagram">
          {rows.map((component, r) => {
            const top = 12 + r * ROW
            return (
              <g key={component.id}>
                <text x="0" y={top + 16} className={styles.rowLabel}>
                  {component.label ?? component.id}
                </text>
                <line
                  x1={LABEL_WIDTH}
                  y1={top + ROW - 3}
                  x2={width - 12}
                  y2={top + ROW - 3}
                  className={styles.divider}
                />
                <path d={wave(trace, component.id, top)} className={styles.trace} />
                {trace.map((sample, i) => (
                  sample[component.id] === 'x' ? (
                    <rect
                      key={i}
                      x={LABEL_WIDTH + i * STEP}
                      y={top + HIGH}
                      width={STEP}
                      height={LOW - HIGH}
                      className={styles.unknown}
                    />
                  ) : null
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

/**
 * One row's polyline. Each sample is a flat segment with a vertical edge where
 * the value changes, which is what makes an edge visible rather than a ramp.
 */
function wave(trace, id, top) {
  const yFor = (value) => (value === 1 ? top + HIGH : top + LOW)
  let path = ''
  let previous = null

  trace.forEach((sample, i) => {
    const value = sample[id]
    const x = LABEL_WIDTH + i * STEP
    const y = yFor(value === 'x' ? 0 : value)

    if (i === 0) path += `M${x},${y}`
    else if (previous !== value) path += ` L${x},${yFor(previous === 'x' ? 0 : previous)} L${x},${y}`
    else path += ` L${x},${y}`

    path += ` L${x + STEP},${y}`
    previous = value
  })

  return path
}
