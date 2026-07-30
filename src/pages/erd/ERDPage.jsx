// ER Diagram Builder page.
//
// Primary path: the scenario goes to /api/gemini and the diagram renders directly.
// Fallback path: if generation is unavailable (not deployed, quota spent, offline)
// the original copy-the-prompt / paste-the-JSON steps take over, so the tool never
// hard-fails on someone mid-revision.
import { useState, useEffect, useRef } from 'react'
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
import { generateERD } from '../../lib/geminiService'
import styles from './ERDPage.module.css'

// Long enough to read the success state on the island before it collapses
const SUCCESS_HOLD_MS = 2000

function ERDPage({ onAIStateChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialQuestion = location.state?.question || ''

  const [step, setStep] = useState(1)
  const [question, setQuestion] = useState('')
  const [prompt, setPrompt] = useState('')
  const [parsedERD, setParsedERD] = useState(null)
  const [error, setError] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [fallbackReason, setFallbackReason] = useState(null)
  const [canRetry, setCanRetry] = useState(false)

  // Guards against resolving a generation after the user has navigated away
  const activeRequestRef = useRef(0)
  const successTimerRef = useRef(null)

  const setAIState = (state) => {
    if (typeof onAIStateChange === 'function') onAIStateChange(state)
  }

  useEffect(() => {
    return () => {
      activeRequestRef.current += 1
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      setAIState('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attempts automatic generation, dropping to the manual steps on any failure
  const runGeneration = async (value) => {
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId

    setQuestion(value)
    setPrompt(buildERDPrompt(value))
    setIsGenerating(true)
    setFallbackReason(null)
    setError(false)
    setAIState('generating')

    const result = await generateERD(value)
    if (activeRequestRef.current !== requestId) return // superseded or unmounted

    setIsGenerating(false)

    if (result.success) {
      setParsedERD(result.data)
      setAIState('idle')
      return
    }

    // Manual flow picks up from step 2 with the prompt already built
    setFallbackReason(result.error)
    setCanRetry(!result.terminal)
    setStep(2)
    setAIState('waiting')
  }

  // Question handed over from the landing page
  useEffect(() => {
    if (initialQuestion) runGeneration(initialQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  const handleStep1Submit = (value) => {
    runGeneration(value)
  }

  // Escape hatch from step 1: skip generation and go straight to the manual steps
  const handleUseManualFlow = (value) => {
    activeRequestRef.current += 1
    setQuestion(value)
    setPrompt(buildERDPrompt(value))
    setIsGenerating(false)
    setFallbackReason(null)
    setCanRetry(false)
    setStep(2)
    setAIState('waiting')
  }

  const handleStep2Next = () => {
    setStep(3)
  }

  // Step 3: user pastes JSON they generated elsewhere
  const handleStep3Submit = (value) => {
    setAIState('thinking')
    const result = parseERD(value)

    if (result.valid) {
      setParsedERD(result.data)
      setError(false)
      successTimerRef.current = setTimeout(() => setAIState('idle'), SUCCESS_HOLD_MS)
    } else {
      setError(true)
      setAIState('idle')
    }
  }

  const handlePrevious = () => {
    if (step === 2) {
      setStep(1)
      setError(false)
      setFallbackReason(null)
      setAIState('observing')
    } else if (step === 3) {
      setStep(2)
      setError(false)
      setAIState('waiting')
    }
  }

  const handleReset = () => {
    activeRequestRef.current += 1
    setStep(1)
    setQuestion('')
    setPrompt('')
    setParsedERD(null)
    setError(false)
    setIsGenerating(false)
    setFallbackReason(null)
    setCanRetry(false)
    setAIState('observing')
  }

  const showPrevious = !parsedERD && (step === 2 || step === 3)

  return (
    <div className={styles.erdPage}>
      {/* Local instance, with comets off so the permanent rAF loop doesn't
          compete with canvas dragging. It has to be rendered here rather than
          relying on App.jsx's global one, because .erdPage paints an opaque
          background over that. App.jsx skips the global one for this route. */}
      <Starfield comets={false} />
      <BackButton onClick={() => navigate('/home')} />

      {parsedERD ? (
        <Navbar showNewFormula={true} newFormulaText="New Question" onNewFormula={handleReset} />
      ) : (
        <Navbar />
      )}

      <main className={styles.erdMain}>
        {showPrevious && (
          <button className={styles.previousButton} onClick={handlePrevious}>
            Previous
          </button>
        )}

        {step === 1 && !parsedERD && (
          <ERDStep1
            initialQuestion={initialQuestion}
            onSubmit={handleStep1Submit}
            onUseManualFlow={handleUseManualFlow}
            isGenerating={isGenerating}
            onAIStateChange={onAIStateChange}
            currentStep={1}
            totalSteps={3}
          />
        )}

        {step === 2 && !parsedERD && (
          <ERDStep2
            prompt={prompt}
            onNext={handleStep2Next}
            fallbackReason={fallbackReason}
            onRetry={canRetry ? () => runGeneration(question) : null}
            currentStep={2}
            totalSteps={3}
          />
        )}

        {step === 3 && !parsedERD && (
          <ERDStep3
            onSubmit={handleStep3Submit}
            error={error}
            currentStep={3}
            totalSteps={3}
          />
        )}

        {parsedERD && <ERDCanvas erdData={parsedERD} />}
      </main>
    </div>
  )
}

export default ERDPage
