import { useState } from 'react'
import { gradeForMark, toneForMark } from './gradeScale'
import styles from './CpaMode.module.css'

const YEARS = [
  { id: 'year1', label: 'Year 1', weight: 1 },
  { id: 'year2', label: 'Year 2', weight: 3 },
  { id: 'year3', label: 'Year 3', weight: 5, hasProject: true },
]
const emptyModule = () => ({ name: '', percentage: '' })

const initialYears = () => Object.fromEntries(YEARS.map(({ id }) => [id, [emptyModule()]]))

const replaceAt = (items, index, value) => items.map((item, i) => (i === index ? value : item))

const removeAt = (items, index) => items.length > 1 ? items.filter((_, i) => i !== index) : items

function MarkControl({ mark, onChange, label }) {
  const tone = toneForMark(mark)
  const result = mark && Number(mark) !== 0 ? `${mark}%: ${gradeForMark(mark)}` : '0%'
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
        {result}
      </span>
    </div>
  )
}

function RemoveButton({ onClick, label, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.removeButton}
      aria-label={label}
      title={title}
    >
      ×
    </button>
  )
}

export default function CpaMode() {
  const [modules, setModules] = useState(initialYears)
  const [projects, setProjects] = useState([''])

  const changeModules = (year, change) => setModules(previous => ({ ...previous, [year]: change(previous[year]) }))
  const updateModule = (year, index, changes) => changeModules(year, rows => replaceAt(rows, index, { ...rows[index], ...changes }))

  const totals = YEARS.map(year => {
    const entries = [
      ...modules[year.id].map(row => [row.percentage, 12]),
      ...(year.hasProject ? projects.map(mark => [mark, 18]) : []),
    ].filter(([mark]) => !Number.isNaN(parseFloat(mark)))

    const credits = entries.reduce((sum, [, credit]) => sum + credit * year.weight, 0)

    const score = entries.reduce((sum, [mark, credit]) => sum + parseFloat(mark) * credit * year.weight, 0)

    return { ...year, credits, score, lpa: credits ? score / credits : 0 }
  })
  const allCredits = totals.reduce((sum, year) => sum + year.credits, 0)
  const cpa = allCredits ? totals.reduce((sum, year) => sum + year.score, 0) / allCredits : 0
  const highestInputYear = totals.reduce(
    (highest, year) => (year.credits ? year.id : highest),
    null
  )

  return (
    <div className={styles.mode}>
      {totals.map(year => (
        <section className={styles.yearCard} key={year.id}>
          <div className={styles.yearHeader}>
            <h2>{year.label}</h2>
            <div className={styles.badges}>
              <span>LPA: {year.lpa.toFixed(2)}</span>
              {year.id === highestInputYear && <span>CPA: {cpa.toFixed(2)}</span>}
            </div>
          </div>

          {year.hasProject && (
            <div className={styles.projectRows}>
              {projects.map((mark, index) => (
                <div className={styles.row} key={index}>
                  <span className={styles.projectTag}>
                    Final Year Project{projects.length > 1 ? ` ${index + 1}` : ''}
                  </span>
                  <MarkControl
                    mark={mark}
                    onChange={value => setProjects(rows => replaceAt(rows, index, value))}
                    label={`Final Year Project ${index + 1} mark`}
                  />
                  {projects.length > 1 && (
                    <RemoveButton
                      onClick={() => setProjects(rows => removeAt(rows, index))}
                      label={`Remove Final Year Project ${index + 1}`}
                      title="Remove final project"
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setProjects(rows => [...rows, ''])}
                className={styles.addProjectButton}
              >
                + Add another final project
              </button>
            </div>
          )}

          {modules[year.id].map((module, index, rows) => (
            <div className={styles.row} key={index}>
              <input
                value={module.name}
                placeholder="Module Name"
                onChange={event =>
                  updateModule(year.id, index, { name: event.target.value })
                }
                className={styles.nameInput}
              />
              <MarkControl
                mark={module.percentage}
                onChange={percentage => updateModule(year.id, index, { percentage })}
                label={`${year.label} module ${index + 1} mark`}
              />
              {rows.length > 1 && (
                <RemoveButton
                  onClick={() =>
                    changeModules(year.id, items => removeAt(items, index))
                  }
                  label={`Remove ${module.name || `module ${index + 1}`} from ${year.label}`}
                  title="Remove module"
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => changeModules(year.id, rows => [...rows, emptyModule()])}
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
