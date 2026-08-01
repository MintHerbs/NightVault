import { useEffect, useId, useMemo, useState } from 'react'
import { loadOCL } from '../../../lib/chem/loadChem'
import { renderMoleculeSvg } from '../../../lib/chem/renderStructureSvg'
import { isValidSmiles } from '../../../lib/chem/noteChem'
import { layoutReactionScheme, DEFAULTS } from '../../../lib/chem/reactionLayout'
import styles from './ReactionScheme.module.css'

const MEASURE_WIDTH = 300
const MEASURE_HEIGHT = 200

function collectSmiles(steps) {
  const set = new Set()
  for (const step of steps) {
    for (const s of step.reactants || []) set.add(s)
    for (const s of step.products || []) set.add(s)
    for (const agent of step.agents || []) set.add(agent.smiles)
  }
  return [...set]
}

function buildAriaLabel(steps) {
  return steps.map((step, i) => {
    const reactants = (step.reactants || []).join(' + ')
    const products = (step.products || []).join(' + ')
    const agents = (step.agents || []).map((a) => a.label || a.smiles).join(', ')
    const conditions = (step.conditionsAbove || []).join('; then ')
    let text = `Step ${i + 1}: ${reactants} reacts`
    if (agents) text += ` with ${agents}`
    if (conditions) text += ` under ${conditions}`
    text += ` to give ${products}`
    return text
  }).join('. ')
}

/** Renders one already-measured structure cell: the sanitised SVG once it
 * resolves, or a plain-text fallback (the SMILES/label) if that SMILES
 * failed to parse — same degrade-never-crash contract as MoleculeStructure. */
function StructureCell({ svg, fallback, className }) {
  if (svg) return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
  return <span className={className}>{fallback}</span>
}

/**
 * Renders a parsed `` ```reaction `` block (T-090) — the `{steps}` shape
 * `parseReactionBlock` returns. Measures every distinct SMILES via the same
 * OpenChemLib renderer `MoleculeStructure` uses, feeds the real sizes into
 * `reactionLayout.js`, then places every cell absolutely per the layout's
 * `{x, y, width, height}` — no layout logic lives in this component.
 */
export default function ReactionScheme({ data }) {
  const steps = useMemo(() => data?.steps || [], [data])
  const smilesList = useMemo(() => collectSmiles(steps), [steps])
  // Same duplicate-id concern as MoleculeStructure: a per-instance counter
  // starting at 0 collides across multiple reaction blocks on one page
  // (a note can have several, and a note can render alongside its own
  // preview in the admin editor) — useId() scopes each instance's cell ids.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')

  const [structures, setStructures] = useState({})
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    let cancelled = false
    setMeasured(false)
    loadOCL().then(
      (OCL) => {
        if (cancelled) return
        const next = {}
        for (const smiles of smilesList) {
          if (!isValidSmiles(smiles)) continue
          try {
            next[smiles] = renderMoleculeSvg(OCL, smiles, {
              width: MEASURE_WIDTH,
              height: MEASURE_HEIGHT,
              id: `rxn-${instanceId}-cell-${Object.keys(next).length}`,
            })
          } catch {
            // Left absent — cellSizes falls back to the minimum cell size
            // below, and the cell renders its SMILES as plain-text fallback.
          }
        }
        setStructures(next)
        setMeasured(true)
      },
      () => { if (!cancelled) setMeasured(true) },
    )
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smilesList.join('\0'), instanceId])

  const cellSizes = useMemo(() => {
    const sizes = {}
    for (const smiles of smilesList) {
      const structure = structures[smiles]
      sizes[smiles] = structure
        ? { width: structure.width, height: structure.height }
        : { width: DEFAULTS.minCellSize, height: DEFAULTS.minCellSize }
    }
    return sizes
  }, [smilesList, structures])

  const layout = useMemo(
    () => (measured ? layoutReactionScheme(steps, cellSizes) : null),
    [measured, steps, cellSizes],
  )

  if (!layout) {
    return <div className={styles.wrapper} aria-hidden="true" />
  }

  const ariaLabel = buildAriaLabel(steps)

  return (
    <div className={styles.wrapper} role="img" aria-label={ariaLabel} contentEditable={false}>
      <div className={styles.canvas} style={{ width: layout.width, height: layout.height }}>
        {layout.cells.map((cell, i) => {
          const cellStyle = { left: cell.x, top: cell.y, width: cell.width, height: cell.height }

          if (cell.kind === 'structure') {
            const structure = structures[cell.smiles]
            return (
              <span key={i} className={styles.structureWrap} style={cellStyle}>
                <StructureCell className={styles.structureCell} svg={structure?.svg} fallback={cell.smiles} />
              </span>
            )
          }

          if (cell.kind === 'plus') {
            return (
              <span key={i} className={styles.plusCell} style={cellStyle}>+</span>
            )
          }

          if (cell.kind === 'arrow') {
            const conditionsHeight = (cell.conditionsAbove?.length || 0) * DEFAULTS.conditionLineHeight
            return (
              <div key={i} className={styles.arrowCell} style={cellStyle}>
                <div className={styles.conditions} style={{ height: conditionsHeight }}>
                  {(cell.conditionsAbove || []).map((line, li) => (
                    <div key={li} className={styles.conditionLine}>{line}</div>
                  ))}
                </div>
                <svg
                  className={styles.arrowSvg}
                  width={cell.width}
                  height={DEFAULTS.arrowHeight}
                  viewBox={`0 0 ${cell.width} ${DEFAULTS.arrowHeight}`}
                  preserveAspectRatio="none"
                >
                  <line
                    x1={0} y1={DEFAULTS.arrowHeight / 2}
                    x2={Math.max(0, cell.width - 10)} y2={DEFAULTS.arrowHeight / 2}
                    stroke="currentColor" strokeWidth={1.5}
                  />
                  <polygon
                    points={`${Math.max(0, cell.width - 10)},${DEFAULTS.arrowHeight / 2 - 5} ${cell.width},${DEFAULTS.arrowHeight / 2} ${Math.max(0, cell.width - 10)},${DEFAULTS.arrowHeight / 2 + 5}`}
                    fill="currentColor"
                  />
                </svg>
              </div>
            )
          }

          if (cell.kind === 'agent') {
            const structure = structures[cell.smiles]
            return (
              <div key={i} className={styles.agentCell} style={cellStyle}>
                <StructureCell className={styles.structureCell} svg={structure?.svg} fallback={cell.smiles} />
                {cell.label && <div className={styles.agentLabel}>{cell.label}</div>}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
