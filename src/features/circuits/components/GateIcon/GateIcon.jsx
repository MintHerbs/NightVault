/**
 * GateIcon - the palette's picture of a component (T-092).
 *
 * Drawn from lib/circuits/gateShapes.js, so the button in the toolbar is the
 * same silhouette that lands on the canvas. A palette of text labels forces the
 * student to learn a mapping twice — once from word to button, again from word
 * to shape — and the second mapping is the one the exam asks for.
 *
 * @param {Object} props
 * @param {string} props.kind - any placeable kind, gate or not
 * @param {number} [props.size] - height in px; the icon scales from it
 */
import { gateSilhouette } from '../../../../lib/circuits/gateShapes'
import { FLIP_FLOP_LABELS, isFlipFlop } from '../../../../lib/circuits/flipFlops'
import styles from './GateIcon.module.css'

const VIEW_W = 34
const VIEW_H = 22

export default function GateIcon({ kind, size = 22 }) {
  const width = Math.round(size * (VIEW_W / VIEW_H))

  return (
    <svg
      className={styles.icon}
      width={width}
      height={size}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      aria-hidden="true"
      focusable="false"
    >
      <Body kind={kind} />
    </svg>
  )
}

function Body({ kind }) {
  // Room on the left for the input stubs, on the right for the output stub.
  const box = { x: 6, y: 2, width: VIEW_W - 12, height: VIEW_H - 4 }
  const midY = VIEW_H / 2

  if (isFlipFlop(kind)) {
    return (
      <g>
        <rect
          x={box.x}
          y={box.y - 1}
          width={box.width}
          height={box.height + 2}
          rx="2"
          className={styles.stroke}
        />
        <path d={`M${box.x},${midY + 3} L${box.x + 4},${midY} L${box.x},${midY - 3}`} className={styles.stroke} />
        <text x={box.x + box.width / 2 + 2} y={midY + 3} className={styles.glyph}>
          {FLIP_FLOP_LABELS[kind]?.[0] ?? '?'}
        </text>
      </g>
    )
  }

  if (kind === 'input') {
    return (
      <g>
        <rect x="7" y="4" width="14" height="14" rx="2" className={styles.stroke} />
        <line x1="21" y1={midY} x2="29" y2={midY} className={styles.lead} />
        <text x="14" y={midY + 3.5} className={styles.glyph}>1</text>
      </g>
    )
  }

  if (kind === 'output') {
    return (
      <g>
        <line x1="5" y1={midY} x2="12" y2={midY} className={styles.lead} />
        <circle cx="19" cy={midY} r="7" className={styles.stroke} />
        <text x="19" y={midY + 3.5} className={styles.glyph}>0</text>
      </g>
    )
  }

  if (kind === 'const') {
    // A hexagon, so a fixed 1 cannot be mistaken for a clickable input.
    return (
      <g>
        <path d="M11,4 L23,4 L27,11 L23,18 L11,18 L7,11 Z" className={styles.stroke} />
        <text x="17" y={midY + 3.5} className={styles.glyph}>1</text>
      </g>
    )
  }

  if (kind === 'clock') {
    return (
      <g>
        <rect x="5" y="4" width="18" height="14" rx="2" className={styles.stroke} />
        <path d="M8,15 L8,8 L12,8 L12,15 L16,15 L16,8 L20,8" className={styles.wave} />
        <line x1="23" y1={midY} x2="30" y2={midY} className={styles.lead} />
      </g>
    )
  }

  const shape = gateSilhouette(kind, box)
  if (!shape) return null

  return (
    <g>
      {/* An inverter has one input, everything else has two. Drawing two stubs
          on a NOT would misstate its arity in the one picture the student is
          meant to read the arity from. */}
      {kind === 'not' ? (
        <line x1="0" y1={midY} x2={box.x} y2={midY} className={styles.lead} />
      ) : (
        <>
          <line x1="0" y1={midY - 4} x2={box.x + 2} y2={midY - 4} className={styles.lead} />
          <line x1="0" y1={midY + 4} x2={box.x + 2} y2={midY + 4} className={styles.lead} />
        </>
      )}
      <path d={shape.body} className={styles.stroke} />
      {shape.tail && <path d={shape.tail} className={styles.strokeOnly} />}
      {shape.bubble && (
        <circle cx={shape.bubble.cx} cy={shape.bubble.cy} r={shape.bubble.r * 0.6} className={styles.bubble} />
      )}
      <line x1={box.x + box.width} y1={midY} x2={VIEW_W} y2={midY} className={styles.lead} />
    </g>
  )
}
