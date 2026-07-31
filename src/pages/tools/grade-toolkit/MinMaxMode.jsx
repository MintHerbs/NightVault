import { useState } from 'react'
import { motion } from 'motion/react'
import { TARGET_GRADES, examMarkNeeded } from './gradeScale'
import { trackToolEventDebounced } from '../../../lib/analytics/tracker'
import styles from './MinMaxMode.module.css'

const newRow = () => ({ moduleName: '', weightage: '', marks: '' })

// Difficulty tone for a required exam mark - drives the colour of each result.
const neededTone = value => {
  if (value <= 60) return 'easy'
  if (value <= 85) return 'moderate'
  return 'hard'
}

function ResultCell({ result }) {
  switch (result.status) {
    case 'secured':
      return (
        <span className={`${styles.result} ${styles.result_secured}`}>✓</span>
      )
    case 'impossible':
      return (
        <span className={`${styles.result} ${styles.result_impossible}`}>✕</span>
      )
    case 'needed':
      return (
        <span
          className={`${styles.result} ${styles[`result_${neededTone(result.value)}`]}`}
        >
          {result.value}
        </span>
      )
    default:
      return <span className={`${styles.result} ${styles.result_empty}`}>·</span>
  }
}

export default function MinMaxMode({ reduceMotion }) {
  const [rows, setRows] = useState([newRow()])

  const updateRow = (index, field, value) => {
    setRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    // Debounced: this fires per keystroke, and one event per editing burst is
    // what makes this tool comparable to the ones with a submit button.
    trackToolEventDebounced('grade-toolkit', 'edit')
  }

  const addRow = () => {
    setRows(prev => [...prev, newRow()])
    trackToolEventDebounced('grade-toolkit', 'edit')
  }

  return (
    <div className={styles.mode}>
      <p className={styles.hint}>
        Each cell is the <strong>minimum exam mark</strong> you need for that
        grade. e.g. exam worth 50% with 30 coursework marks needs{' '}
        <strong>80</strong> for an A. <span className={styles.legend}>✓ already secured · ✕ impossible</span>
      </p>

      <div className={styles.rows}>
        {rows.map((row, index) => (
          <motion.section
            key={index}
            className={styles.moduleCard}
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.inputs}>
              <input
                type="text"
                placeholder="Module Name (optional)"
                className={styles.nameInput}
                value={row.moduleName}
                onChange={e => updateRow(index, 'moduleName', e.target.value)}
              />
              <div className={styles.field}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder=" "
                  className={styles.fieldInput}
                  value={row.weightage}
                  onChange={e => updateRow(index, 'weightage', e.target.value)}
                />
                <label className={styles.floatingLabel}>Exam weightage %</label>
              </div>
              <div className={styles.field}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder=" "
                  className={styles.fieldInput}
                  value={row.marks}
                  onChange={e => updateRow(index, 'marks', e.target.value)}
                />
                <label className={styles.floatingLabel}>Coursework marks</label>
              </div>
            </div>

            <div className={styles.grades}>
              {TARGET_GRADES.map(grade => {
                const result = examMarkNeeded(grade, row.marks, row.weightage)
                return (
                  <div key={grade} className={styles.gradeCell}>
                    <span className={styles.gradeLetter}>{grade}</span>
                    <ResultCell result={result} />
                  </div>
                )
              })}
            </div>
          </motion.section>
        ))}
      </div>

      <button type="button" onClick={addRow} className={styles.addButton}>
        + Add module
      </button>
    </div>
  )
}
