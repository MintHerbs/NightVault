// B+ Tree page - shows landing screen or visualizer based on tree state
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import HeroText from '../../components/effects/HeroText/HeroText'
import PillInput from '../../components/ui/PillInput/PillInput'
import TreeCanvas from '../../features/tree/components/TreeCanvas/TreeCanvas'
import OperationsPanel from '../../features/tree/components/OperationsPanel/OperationsPanel'
import StepControls from '../../features/tree/components/StepControls/StepControls'
import { useBPlusTree } from '../../hooks/useBPlusTree'
import { normalizeKey } from '../../lib/BPlusTree'
import { useAnimationPlayer } from '../../hooks/useAnimationPlayer'
import { traceBuild, traceInsertMany, traceDeleteMany, traceDelete, traceReplace } from '../../lib/treeTrace'
import styles from './TreePage.module.css'

// Stable identity, so the player does not treat "no run yet" as a new run every render.
const NO_STEPS = []

const PLAYER_OPTIONS = {
  autoPlay: true,
  initialSpeed: 2,
  maxSpeed: 4,
  baseDelay: 900,
  // A big batch insert runs to hundreds of steps; compress long runs so the whole
  // rebuild stays watchable rather than crawling.
  maxTotalMs: 30000
}

function TreePage({ onAIStateChange, onChatOpen }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { values = [], order: initialOrder = 3 } = location.state || {}
  
  const [order, setOrder] = useState(initialOrder)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [hasTree, setHasTree] = useState(false)

  // Tree management hook. `tree` is the committed result; the canvas shows the
  // animation's current frame while one is playing.
  const { tree, stats, initializeTree, insert, deleteValues, replaceValue } = useBPlusTree(order)

  const [steps, setSteps] = useState(NO_STEPS)
  const player = useAnimationPlayer(steps, PLAYER_OPTIONS)

  // Every step carries the tree as it stood at that moment, produced by BPlusTree's own
  // narration hooks, so what is drawn always matches what the library actually did.
  const displayedTree = useMemo(() => {
    const snapshot = player.currentStep?.treeSnapshot
    return snapshot ? { root: snapshot } : tree
  }, [player.currentStep, tree])

  // Reset to idle on mount
  useEffect(() => {
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
    }
  }, [onAIStateChange])

  // The island tracks the construction, not the operation: the tree is rebuilt in under
  // a millisecond, so a fixed 800ms "thinking" told the visitor nothing. It now holds
  // for as long as the animation is still drawing.
  const { isAtEnd, hasSteps } = player
  useEffect(() => {
    if (typeof onAIStateChange !== 'function') return
    onAIStateChange(hasSteps && !isAtEnd ? 'thinking' : 'idle')
  }, [hasSteps, isAtEnd, onAIStateChange])

  // Initialize tree on mount with values from router state
  useEffect(() => {
    if (values.length > 0) {
      initializeTree(values, order)
      setHasTree(true)
    }
  }, []) // Empty deps - only run once on mount

  // Handle order change from HeroText
  const handleOrderChange = (newOrder) => {
    setOrder(newOrder)
  }

  // Handle input submission from PillInput
  const handleSubmit = (value) => {
    // Parse CSV values
    const parsedValues = value
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)

    // Need at least 2 values to build a tree
    if (parsedValues.length >= 2) {
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('thinking')
      }
      
      setSteps(traceBuild(parsedValues, order).steps)
      initializeTree(parsedValues, order)
      setHasTree(true)
    }
  }

  // Handle insert operation from OperationsPanel
  const handleInsert = (valuesToInsert) => {
    // Trace and commit both start from the same tree, so they cannot disagree.
    setSteps(traceInsertMany(tree, valuesToInsert).steps)
    insert(valuesToInsert)
  }

  // Handle delete operation from OperationsPanel
  const handleDelete = (valuesToDelete) => {
    setSteps(traceDeleteMany(tree, valuesToDelete).steps)
    deleteValues(valuesToDelete)
  }

  // Delete one key straight from the canvas.
  const handleDeleteKey = (value) => {
    setSteps(traceDelete(tree, value).steps)
    deleteValues([value])
  }

  // Change one key's value from the canvas. Returns an error string to show in
  // the popover, or nothing on success.
  const handleEditKey = (oldValue, newValue) => {
    // Compare the way the tree stores keys, not the way they were typed, so
    // retyping 5 as "05" is recognised as the same key rather than reported as a
    // collision with itself.
    if (normalizeKey(oldValue) === normalizeKey(newValue)) return null

    // Keys are a set, so landing on one that already exists would silently drop
    // the record instead of moving it: the insert half would no-op and the delete
    // half would still have run.
    if (tree.search(newValue)) {
      return `${newValue} is already in the tree.`
    }
    setSteps(traceReplace(tree, oldValue, newValue).steps)
    replaceValue(oldValue, newValue)
    return null
  }

  // Back to the landing screen for a fresh set of values
  const handleReset = () => {
    setHasTree(false)
    setIsPanelOpen(false)
    setSteps(NO_STEPS)
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
    }
  }

  // Toggle mobile panel
  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen)
  }

  // Close panel when clicking overlay
  const closePanel = () => {
    setIsPanelOpen(false)
  }

  return (
    <div className={styles.container}>
      {/* Starfield background - z-index: 0 */}
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />

      {/* Show landing screen when no tree exists */}
      {!hasTree && (
        <>
          <Navbar />
          <main className={styles.landingCenter}>
            <HeroText 
              activeTool="btree" 
              order={order}
              onOrderChange={handleOrderChange}
            />
            <PillInput 
              activeTool="btree" 
              onSubmit={handleSubmit}
              onAIStateChange={onAIStateChange}
            />
            <p className={styles.credit}>Made by CS for CS 🗿</p>
          </main>
        </>
      )}
      
      {/* Show visualizer when tree exists */}
      {hasTree && (
        <>
          {/* No title and no reset button. The title sat in the navbar's left slot,
              directly under the fixed-position BackButton, so the arrow covered the
              "B+" and left "Tree Visualizer" looking like stray text. Reset moved
              into OperationsPanel, next to the other tree operations. */}
          <Navbar />
          
          <div className={styles.mainContent}>
            <TreeCanvas
              tree={displayedTree}
              step={player.currentStep}
              // Only once the run has finished does the canvas show the committed
              // tree; before that an edit would be applied to a shape the visitor
              // is not looking at.
              interactive={!player.hasSteps || player.isAtEnd}
              onEditKey={handleEditKey}
              onDeleteKey={handleDeleteKey}
            />
            
            {/* Desktop: always visible */}
            <div className={styles.desktopPanel}>
              <OperationsPanel
                order={order}
                stats={stats}
                onInsert={handleInsert}
                onDelete={handleDelete}
                onReset={handleReset}
              />
            </div>

            {player.hasSteps && <StepControls player={player} />}

            {/* Mobile: toggle button */}
            <button 
              className={styles.mobileToggle}
              onClick={togglePanel}
              title="Operations"
            >
              ⚙️
            </button>

            {/* Mobile: bottom sheet overlay */}
            {isPanelOpen && (
              <>
                <div className={styles.overlay} onClick={closePanel} />
                <div className={styles.bottomSheet}>
                  <div className={styles.sheetHeader}>
                    <h2 className={styles.sheetTitle}>Operations</h2>
                    <button className={styles.closeButton} onClick={closePanel}>
                      ✕
                    </button>
                  </div>
                  <OperationsPanel
                    order={order}
                    stats={stats}
                    onInsert={handleInsert}
                    onDelete={handleDelete}
                    onReset={handleReset}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default TreePage
