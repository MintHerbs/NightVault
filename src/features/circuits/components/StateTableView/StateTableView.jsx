/**
 * StateTableView - the state table and the excitation table (T-089 phase 3).
 *
 * One table, two readings. The left half is the state table a student writes
 * from the diagram; the right half is what each flip-flop's inputs must be to
 * make that transition happen. Showing them side by side is the point: the
 * excitation columns are derived from the two state columns beside them, and
 * the X entries are visibly free rather than mysteriously absent.
 *
 * @param {Object} props
 * @param {Object} props.design - the result of synthesizeFSM
 */
import { dataPins, FLIP_FLOP_LABELS } from '../../../../lib/circuits/flipFlops'
import { md } from '../md'
import styles from './StateTableView.module.css'

export default function StateTableView({ design }) {
  const { fsm, assignment, rows, flipFlop } = design
  const pins = dataPins(flipFlop)

  return (
    <div className={styles.wrap}>
      <div className={styles.assignment}>
        <h3 className={md.titleSmall}>State assignment</h3>
        <div className={styles.codes}>
          {fsm.states.map(state => (
            <span key={state.id} className={styles.code}>
              <span className={styles.codeState}>{state.id}</span>
              <span className={styles.codeBits}>{assignment.codes.get(state.id).join('')}</span>
            </span>
          ))}
        </div>
        {design.unusedCodes.length > 0 && (
          <p className={`${md.bodySmall} ${md.variantText}`}>
            {design.unusedCodes.length} encoding{design.unusedCodes.length === 1 ? '' : 's'} unused.
            Their next-state logic is a don&apos;t-care, which is why the equations come out smaller
            than the table looks.
          </p>
        )}
      </div>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.groupHead} colSpan={2 + fsm.inputs.length}>Present</th>
              <th scope="col" className={styles.groupHead} colSpan={2}>Next</th>
              <th scope="col" className={styles.groupHeadAccent} colSpan={assignment.bits * pins.length}>
                {FLIP_FLOP_LABELS[flipFlop]} inputs
              </th>
              <th scope="col" className={styles.groupHead} colSpan={fsm.outputs.length}>Output</th>
            </tr>
            <tr>
              <th scope="col">State</th>
              <th scope="col">{assignment.names.join('')}</th>
              {fsm.inputs.map(signal => <th key={signal.name} scope="col">{signal.name}</th>)}
              <th scope="col">State</th>
              <th scope="col">{assignment.names.map(n => `${n}+`).join('')}</th>
              {assignment.names.map((name, bit) => pins.map(pin => (
                <th key={`${name}-${pin}`} scope="col" className={styles.excitationHead}>
                  {pin}{assignment.bits - 1 - bit}
                </th>
              )))}
              {fsm.outputs.map(signal => <th key={signal.name} scope="col">{signal.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className={styles.stateCell}>{row.state}</td>
                <td className={styles.bits}>{row.code.join('')}</td>
                {fsm.inputs.map(signal => <td key={signal.name}>{row.input[signal.name]}</td>)}
                <td className={styles.stateCell}>{row.next}</td>
                <td className={styles.bits}>{row.nextCode.join('')}</td>
                {row.cells.map((cell, k) => (
                  <td
                    key={k}
                    className={cell.value === null ? styles.dontCare : styles.excitation}
                  >
                    {cell.value === null ? 'X' : cell.value}
                  </td>
                ))}
                {fsm.outputs.map(signal => (
                  <td key={signal.name} className={row.output[signal.name] ? styles.outputHigh : ''}>
                    {row.output[signal.name]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pins.length > 1 && (
        <p className={`${styles.note} ${md.bodySmall}`}>
          The X entries are genuine don&apos;t-cares from the {FLIP_FLOP_LABELS[flipFlop]} excitation
          table, not missing data. They go into the K-maps as don&apos;t-cares, which is why
          {' '}{flipFlop === 'jkff' ? 'JK' : 'SR'} designs usually need less logic than D.
        </p>
      )}
    </div>
  )
}
