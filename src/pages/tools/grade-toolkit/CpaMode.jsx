import { useState } from 'react'
import { gradeForMark, toneForMark } from './gradeScale'
import styles from './CpaMode.module.css'

const MODULE_CREDITS = 12
const PROJECT_CREDITS = 18

const YEARS = [
  { id: 'year1', label: 'Year 1', weight: 1 },
  { id: 'year2', label: 'Year 2', weight: 3 },
  { id: 'year3', label: 'Year 3', weight: 5, hasProject: true },
]

const newRow = () => ({ name: '', percentage: '' })

export default function CpaMode() {
  const [rowsByYear, setRowsByYear] = useState({
    year1: [newRow()],
    year2: [newRow()],
    year3: [newRow()],
  })
  const [projectMark, setProjectMark] = useState('')

  const updateRow = (yearId, index, field, value) => {
    setRowsByYear(previous => {
      const rows = [...previous[yearId]]
      rows[index] = { ...rows[index], [field]: value }
      return { ...previous, [yearId]: rows }
    })
  }

  const addRow = yearId => {
    setRowsByYear(previous => ({
      ...previous,
      [yearId]: [...previous[yearId], newRow()],
    }))
  }

  const tally = (rows, weight, includeProject = false) => {
    let score = 0
    let credits = 0

    if (includeProject) {
      const mark = parseFloat(projectMark)
      if (!Number.isNaN(mark)) {
        score += mark * PROJECT_CREDITS * weight
        credits += PROJECT_CREDITS * weight
      }
    }

    rows.forEach(row => {
      const mark = parseFloat(row.percentage)
      if (Number.isNaN(mark)) return
      score += mark * MODULE_CREDITS * weight
      credits += MODULE_CREDITS * weight
    })

    return { score, credits }
  }

  const perYear = YEARS.map(year => {
    const totals = tally(rowsByYear[year.id], year.weight, year.hasProject)
    return {
      ...year,
      ...totals,
      lpa: totals.credits > 0 ? totals.score / totals.credits : 0,
    }
  })

  const totalScore = perYear.reduce((sum, year) => sum + year.score, 0)
  const totalCredits = perYear.reduce((sum, year) => sum + year.credits, 0)
  const cpa = totalCredits > 0 ? totalScore / totalCredits : 0

  const markLabel = mark => {
    if (mark === '' || Number(mark) === 0) return `${mark || 0}%`
    return `${mark}%: ${gradeForMark(mark)}`
  }

  const renderMarkControl = (mark, onChange, label) => {
    const tone = toneForMark(mark)
    return (
      <div className={styles.markControl}>
        <input
          type="range"
          min="0"
          max="100"
          value={Number(mark) || 0}
          onChange={event => onChange(event.target.value)}
          className={`${styles.slider} ${styles[`slider_${tone}`]}`}
          aria-label={label}
        />
        <span className={`${styles.markLabel} ${styles[`label_${tone}`]}`}>
          {markLabel(mark)}
        </span>
      </div>
    )
  }

  return (
    <div className={styles.mode}>
      {/* <div className={styles.introduction}>
        <p>
          <strong>You know your marks and want to see what your future CPA may
          look like</strong>
        </p>
        <p>
          <strong>LPA</strong> can be considered to be your performance for
          that year only.
        </p>
        <p>
          <strong>CPA</strong> is cumulative, meaning the previous year(s) will
          affect your current CPA. It updates as you enter marks.
        </p>
        <p>Weightages are Year 1 ×1, Year 2 ×3, and Year 3 ×5.</p>
        <p>
          For the highest accuracy, enter marks for <strong>all</strong> your
          modules.
        </p>
      </div> */}

      {perYear.map(year => (
        <section className={styles.yearCard} key={year.id}>
          <div className={styles.yearHeader}>
            <h2>{year.label}</h2>
            <div className={styles.badges}>
              <span>LPA: {year.lpa.toFixed(2)}</span>
              <span>CPA: {cpa.toFixed(2)}</span>
            </div>
          </div>

          {year.hasProject && (
            <div className={styles.row}>
              <span className={styles.projectTag}>Final Year Project</span>
              {renderMarkControl(
                projectMark,
                setProjectMark,
                'Final Year Project mark'
              )}
            </div>
          )}

          {rowsByYear[year.id].map((row, index) => (
            <div className={styles.row} key={index}>
              <input
                type="text"
                value={row.name}
                placeholder="Module Name"
                onChange={event =>
                  updateRow(year.id, index, 'name', event.target.value)
                }
                className={styles.nameInput}
              />
              {renderMarkControl(
                row.percentage,
                value => updateRow(year.id, index, 'percentage', value),
                `${year.label} module ${index + 1} mark`
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => addRow(year.id)}
            className={styles.addButton}
          >
            + Add Module
          </button>
        </section>
      ))}

      <div className={styles.summary}>
        <p>CPA: {cpa.toFixed(2)}</p>
      </div>
    </div>
  )
}
