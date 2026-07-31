// Right sidebar - insert/delete inputs, tree info, and starting over
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import styles from './OperationsPanel.module.css'
import { normalizeKey } from '../../../../lib/BPlusTree'

function OperationsPanel({ order, stats, onInsert, onDelete, onReset }) {
  const [insertInput, setInsertInput] = useState('')
  const [deleteInput, setDeleteInput] = useState('')

  const handleInsert = () => {
    if (!insertInput.trim()) return
    
    // Parse comma-separated values
    const values = insertInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)
    
    if (values.length === 0) return

    // Deduplicate using the SAME rule the tree stores keys under, so "007" and
    // "7" (or "Banana"/"banana") collapse to one entry instead of diverging.
    const uniqueValues = []
    const seen = new Set()

    for (const value of values) {
      const normalized = normalizeKey(value)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        uniqueValues.push(value)
      }
    }

    if (uniqueValues.length === 0) return
    
    // Call parent handler
    onInsert(uniqueValues)
    
    // Clear input
    setInsertInput('')
  }

  const handleDelete = () => {
    if (!deleteInput.trim()) return
    
    // Parse comma-separated values
    const values = deleteInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)
    
    if (values.length === 0) return

    // Deduplicate using the SAME rule the tree stores keys under, so "007" and
    // "7" (or "Banana"/"banana") collapse to one entry instead of diverging.
    const uniqueValues = []
    const seen = new Set()

    for (const value of values) {
      const normalized = normalizeKey(value)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        uniqueValues.push(value)
      }
    }

    if (uniqueValues.length === 0) return
    
    // Call parent handler
    onDelete(uniqueValues)
    
    // Clear input
    setDeleteInput('')
  }

  const handleKeyPress = (e, handler) => {
    if (e.key === 'Enter') {
      handler()
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>INSERT VALUES</h3>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g. 42, 7, banana"
          value={insertInput}
          onChange={(e) => setInsertInput(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, handleInsert)}
        />
        <button 
          className={styles.button} 
          onClick={handleInsert}
          disabled={!insertInput.trim()}
        >
          Insert
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>DELETE VALUES</h3>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g. 42, banana"
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, handleDelete)}
        />
        <button 
          className={styles.deleteButton} 
          onClick={handleDelete}
          disabled={!deleteInput.trim()}
        >
          Delete
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>TREE INFO</h3>
        <div className={styles.info}>
          <div className={styles.infoRow}>
            <span>Order (m):</span>
            <span>{stats?.order || order}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Total Nodes:</span>
            <span>{stats?.nodeCount || 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Total Keys:</span>
            <span>{stats?.keyCount || 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Tree Height:</span>
            <span>{stats?.height || 0}</span>
          </div>
        </div>
      </div>

      {/* Starting over lives at the bottom of the panel that owns the other tree
          operations, rather than floating in the navbar. It is destructive, so it is
          styled as a quiet text button and kept away from Insert and Delete. */}
      {onReset && (
        <div className={styles.footer}>
          <button className={styles.resetButton} onClick={onReset}>
            <RotateCcw size={15} aria-hidden="true" />
            Start a new tree
          </button>
        </div>
      )}
    </div>
  )
}

export default OperationsPanel
