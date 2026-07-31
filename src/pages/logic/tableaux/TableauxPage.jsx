// TableauxPage - semantic tableaux (truth tree) solver.
//
// The tableau is solved synchronously and then *played back*: the animation is the slow
// part, not the algorithm, so the island stays in its thinking state for as long as the
// tree is still being drawn rather than for a fixed 500ms after the solve (T-084).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnimationPlayer } from '../../../hooks/useAnimationPlayer'
import LogicInputPage from '../../../features/logic/components/LogicInputPage'
import TableauxCanvas from '../../../features/logic/components/TableauxCanvas'
import RulesPanel from '../../../features/logic/components/RulesPanel'
import LogicStepControls from '../../../features/logic/components/LogicStepControls'
import FormulaErrorCard from '../../../features/logic/components/FormulaErrorCard'
import Starfield from '../../../components/effects/Starfield/Starfield'
import Navbar from '../../../components/layout/Navbar/Navbar'
import BackButton from '../../../components/common/BackButton/BackButton'
import { runTableaux } from '../../../lib/logic/tableauxEngine'
import styles from './TableauxPage.module.css'

// Stable identity, so the player does not treat "no run yet" as a new run every render.
const NO_STEPS = []

const PLAYER_OPTIONS = {
  autoPlay: true,
  initialSpeed: 2,
  maxSpeed: 4,
  baseDelay: 900,
  // A tableau for a knotty formula can run to a thousand steps. Compress long runs so
  // the whole construction stays watchable instead of taking a quarter of an hour.
  maxTotalMs: 30000
}

// What the floating chrome covers, so the tree is framed in the part of the window that
// is actually clear: sidebar rail on the left, navbar above, transport bar below, rules
// trigger on the right. The canvas still paints edge to edge underneath all of it.
const CANVAS_INSETS = { top: 68, right: 76, bottom: 96, left: 88 }

const MODES = [
  { value: 'satisfiability', label: 'Satisfiable?', hint: 'Is there any assignment that makes it true?' },
  { value: 'validity', label: 'Valid?', hint: 'Is it true under every assignment?' }
]

export default function TableauxPage({ onAIStateChange }) {
  const navigate = useNavigate()
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [formula, setFormula] = useState('')
  const [mode, setMode] = useState('satisfiability')

  const player = useAnimationPlayer(run?.steps ?? NO_STEPS, PLAYER_OPTIONS)

  // App re-creates its handler on every render, so it is held in a ref and called
  // through a stable wrapper. Depending on the prop directly would re-fire the island
  // effects below on unrelated re-renders.
  const notifyRef = useRef(onAIStateChange)
  useEffect(() => { notifyRef.current = onAIStateChange }, [onAIStateChange])
  const setAIState = useCallback((state, message) => {
    if (typeof notifyRef.current === 'function') notifyRef.current(state, message)
  }, [])

  // The island tracks the construction, not the solve: thinking until the tree is fully
  // drawn, idle once it has settled. Keying this off `isPlaying` instead would flash
  // idle for a frame between the run landing and playback starting.
  const { isAtEnd } = player
  useEffect(() => {
    if (!run) return
    setAIState(isAtEnd ? 'idle' : 'thinking')
  }, [run, isAtEnd, setAIState])

  useEffect(() => () => setAIState('idle'), [setAIState])

  const handleSubmit = useCallback((value) => {
    const trimmed = (value || '').trim()
    if (trimmed.length === 0) return

    setFormula(trimmed)
    setRun(null)
    setError(null)
    setAIState('thinking')

    try {
      setRun(runTableaux(trimmed, mode))
    } catch (err) {
      // Only a FormulaError knows where it went wrong. Anything else (a tableau too
      // large to draw, say) falls back to length 0, which hides the caret rather than
      // pointing at an arbitrary character.
      setError({
        message: err.message || 'That formula could not be read.',
        position: err.position ?? 0,
        length: err.length ?? 0,
        hint: err.hint || ''
      })
      setAIState('idle')
    }
  }, [mode, setAIState])

  const handleEdit = useCallback(() => {
    setError(null)
    setRun(null)
    setAIState('idle')
  }, [setAIState])

  const handleUseExample = useCallback((example) => {
    setError(null)
    setRun(null)
    setFormula(example)
    setAIState('idle')
  }, [setAIState])

  const handleNewFormula = useCallback(() => {
    setRun(null)
    setError(null)
    setFormula('')
    setAIState('idle')
  }, [setAIState])

  // Held back until the construction reaches the end, so the answer is not sitting on
  // screen from the first frame.
  const verdict = run && isAtEnd ? run.result : ''

  const contradictionIds = useMemo(
    () => player.currentStep?.closedBy ?? null,
    [player.currentStep]
  )

  if (run) {
    return (
      <div className={styles.page}>
        <Starfield />
        {/* Back returns to the input rather than leaving the tool. That is what the
            navbar's "New Formula" button used to be for; the top right is now nothing
            but the rules drawer. */}
        <BackButton onClick={handleNewFormula} label="Back to the formula input" />
        <Navbar />

        <main className={styles.main}>
          <div className={styles.canvasContainer}>
            <TableauxCanvas
              tree={run.tree}
              stepIndex={player.currentStepIndex}
              highlightNodeId={player.currentStep?.highlightNodeId ?? null}
              contradictionIds={contradictionIds}
              insets={CANVAS_INSETS}
            />
          </div>

          <RulesPanel />
          <LogicStepControls player={player} verdict={verdict} />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <Starfield />
        <BackButton onClick={() => navigate('/home')} />
        <Navbar />
        <main className={styles.centeredMain}>
          <FormulaErrorCard
            error={error}
            formula={formula}
            onEdit={handleEdit}
            onUseExample={handleUseExample}
          />
        </main>
      </div>
    )
  }

  return (
    <div className={styles.inputWrapper}>
      <LogicInputPage
        title="Semantic Tableaux"
        subtitle="Enter a propositional formula and watch its truth tree build"
        placeholder="¬(¬(P∧Q)↔(¬P∨¬Q))"
        defaultValue={formula}
        onSubmit={handleSubmit}
        onAIStateChange={onAIStateChange}
      >
        <div className={styles.modeSelector} role="radiogroup" aria-label="What to test">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              className={`${styles.modeOption} ${mode === option.value ? styles.modeActive : ''}`}
              onClick={() => setMode(option.value)}
              title={option.hint}
            >
              {option.label}
            </button>
          ))}
        </div>
      </LogicInputPage>
    </div>
  )
}
