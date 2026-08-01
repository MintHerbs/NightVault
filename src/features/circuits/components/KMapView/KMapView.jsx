/**
 * KMapView - the map, its groups, and the alternative-cover selector (T-089).
 *
 * Groups arrive from kmapLayout.js as a LIST of rectangles per implicant, never
 * one bounding box, so a group that wraps an edge (or the four-corner group)
 * draws as the two or four boxes a textbook draws. This component does not
 * decide any of that; it only paints what it is handed.
 *
 * M3: the board and the legend are filled surfaces, cells are the next tone up
 * (elevation is tonal, not shadow), and the alternatives panel is a
 * primary-container because it is informing rather than warning.
 *
 * @param {Object} props
 * @param {import('../../../../lib/circuits/truthTable.js').TruthTable} props.table
 * @param {import('../../../../lib/circuits/quineMcCluskey.js').Solution} props.solution
 * @param {number} props.coverIndex
 * @param {Function} props.onCoverChange
 * @param {number|null} props.highlight
 * @param {Function} props.onHighlight
 */
import { useMemo, useState } from 'react'
import { placeCover } from '../../../../lib/circuits/kmapLayout'
import { implicantToTerm } from '../../../../lib/circuits/quineMcCluskey'
import { md } from '../md'
import styles from './KMapView.module.css'

const CELL = 56
const GAP = 4
const LABEL = 44

export default function KMapView({ table, solution, coverIndex, onCoverChange, highlight, onHighlight }) {
  const [hoveredGroup, setHoveredGroup] = useState(null)
  const { layout, placements } = useMemo(
    () => placeCover(solution, { coverIndex }),
    [solution, coverIndex]
  )

  if (!layout.supported) {
    return (
      <div className={styles.unsupported}>
        <p className={md.bodyLarge}>
          A Karnaugh map stops being readable past five variables, so there is no grid for
          {' '}{solution.vars.length}.
        </p>
        <p className={`${styles.unsupportedNote} ${md.bodySmall}`}>
          The truth table and the minimised expression are still exact. Quine-McCluskey does
          not need the map; the map is only how the same result is usually drawn.
        </p>
      </div>
    )
  }

  const outputs = outputLookup(table)

  return (
    <div className={styles.wrap}>
      {solution.covers.length > 1 && (
        <div className={styles.alternatives}>
          <h3 className={`${styles.alternativesTitle} ${md.titleMedium}`}>
            {solution.covers.length} equally minimal groupings
          </h3>
          <div className={styles.alternativeChips}>
            {solution.covers.map((cover, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={index === coverIndex}
                className={[
                  md.chip,
                  md.stateLayer,
                  index === coverIndex ? styles.alternativeChipSelected : styles.alternativeChip,
                ].join(' ')}
                onClick={() => onCoverChange(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className={`${styles.alternativesNote} ${md.bodySmall}`}>
            All cost {solution.covers[0].terms} terms and {solution.covers[0].literals} literals.
            A different one is not a wrong answer.
          </p>
        </div>
      )}

      <div className={styles.board}>
        {layout.planes.map(plane => (
          <Plane
            key={plane.index}
            plane={plane}
            layout={layout}
            placements={placements}
            outputs={outputs}
            highlight={highlight}
            onHighlight={onHighlight}
            hoveredGroup={hoveredGroup}
          />
        ))}
      </div>

      <ul className={styles.legend}>
        {placements.map((placement, index) => (
          <li
            key={index}
            className={styles.legendItem}
            style={{ '--group-rgb': `var(--kmap-group-${placement.colour + 1}-rgb)` }}
            onMouseEnter={() => setHoveredGroup(index)}
            onMouseLeave={() => setHoveredGroup(null)}
          >
            <span className={styles.swatch} aria-hidden="true">{placement.cells.length}</span>
            <span className={styles.legendText}>
              <span className={styles.legendTerm}>
                {implicantToTerm(placement.implicant, solution.vars, solution.form).text}
              </span>
              <span className={styles.legendMeta}>
                {placement.cells.length} cell{placement.cells.length === 1 ? '' : 's'}
                {placement.wraps ? ' · wraps the edge' : ''}
                {placement.spansPlanes ? ' · on both maps' : ''}
              </span>
            </span>
            {placement.essential && <span className={styles.legendBadge}>Essential</span>}
          </li>
        ))}
        {placements.length === 0 && (
          <li className={styles.legendEmpty}>
            No groups: the function is constant {solution.kind === 'one' ? '1' : '0'}.
          </li>
        )}
      </ul>
    </div>
  )
}

function Plane({ plane, layout, placements, outputs, highlight, onHighlight, hoveredGroup }) {
  const rows = plane.cells.length
  const cols = plane.cells[0].length
  const width = LABEL + cols * (CELL + GAP) + GAP
  const height = LABEL + rows * (CELL + GAP) + GAP

  const x = (col) => LABEL + GAP + col * (CELL + GAP)
  const y = (row) => LABEL + GAP + row * (CELL + GAP)

  const rowVarLabel = layout.rowVars.join('')
  const colVarLabel = layout.colVars.join('')

  return (
    <figure className={styles.plane}>
      {plane.label && <figcaption className={styles.planeLabel}>{plane.label}</figcaption>}
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`Karnaugh map${plane.label ? ` for ${plane.label}` : ''}`}
      >
        {colVarLabel && <text x={LABEL + GAP} y={16} className={styles.axisName}>{colVarLabel}</text>}
        {rowVarLabel && <text x={4} y={LABEL + GAP + 14} className={styles.axisName}>{rowVarLabel}</text>}

        {plane.colLabels.map((label, col) => (
          <text key={`c${col}`} x={x(col) + CELL / 2} y={LABEL - 10} className={styles.axisLabel}>
            {label}
          </text>
        ))}
        {plane.rowLabels.map((label, row) => (
          <text key={`r${row}`} x={LABEL - 10} y={y(row) + CELL / 2 + 4} className={styles.axisLabelRight}>
            {label}
          </text>
        ))}

        {plane.cells.map((cellRow, row) => cellRow.map((minterm, col) => (
          <g key={minterm}>
            <rect
              x={x(col)}
              y={y(row)}
              width={CELL}
              height={CELL}
              rx="8"
              className={highlight === minterm ? styles.cellHighlighted : styles.cell}
              onMouseEnter={() => onHighlight?.(minterm)}
              onMouseLeave={() => onHighlight?.(null)}
            />
            <text
              x={x(col) + CELL / 2}
              y={y(row) + CELL / 2 + 6}
              className={outputs[minterm] === 1 ? styles.valueOne : styles.value}
            >
              {outputs[minterm] === 'x' ? 'X' : outputs[minterm]}
            </text>
            <text x={x(col) + 7} y={y(row) + 15} className={styles.mintermIndex}>{minterm}</text>
          </g>
        )))}

        {/* Groups sit above the cells so their outlines are never clipped by a
            neighbouring cell's fill, and are pointer-transparent so hovering
            still reaches the cell underneath. */}
        <g pointerEvents="none">
          {placements.map((placement, index) => placement.rectangles
            .filter(rect => rect.plane === plane.index)
            .map((rect, k) => (
              <rect
                key={`${index}-${k}`}
                x={x(rect.col) - 5}
                y={y(rect.row) - 5}
                width={rect.colSpan * (CELL + GAP) - GAP + 10}
                height={rect.rowSpan * (CELL + GAP) - GAP + 10}
                rx="12"
                className={hoveredGroup === index ? styles.groupActive : styles.group}
                style={{ '--group-rgb': `var(--kmap-group-${placement.colour + 1}-rgb)` }}
              />
            )))}
        </g>
      </svg>
    </figure>
  )
}

/**
 * minterm index -> the value written in that cell, read from the truth table.
 *
 * Not derived from the cover: implicants absorb whichever don't-cares helped
 * them combine, so a cover-derived reading would print 1 in a cell the student
 * was told is X, and 0 in the don't-cares that happened to fall outside. The
 * cell shows what the function says; the groups show what the minimiser did
 * with it.
 */
function outputLookup(table) {
  const lookup = {}
  for (const row of table.rows) lookup[row.minterm] = row.output
  return lookup
}
