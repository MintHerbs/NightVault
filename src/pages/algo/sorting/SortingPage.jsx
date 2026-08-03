// Sorting Algo (T-105).
//
// Landing screen is the app's standard three things in the standard order
// (docs/rules.md §14.1): ScrambleText title, subtitle, shared pill. The method
// and order selectors sit beside it, which §14.2 allows.
//
// The result view is canvas + listing + transport. Every frame is one atomic
// action, so the transport's step buttons walk a comparison, a pointer move and
// each of the three beats of a swap one at a time.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../../../components/common/BackButton/BackButton'
import Starfield from '../../../components/effects/Starfield/Starfield'
import Navbar from '../../../components/layout/Navbar/Navbar'
import PillInput from '../../../components/ui/PillInput/PillInput'
import { ScrambleText } from '../../../components/ui/ScrambleText'
import StepControls from '../../../components/ui/StepControls/StepControls'
import PseudocodePane from '../../../features/sorting/components/PseudocodePane/PseudocodePane'
import RunOptions from '../../../features/sorting/components/RunOptions/RunOptions'
import SortCanvas from '../../../features/sorting/components/SortCanvas/SortCanvas'
import { useAnimationPlayer } from '../../../hooks/useAnimationPlayer'
import { trackToolEvent } from '../../../lib/analytics/tracker'
import {
  ASC,
  DEFAULT_METHOD,
  METHOD_BY_ID,
  expectedResult,
  parseSortInput,
  traceSort,
} from '../../../lib/algo/sorting'
import styles from './SortingPage.module.css'

/** Stable identity, so the player does not read "no run yet" as a new run. */
const NO_STEPS = []

const PLAYER_OPTIONS = {
  autoPlay: true,
  initialSpeed: 2,
  maxSpeed: 4,
  baseDelay: 700,
  // Bubble sort at the 24-value cap runs to roughly 1150 steps. At a flat
  // 700ms that is thirteen minutes; compressed, the whole run fits a minute at
  // 1x and a quarter of that at 4x, and the scrubber covers the rest.
  maxTotalMs: 60000,
}

const EXAMPLES = [
  { label: 'Lecture example', values: '2, 8, 4, 7, 1, 3, 9, 6, 5' },
  { label: 'Already sorted', values: '1, 2, 3, 4, 5, 6, 7, 8' },
  { label: 'Reverse sorted', values: '9, 8, 7, 6, 5, 4, 3, 2' },
  { label: 'With duplicates', values: '5, 2, 8, 2, 5, 9, 2, 5' },
]

function randomArray() {
  const length = 8 + Math.floor(Math.random() * 3)
  return Array.from({ length }, () => Math.floor(Math.random() * 90) + 1).join(', ')
}

export default function SortingPage({ onAIStateChange }) {
  const navigate = useNavigate()

  const [view, setView] = useState('input')
  const [inputValue, setInputValue] = useState('')
  const [method, setMethod] = useState(DEFAULT_METHOD)
  const [direction, setDirection] = useState(ASC)
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [steps, setSteps] = useState(NO_STEPS)

  const player = useAnimationPlayer(steps, PLAYER_OPTIONS)

  // PillInput clears itself on submit (it calls onValueChange('') straight
  // after onSubmit), so the text has to be kept here to put back when someone
  // is correcting a rejected array rather than starting a new one.
  const lastRawRef = useRef('')

  // App recreates its handler every render, so calling the prop directly would
  // re-fire the island effects on unrelated re-renders (docs/rules.md §15.3).
  const notifyRef = useRef(onAIStateChange)
  useEffect(() => {
    notifyRef.current = onAIStateChange
  }, [onAIStateChange])
  const setAIState = useCallback((state, message = '') => {
    if (typeof notifyRef.current === 'function') notifyRef.current(state, message)
  }, [])

  // The island tracks the animation, not the computation: a 9-value trace is
  // built in well under a millisecond, so clearing on completion would paint
  // nothing at all (§15.4). It holds for as long as the canvas is still moving.
  const { hasSteps, isAtEnd } = player
  useEffect(() => {
    if (error) return
    setAIState(hasSteps && !isAtEnd ? 'thinking' : 'idle')
  }, [hasSteps, isAtEnd, error, setAIState])

  // Never leave the pill stranded mid-animation (§15.2).
  useEffect(() => () => setAIState('idle'), [setAIState])

  const handleSubmit = (raw) => {
    // Counted here rather than on the success path, so it counts attempts. A
    // rejected array is still someone using the tool, and attempts far
    // exceeding runs is itself the signal that the limits are wrong.
    trackToolEvent('sorting', 'run')
    lastRawRef.current = raw
    const { values, error: parseError } = parseSortInput(raw, method)

    if (parseError) {
      setError(parseError)
      setRun(null)
      setSteps(NO_STEPS)
      setView('result')
      // No ack here: this already moves the island, and two signals for one
      // press is the island talking over itself (§15.5).
      setAIState('error', parseError)
      return
    }

    setError(null)
    setRun({ values, method, direction })
    setSteps(traceSort(values, method, direction))
    setView('result')
    setAIState('thinking')
  }

  const handleReset = (keepInput = false) => {
    setView('input')
    setRun(null)
    setError(null)
    setSteps(NO_STEPS)
    setInputValue(keepInput ? lastRawRef.current : '')
    setAIState('idle')
  }

  const useExample = (values) => {
    setInputValue(values)
    setAIState('observing')
  }

  const activeMethod = METHOD_BY_ID.get(run?.method || method)

  const summary = useMemo(() => {
    if (!run) return null
    return expectedResult(run.values, run.direction).join(', ')
  }, [run])

  if (view === 'input') {
    return (
      <div className={styles.container}>
        <Starfield />
        <BackButton onClick={() => navigate('/home')} />
        <Navbar />
        <main className={styles.landingCenter}>
          <div className={styles.heroContainer}>
            <h1 className={styles.title}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation>
                Sorting Algo
              </ScrambleText>
            </h1>
            <p className={styles.subtitle}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation>
                Enter the numbers you want sorted
              </ScrambleText>
            </p>
          </div>

          <PillInput
            value={inputValue}
            onValueChange={setInputValue}
            onSubmit={handleSubmit}
            onAIStateChange={setAIState}
            placeholder="2, 8, 4, 7, 1, 3, 9, 6, 5"
          />

          {/* Nothing to type before seeing what the tool does. The first chip is
              the array from the lecture the Quicksort trace reproduces. */}
          <div className={styles.examples}>
            <span className={styles.examplesLabel}>Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className={styles.exampleChip}
                onClick={() => useExample(example.values)}
                title={example.values}
              >
                {example.label}
              </button>
            ))}
            <button
              type="button"
              className={styles.exampleChip}
              onClick={() => useExample(randomArray())}
            >
              Shuffle
            </button>
          </div>

          <RunOptions
            method={method}
            direction={direction}
            onMethodChange={setMethod}
            onDirectionChange={setDirection}
          />
        </main>
      </div>
    )
  }

  return (
    <div className={styles.resultPage}>
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />
      <Navbar
        showTitle
        title="Sorting Algo"
        showNewFormula
        onNewFormula={() => handleReset(false)}
        newFormulaText="New array"
      />

      {error ? (
        <div className={styles.errorContainer}>
          <div className={styles.errorBox}>
            <h3 className={styles.errorTitle}>Cannot sort that</h3>
            <p className={styles.errorMessage}>{error}</p>
            <button className={styles.retryButton} onClick={() => handleReset(true)}>
              ← Edit these numbers
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.splitPanel}>
          <div className={styles.canvasPanel}>
            <div className={styles.runLabel}>
              <span className={styles.runMethod}>{activeMethod?.label}</span>
              <span className={styles.runDirection}>
                {run?.direction === ASC ? 'ascending' : 'descending'}
              </span>
              <span className={styles.runTarget}>→ {summary}</span>
            </div>

            <SortCanvas step={player.currentStep} values={run?.values || []} />

            {player.hasSteps && (
              <StepControls
                player={player}
                accent="var(--sort-sorted)"
                onAccent="var(--md-on-primary, var(--color-bg))"
                skipLabel="Skip to the sorted array"
              />
            )}
          </div>

          <div className={styles.codePanel}>
            <PseudocodePane
              method={run?.method || method}
              direction={run?.direction || direction}
              activeLine={player.currentStep?.codeLine ?? 0}
              blurb={activeMethod?.blurb}
            />
          </div>
        </div>
      )}
    </div>
  )
}
