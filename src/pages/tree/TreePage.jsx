// B+ Tree page - shows landing screen or visualizer based on tree state
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import HeroText from '../../components/effects/HeroText/HeroText'
import PillInput from '../../components/ui/PillInput/PillInput'
import TreeCanvas from '../../features/tree/components/TreeCanvas/TreeCanvas'
import OperationsPanel from '../../features/tree/components/OperationsPanel/OperationsPanel'
import { useBPlusTree } from '../../hooks/useBPlusTree'
import styles from './TreePage.module.css'

function TreePage({ onAIStateChange, onChatOpen }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { values = [], order: initialOrder = 3 } = location.state || {}
  
  const [order, setOrder] = useState(initialOrder)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [hasTree, setHasTree] = useState(false)

  // Tree management hook (no animation)
  const { tree, stats, initializeTree, insert, deleteValues } = useBPlusTree(order)

  // Reset to idle on mount
  useEffect(() => {
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
    }
  }, [onAIStateChange])

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
      
      initializeTree(parsedValues, order)
      setHasTree(true)
      
      // Return to idle after brief thinking state
      setTimeout(() => {
        if (typeof onAIStateChange === 'function') {
          onAIStateChange('idle')
        }
      }, 800)
    }
  }

  // Handle insert operation from OperationsPanel
  const handleInsert = (valuesToInsert) => {
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('thinking')
    }
    insert(valuesToInsert)
    // Show thinking state briefly, then return to idle
    setTimeout(() => {
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('idle')
      }
    }, 800)
  }

  // Handle delete operation from OperationsPanel
  const handleDelete = (valuesToDelete) => {
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('thinking')
    }
    deleteValues(valuesToDelete)
    // Show thinking state briefly, then return to idle
    setTimeout(() => {
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('idle')
      }
    }, 800)
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
          <Navbar 
            showTitle={true}
            title="B+ Tree Visualizer"
            showReset={true}
            onReset={() => {
              setHasTree(false)
              if (typeof onAIStateChange === 'function') {
                onAIStateChange('idle')
              }
            }}
          />
          
          <div className={styles.mainContent}>
            <TreeCanvas tree={tree} />
            
            {/* Desktop: always visible */}
            <div className={styles.desktopPanel}>
              <OperationsPanel
                order={order}
                stats={stats}
                onInsert={handleInsert}
                onDelete={handleDelete}
              />
            </div>

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
