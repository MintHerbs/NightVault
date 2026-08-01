/**
 * TruthTableView - the table, with the row/cell cross-highlight (T-089).
 *
 * `highlight` and `onHighlight` are lifted to the page so hovering a row lights
 * the matching K-map cell and vice versa. That mapping (row index to Gray-coded
 * cell) is the thing students most often get wrong, and showing it live is worth
 * more than any amount of explaining it.
 *
 * @param {Object} props
 * @param {import('../../../../lib/circuits/truthTable.js').TruthTable} props.table
 * @param {number|null} props.highlight - minterm index currently hovered
 * @param {Function} props.onHighlight - called with a minterm index or null
 */
import styles from './TruthTableView.module.css'

// Past this the table scrolls rather than growing the page. 5 variables is 32
// rows, which is already a scroll on a laptop.
const TALL_THRESHOLD = 17

export default function TruthTableView({ table, highlight, onHighlight }) {
  const { vars, rows } = table
  const outputName = 'F'

  if (vars.length === 0) {
    return (
      <div className={styles.constant}>
        The expression has no variables. It is always {String(rows[0]?.output ?? 0)}.
      </div>
    )
  }

  return (
    <div className={rows.length > TALL_THRESHOLD ? styles.scroller : styles.wrap}>
      <div className={styles.shell}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {rows.length} rows. The row number is the minterm index, with {vars[0]} as the
          most significant bit.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.indexHead}>#</th>
            {vars.map(name => <th key={name} scope="col">{name}</th>)}
            <th scope="col" className={styles.outputHead}>{outputName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.minterm}
              className={[
                styles.row,
                highlight === row.minterm ? styles.highlighted : '',
                row.output === 1 ? styles.isOne : '',
                row.output === 'x' ? styles.isDontCare : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => onHighlight?.(row.minterm)}
              onMouseLeave={() => onHighlight?.(null)}
              onFocus={() => onHighlight?.(row.minterm)}
              onBlur={() => onHighlight?.(null)}
              tabIndex={0}
            >
              <td className={styles.index}>{row.minterm}</td>
              {row.inputs.map((bit, i) => <td key={vars[i]}>{bit}</td>)}
              <td className={styles.output}>{row.output === 'x' ? 'X' : row.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
