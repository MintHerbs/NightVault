// Tool leaderboard. A table, not a chart: each row carries four different
// measures, and plotting them together would need either four axes or a
// dual-axis chart, both of which mislead.
//
// The proportion bar in the Sticks column is the one graphical mark, and it
// encodes a share of a whole (used / opened), so a filled track is the honest
// form for it.
import { activationRate, usesPerUser } from '../../../lib/analytics/adminApi'
import { toolLabel } from '../../../lib/analytics/eventSchema'
import { formatCount, formatPercent, formatRatio } from './format'
import styles from './ToolTable.module.css'

export default function ToolTable({ tools }) {
  const rows = Array.isArray(tools) ? tools : []
  if (!rows.length) {
    return <p className={styles.empty}>No tool use recorded in this range yet.</p>
  }

  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Tool</th>
              <th scope="col" className={styles.numeric}>Opened</th>
              <th scope="col" className={styles.numeric}>Used it</th>
              <th scope="col">Sticks</th>
              <th scope="col" className={styles.numeric}>Uses</th>
              <th scope="col" className={styles.numeric}>Per person</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(tool => {
              const rate = activationRate(tool)
              return (
                <tr key={tool.tool_key}>
                  <th scope="row" className={styles.toolName}>{toolLabel(tool.tool_key)}</th>
                  <td className={styles.numeric}>{formatCount(tool.opened)}</td>
                  <td className={styles.numeric}>{formatCount(tool.used)}</td>
                  <td className={styles.rateCell}>
                    <div className={styles.track}>
                      <div className={styles.fill} style={{ width: `${Math.round(rate * 100)}%` }} />
                    </div>
                    <span className={styles.rateValue}>{formatPercent(rate)}</span>
                  </td>
                  <td className={styles.numeric}>{formatCount(tool.uses)}</td>
                  <td className={styles.numeric}>{formatRatio(usesPerUser(tool))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.caption}>
        <strong>Opened</strong> counts people who landed on the tool.
        {' '}<strong>Used it</strong> counts those who then actually did something,
        so <strong>Sticks</strong> is the share who survived first contact.
        {' '}<strong>Per person</strong> is depth: a tool a few people lean on hard
        is worth more than one many people poke once.
      </p>
    </>
  )
}
