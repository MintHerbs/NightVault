import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { X, MagnifyingGlass, Trash, Check, CaretDown } from '@phosphor-icons/react'
import { useImageCleanup } from '../../hooks/useImageCleanup'
import styles from './ImageCleanupDrawer.module.css'

export default function ImageCleanupDrawer({ open, onClose, modules, isOwner }) {
  // State machine: idle → scanning → results → deleting → done
  const [state, setState] = useState('idle')
  
  // Scan configuration
  const [scopeType, setScopeType] = useState('all') // 'all' or 'specific'
  const [selectedModuleId, setSelectedModuleId] = useState(null)
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false)
  
  // Scan results
  const [orphans, setOrphans] = useState([])
  const [scannedCount, setScannedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  
  // Progress tracking
  const [currentFile, setCurrentFile] = useState(0)
  const [currentDeletion, setCurrentDeletion] = useState(0)
  
  // Checkbox state
  const [checkedOrphans, setCheckedOrphans] = useState(new Set())
  
  // Deletion results
  const [deletedCount, setDeletedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  
  const { runScan, deleteOrphans } = useImageCleanup({ modules, isOwner })
  
  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setState('idle')
      setOrphans([])
      setCheckedOrphans(new Set())
      setCurrentFile(0)
      setCurrentDeletion(0)
    }
  }, [open])
  
  // Check all orphans by default when results arrive
  useEffect(() => {
    if (state === 'results' && orphans.length > 0) {
      setCheckedOrphans(new Set(orphans.map((_, idx) => idx)))
    }
  }, [state, orphans])
  
  // Handle scan
  const handleScan = async () => {
    if (!isOwner) return
    
    setState('scanning')
    setCurrentFile(0)
    setSkippedCount(0)
    
    try {
      const moduleId = scopeType === 'specific' ? selectedModuleId : null
      
      const result = await runScan(moduleId, (current, total, skipped) => {
        setCurrentFile(current)
        setTotalFiles(total)
        setSkippedCount(skipped)
      })
      
      setOrphans(result.orphans)
      setScannedCount(result.scannedCount)
      setSkippedCount(result.skippedCount)
      setTotalFiles(result.totalFiles)
      setState('results')
    } catch (error) {
      console.error('Scan failed:', error)
      setState('idle')
    }
  }
  
  // Handle deletion
  const handleDelete = async () => {
    if (!isOwner || checkedOrphans.size === 0) return
    
    setState('deleting')
    setCurrentDeletion(0)
    
    const confirmedOrphans = orphans.filter((_, idx) => checkedOrphans.has(idx))
    
    try {
      const result = await deleteOrphans(confirmedOrphans, (current, total) => {
        setCurrentDeletion(current)
      })
      
      setDeletedCount(result.deleted)
      setFailedCount(result.failed)
      setState('done')
    } catch (error) {
      console.error('Deletion failed:', error)
      setState('results')
    }
  }
  
  // Toggle individual checkbox
  const toggleOrphan = (idx) => {
    setCheckedOrphans(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }
  
  // Select all
  const selectAll = () => {
    setCheckedOrphans(new Set(orphans.map((_, idx) => idx)))
  }
  
  // Deselect all
  const deselectAll = () => {
    setCheckedOrphans(new Set())
  }
  
  // Reset to idle for another scan
  const resetToIdle = () => {
    setState('idle')
    setOrphans([])
    setCheckedOrphans(new Set())
    setCurrentFile(0)
    setCurrentDeletion(0)
    setDeletedCount(0)
    setFailedCount(0)
  }
  
  // Get selected module name
  const selectedModule = modules.find(m => m.id === selectedModuleId)
  
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className={styles.backdrop} onClick={onClose} />
      )}
      
      {/* Drawer */}
      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Image Cleanup</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>
        
        {/* Content */}
        <div className={styles.content}>
          {!isOwner ? (
            <p className={styles.emptyText}>Only owners can access image cleanup.</p>
          ) : (
            <>
              {/* IDLE STATE */}
              {state === 'idle' && (
                <div className={styles.idleState}>
                  <div className={styles.scopeSection}>
                    <label className={styles.sectionLabel}>Scope</label>
                    
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="scope"
                        value="all"
                        checked={scopeType === 'all'}
                        onChange={() => setScopeType('all')}
                        className={styles.radio}
                      />
                      <span>All modules</span>
                    </label>
                    
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="scope"
                        value="specific"
                        checked={scopeType === 'specific'}
                        onChange={() => setScopeType('specific')}
                        className={styles.radio}
                      />
                      <span>Specific module</span>
                    </label>
                    
                    {scopeType === 'specific' && (
                      <Popover.Root open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
                        <Popover.Trigger asChild>
                          <button className={styles.moduleSelector}>
                            <span>{selectedModule?.label || 'Select module'}</span>
                            <CaretDown size={14} />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content className={styles.popoverContent} sideOffset={4}>
                            <div className={styles.moduleList}>
                              {modules.map(mod => (
                                <button
                                  key={mod.id}
                                  className={styles.moduleOption}
                                  onClick={() => {
                                    setSelectedModuleId(mod.id)
                                    setModulePopoverOpen(false)
                                  }}
                                >
                                  {mod.label}
                                </button>
                              ))}
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    )}
                  </div>
                  
                  <button
                    className={styles.scanButton}
                    onClick={handleScan}
                    disabled={scopeType === 'specific' && !selectedModuleId}
                  >
                    <MagnifyingGlass size={16} weight="bold" />
                    <span>Run Scan</span>
                  </button>
                </div>
              )}
              
              {/* SCANNING STATE */}
              {state === 'scanning' && (
                <div className={styles.scanningState}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${totalFiles > 0 ? (currentFile / totalFiles) * 100 : 0}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>
                    {currentFile} / {totalFiles} files
                  </p>
                  <p className={styles.skippedText}>
                    {skippedCount} skipped (unchanged)
                  </p>
                </div>
              )}
              
              {/* RESULTS STATE */}
              {state === 'results' && (
                <div className={styles.resultsState}>
                  <div className={styles.resultsSummary}>
                    <div className={styles.checkIcon}>
                      <Check size={16} weight="bold" />
                    </div>
                    <p className={styles.summaryText}>
                      <strong>Scan complete</strong>
                    </p>
                    <p className={styles.summaryDetails}>
                      {totalFiles} files checked · {skippedCount} skipped
                    </p>
                    <p className={styles.orphanCount}>
                      {orphans.length} unused image{orphans.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                  
                  {orphans.length > 0 && (
                    <>
                      <div className={styles.orphanList}>
                        {orphans.map((orphan, idx) => (
                          <label key={idx} className={styles.orphanRow}>
                            <input
                              type="checkbox"
                              checked={checkedOrphans.has(idx)}
                              onChange={() => toggleOrphan(idx)}
                              className={styles.checkbox}
                            />
                            <img
                              src={orphan.previewUrl}
                              alt={orphan.path}
                              className={styles.thumbnail}
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                            <span className={styles.orphanPath}>{orphan.path}</span>
                          </label>
                        ))}
                      </div>
                      
                      <div className={styles.selectionButtons}>
                        <button className={styles.selectButton} onClick={selectAll}>
                          Select all
                        </button>
                        <button className={styles.selectButton} onClick={deselectAll}>
                          Deselect all
                        </button>
                      </div>
                      
                      <button
                        className={styles.deleteButton}
                        onClick={handleDelete}
                        disabled={checkedOrphans.size === 0}
                      >
                        <Trash size={16} weight="bold" />
                        <span>Delete {checkedOrphans.size} selected</span>
                      </button>
                    </>
                  )}
                  
                  {orphans.length === 0 && (
                    <p className={styles.noOrphansText}>
                      No unused images found. All images are referenced by markdown files.
                    </p>
                  )}
                </div>
              )}
              
              {/* DELETING STATE */}
              {state === 'deleting' && (
                <div className={styles.deletingState}>
                  <p className={styles.deletingText}>Deleting images...</p>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${checkedOrphans.size > 0 ? (currentDeletion / checkedOrphans.size) * 100 : 0}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>
                    {currentDeletion} / {checkedOrphans.size}
                  </p>
                </div>
              )}
              
              {/* DONE STATE */}
              {state === 'done' && (
                <div className={styles.doneState}>
                  <div className={styles.checkIcon}>
                    <Check size={20} weight="bold" />
                  </div>
                  <p className={styles.doneText}>
                    <strong>Deleted {deletedCount} image{deletedCount !== 1 ? 's' : ''}</strong>
                  </p>
                  {failedCount > 0 && (
                    <p className={styles.failedText}>
                      {failedCount} failed
                    </p>
                  )}
                  {orphans.length - checkedOrphans.size > 0 && (
                    <p className={styles.skippedText}>
                      {orphans.length - checkedOrphans.size} skipped (unchecked)
                    </p>
                  )}
                  <button className={styles.scanButton} onClick={resetToIdle}>
                    <MagnifyingGlass size={16} weight="bold" />
                    <span>Run another scan</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
