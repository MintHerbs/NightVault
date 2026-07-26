// ER Diagram Builder page - 3-step paginated flow
import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import ERDStep1 from '../../features/erd/components/ERDStep1/ERDStep1'
import ERDStep2 from '../../features/erd/components/ERDStep2/ERDStep2'
import ERDStep3 from '../../features/erd/components/ERDStep3/ERDStep3'
import ERDCanvas from '../../features/erd/components/ERDCanvas/ERDCanvas'
import { buildERDPrompt } from '../../lib/erdPromptBuilder'
import { parseERD } from '../../lib/erdParser'
import styles from './ERDPage.module.css'

function ERDPage({ onAIStateChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialQuestion = location.state?.question || ''
  
  const [step, setStep] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [parsedERD, setParsedERD] = useState(null)
  const [error, setError] = useState(false)

  // Cleanup: set to 'idle' when leaving the page
  useEffect(() => {
    return () => {
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('idle')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If question provided from landing page, generate prompt and advance to step 2
  useEffect(() => {
    if (initialQuestion) {
      const generatedPrompt = buildERDPrompt(initialQuestion)
      
      // Force synchronous state updates for instant transition
      flushSync(() => {
        setPrompt(generatedPrompt)
        setStep(2)
      })
      
      // Transition to 'waiting' state when advancing to step 2
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('waiting')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  // Step 1: User submits question
  const handleStep1Submit = (value) => {
    const generatedPrompt = buildERDPrompt(value)
    
    // Force synchronous state updates for instant transition
    flushSync(() => {
      setPrompt(generatedPrompt)
      setStep(2)
    })
    
    // Transition to 'waiting' state when advancing to step 2
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('waiting')
    }
  }

  // Step 2: User copies prompt and advances to step 3
  const handleStep2Next = () => {
    setStep(3)
  }

  // Step 3: User pastes JSON
  const handleStep3Submit = (value) => {
    // Show 'thinking' state immediately (synchronously, before any setState)
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('thinking')
    }
    
    // Use erdParser to validate
    const result = parseERD(value)
    
    if (result.valid) {
      // Store parsed data
      setParsedERD(result.data)
      setError(false)
      
      // After 3 seconds, collapse to 'idle'
      setTimeout(() => {
        if (typeof onAIStateChange === 'function') {
          onAIStateChange('idle')
        }
      }, 3000)
    } else {
      // Show error and reset to idle immediately
      setError(true)
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('idle')
      }
    }
  }

  // Previous button - go back one step
  const handlePrevious = () => {
    if (step === 2) {
      setStep(1)
      setError(false)
      // Back to observing state
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('observing')
      }
    } else if (step === 3) {
      setStep(2)
      setError(false)
      // Back to waiting state
      if (typeof onAIStateChange === 'function') {
        onAIStateChange('waiting')
      }
    }
  }

  // Reset ERD flow
  const handleReset = () => {
    setStep(1)
    setPrompt('')
    setParsedERD(null)
    setError(false)
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
    }
  }

  return (
    <div className={styles.erdPage}>
      {/* Starfield background - z-index: 0 */}
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />

      {/* Navbar */}
      {parsedERD ? (
        <Navbar 
          showNewFormula={true}
          onNewFormula={handleReset}
        />
      ) : (
        <Navbar />
      )}
      
      {/* Main content */}
      <main className={styles.erdMain}>
        {/* Previous button - show on steps 2 and 3 (before canvas renders) */}
        {(step === 2 || (step === 3 && !parsedERD)) && (
          <button className={styles.previousButton} onClick={handlePrevious}>
            Previous
          </button>
        )}
        
        {/* Step 1: User describes scenario */}
        {step === 1 && (
          <ERDStep1 
            initialQuestion={initialQuestion}
            onSubmit={handleStep1Submit}
            onAIStateChange={onAIStateChange}
            currentStep={1}
            totalSteps={3}
          />
        )}
        
        {/* Step 2: Copy prompt */}
        {step === 2 && (
          <ERDStep2 
            prompt={prompt}
            onNext={handleStep2Next}
            currentStep={2}
            totalSteps={3}
          />
        )}
        
        {/* Step 3: Paste JSON (before canvas renders) */}
        {step === 3 && !parsedERD && (
          <ERDStep3 
            onSubmit={handleStep3Submit}
            error={error}
            currentStep={3}
            totalSteps={3}
          />
        )}
        
        {/* Canvas: Rendered diagram (after JSON submission) */}
        {parsedERD && (
          <ERDCanvas erdData={parsedERD} />
        )}
      </main>
    </div>
  )
}

export default ERDPage
