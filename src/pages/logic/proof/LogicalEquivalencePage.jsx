// LogicalEquivalencePage - Logical equivalence proof builder using forward chaining
import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ScrambleText } from '../../../components/ui/ScrambleText'
import Starfield from '../../../components/effects/Starfield/Starfield'
import Navbar from '../../../components/layout/Navbar/Navbar'
import BackButton from '../../../components/common/BackButton/BackButton'
import PillInput from '../../../components/ui/PillInput/PillInput'
import SymbolBar from '../../../features/logic/components/SymbolBar'
import ProofTreeCanvas from '../../../features/logic/components/ProofTreeCanvas'
import LogicRulesPanel from '../../../features/logic/components/LogicRulesPanel'
import InferenceRulesDrawer from '../../../features/logic/components/InferenceRulesDrawer'
import { runProof } from '../../../lib/logic/proofEngine'
import { parseFormula } from '../../../lib/logic/formulaParser'
import styles from './LogicalEquivalencePage.module.css'

export default function LogicalEquivalencePage({ onAIStateChange }) {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isRulesDrawerOpen, setIsRulesDrawerOpen] = useState(false)
  
  const inputRef = useRef(null)

  const handleAIStateChange = (state) => {
    if (typeof onAIStateChange === 'function') {
      onAIStateChange(state)
    }
  }

  const handleSubmit = useCallback((value) => {
    if (!value || value.trim().length === 0) {
      setError('Please enter a formula')
      return
    }

    // Reset state
    setResult(null)
    setError(null)
    handleAIStateChange('thinking')

    try {
      // Split by comma and trim each
      const items = value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0)
      
      if (items.length === 0) {
        setError('Please enter at least one formula')
        handleAIStateChange('idle')
        return
      }

      let premisesArray
      let conclusion

      if (items.length === 1) {
        // Single formula - parse it and extract conjuncts as premises
        const parsed = parseFormula(items[0])
        
        // If it's a conjunction, extract all conjuncts as premises
        if (parsed.type === 'and') {
          premisesArray = []
          const extractConjuncts = (node) => {
            if (node.type === 'and') {
              extractConjuncts(node.left)
              extractConjuncts(node.right)
            } else {
              // Convert node back to string
              premisesArray.push(astToString(node))
            }
          }
          extractConjuncts(parsed)
          conclusion = null
        } else {
          // Not a conjunction, treat as single premise with no conclusion
          premisesArray = [items[0]]
          conclusion = null
        }
      } else {
        // Multiple items: last is conclusion, rest are premises
        premisesArray = items.slice(0, -1)
        conclusion = items[items.length - 1]
      }

      // Run proof engine
      const proofResult = runProof(premisesArray, conclusion)
      
      if (proofResult.success) {
        setResult(proofResult)
        setError(null)
      } else {
        setError(proofResult.error || 'Could not derive conclusion from given premises')
        setResult(null)
      }
      
      // Set to idle after algorithm completes
      setTimeout(() => handleAIStateChange('idle'), 500)
    } catch (err) {
      setError(err.message || 'Failed to generate proof')
      setResult(null)
      handleAIStateChange('idle')
    }
  }, [])

  const handleReset = () => {
    setResult(null)
    setError(null)
    handleAIStateChange('idle')
  }

  // Helper to convert AST node to string
  const astToString = (node) => {
    if (node.type === 'atom') return node.name
    if (node.type === 'not') return `¬${astToString(node.child)}`
    
    const left = astToString(node.left)
    const right = astToString(node.right)
    
    if (node.type === 'and') return `${left}∧${right}`
    if (node.type === 'or') return `${left}∨${right}`
    if (node.type === 'implies') return `${left}→${right}`
    if (node.type === 'iff') return `${left}↔${right}`
    
    return ''
  }

  // If we have a result, show the canvas
  if (result) {
    return (
      <div className={styles.page}>
        <Starfield />
        <BackButton onClick={() => navigate('/home')} />
        <Navbar
          showNewFormula={true}
          onNewFormula={handleReset}
        />
        
        <main className={styles.main}>
          <div className={styles.canvasContainer}>
            <ProofTreeCanvas steps={result.steps} />
          </div>
          
          {/* Rules reference panel */}
          <LogicRulesPanel />
        </main>
        
        {/* Inference Rules Drawer */}
        <InferenceRulesDrawer 
          isOpen={isRulesDrawerOpen}
          onClose={() => setIsRulesDrawerOpen(false)}
        />
      </div>
    )
  }

  // Otherwise show input page
  return (
    <div className={styles.page}>
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />
      <Navbar />

      <main className={styles.main}>
        <motion.div 
          className={styles.container}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className={styles.title}>
            <ScrambleText duration={500} speed={125}>
              Logical Equivalence
            </ScrambleText>
          </h1>
          <p className={styles.subtitle}>
            <ScrambleText duration={500} speed={125}>
              enter your formula, add a comma followed by the conclusion if any
            </ScrambleText>
          </p>
          
          <PillInput
            activeTool="logic"
            onSubmit={handleSubmit}
            onAIStateChange={handleAIStateChange}
            placeholder="e.g. P→Q, Q→R, P→R"
            inputRef={inputRef}
          />
          
          {/* Error message */}
          {error && (
            <motion.div 
              className={styles.error}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </motion.div>
          )}
          
          <SymbolBar inputRef={inputRef} />
        </motion.div>
      </main>
    </div>
  )
}
