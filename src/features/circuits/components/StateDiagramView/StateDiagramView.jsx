/**
 * StateDiagramView - the FSM as a bubble diagram (T-089 phase 3).
 *
 * States on a circle rather than a force layout: the number of states is small,
 * a circle is deterministic (so the picture does not move between renders), and
 * every self-loop and back-edge has somewhere to go without overlapping.
 *
 * @param {Object} props
 * @param {import('../../../../lib/circuits/fsmParser.js').FSM} props.fsm
 * @param {string|null} [props.activeState] - highlighted while stepping
 */
import { comboKey } from '../../../../lib/circuits/fsmParser'
import { md } from '../md'
import styles from './StateDiagramView.module.css'

const RADIUS = 30
const PADDING = 70

export default function StateDiagramView({ fsm, activeState = null }) {
  const count = fsm.states.length
  const ring = Math.max(90, count * 34)
  const size = (ring + PADDING) * 2

  const positions = new Map()
  fsm.states.forEach((state, i) => {
    // Start at the top and go clockwise, so the reset state reads first.
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    positions.set(state.id, {
      x: size / 2 + Math.cos(angle) * ring,
      y: size / 2 + Math.sin(angle) * ring,
      angle,
    })
  })

  // Group transitions by state pair so parallel edges can be labelled together
  // rather than drawn on top of each other.
  const edges = new Map()
  for (const transition of fsm.transitions) {
    const key = `${transition.from}|${transition.to}`
    if (!edges.has(key)) edges.set(key, { from: transition.from, to: transition.to, labels: [] })
    edges.get(key).labels.push(edgeLabel(fsm, transition))
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <svg viewBox={`0 0 ${size} ${size}`} className={styles.svg} role="img" aria-label="State diagram">
          <defs>
            <marker id="fsm-arrow" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
            </marker>
          </defs>

          {[...edges.values()].map((edge) => {
            const from = positions.get(edge.from)
            const to = positions.get(edge.to)
            const isSelf = edge.from === edge.to
            const label = edge.labels.join(', ')

            if (isSelf) {
              const loop = selfLoopPath(from)
              return (
                <g key={`${edge.from}-self`}>
                  <path d={loop.path} className={styles.edge} markerEnd="url(#fsm-arrow)" />
                  <text x={loop.labelX} y={loop.labelY} className={styles.edgeLabel}>{label}</text>
                </g>
              )
            }

            const curve = curvedPath(from, to, edges.has(`${edge.to}|${edge.from}`))
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path d={curve.path} className={styles.edge} markerEnd="url(#fsm-arrow)" />
                <text x={curve.labelX} y={curve.labelY} className={styles.edgeLabel}>{label}</text>
              </g>
            )
          })}

          {fsm.states.map((state) => {
            const position = positions.get(state.id)
            const isReset = state.id === fsm.reset
            const isActive = state.id === activeState

            return (
              <g key={state.id}>
                {isReset && (
                  <path
                    d={`M${position.x - RADIUS - 26},${position.y} L${position.x - RADIUS - 4},${position.y}`}
                    className={styles.resetArrow}
                    markerEnd="url(#fsm-arrow)"
                  />
                )}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={RADIUS}
                  className={isActive ? styles.stateActive : styles.state}
                />
                <text x={position.x} y={position.y + 1} className={styles.stateId}>{state.id}</text>
                {fsm.machineType === 'moore' && (
                  <text x={position.x} y={position.y + 14} className={styles.stateOutput}>
                    {fsm.outputs.map(s => `${s.name}=${state.output[s.name]}`).join(' ')}
                  </text>
                )}
                {state.label && state.label !== state.id && (
                  <text x={position.x} y={position.y + RADIUS + 15} className={styles.stateLabel}>
                    {state.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <p className={`${styles.legend} ${md.bodySmall}`}>
        {fsm.machineType === 'moore'
          ? 'Moore: the output is written inside each state, because it depends only on which state the machine is in.'
          : 'Mealy: the output is written on each arrow after a slash, because it depends on the state and the input together.'}
      </p>
    </div>
  )
}

function edgeLabel(fsm, transition) {
  const input = fsm.inputs.map(s => transition.input[s.name]).join('')
  if (fsm.machineType === 'moore') return input
  const output = fsm.outputs.map(s => transition.output[s.name]).join('')
  return `${input}/${output}`
}

/** A loop leaving and re-entering the same bubble, pushed away from the centre. */
function selfLoopPath(position) {
  const dx = Math.cos(position.angle) * 30
  const dy = Math.sin(position.angle) * 30
  const start = { x: position.x + dx * 0.5 - 10, y: position.y + dy * 0.5 - 10 }
  const end = { x: position.x + dx * 0.5 + 10, y: position.y + dy * 0.5 + 10 }
  const control = { x: position.x + dx * 2.4, y: position.y + dy * 2.4 }

  return {
    path: `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`,
    labelX: position.x + dx * 2.1,
    labelY: position.y + dy * 2.1,
  }
}

/**
 * A quadratic arc between two bubbles, stopping at the rim rather than the
 * centre so the arrowhead sits on the edge of the circle.
 *
 * `bowed` curves A->B and B->A in opposite directions so a pair of transitions
 * between the same two states does not draw one on top of the other.
 */
function curvedPath(from, to, bowed) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length

  const start = { x: from.x + ux * RADIUS, y: from.y + uy * RADIUS }
  const end = { x: to.x - ux * (RADIUS + 6), y: to.y - uy * (RADIUS + 6) }

  const bow = bowed ? 26 : 0
  const midX = (start.x + end.x) / 2 - uy * bow
  const midY = (start.y + end.y) / 2 + ux * bow

  return {
    path: `M${start.x},${start.y} Q${midX},${midY} ${end.x},${end.y}`,
    labelX: midX - uy * 10,
    labelY: midY + ux * 10 - 4,
  }
}
