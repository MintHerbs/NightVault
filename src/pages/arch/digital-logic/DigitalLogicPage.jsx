/**
 * DigitalLogicPage - the Digital Logic Lab (T-089).
 *
 * Each of the four modes (algebra, kmap, sandbox, fsm) is its own card on the
 * course landing page / home page (src/constants/tools.js) rather than a
 * dropdown inside this page — `?mode=` is still what selects one, there is
 * just no in-page switcher left to set it.
 *
 * Everything below the input is synchronous and local. No network call, no
 * Gemini, no quota: an expression to a minimised circuit is deterministic, and
 * making it an API call would be slower, less reliable, and no more correct.
 * That is only true of modes 1 to 3; mode 4 is the one that needs a model.
 *
 * See docs/specs/digital-logic.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAIState from '../../../hooks/useAIState'
import { dockIsland, DOCK_BOTTOM_RIGHT } from '../../../hooks/useIslandDock'
import ExpressionInput from '../../../features/circuits/components/ExpressionInput/ExpressionInput'
import BackButton from '../../../components/common/BackButton/BackButton'
import { DEFAULT_MODE, isKnownMode, isReadyMode, modeById } from '../../../features/circuits/components/ModeSelect/ModeSelect'
import StageRail from '../../../features/circuits/components/StageRail/StageRail'
import TruthTableView from '../../../features/circuits/components/TruthTableView/TruthTableView'
import KMapView from '../../../features/circuits/components/KMapView/KMapView'
import MinimalFormView from '../../../features/circuits/components/MinimalFormView/MinimalFormView'
import CircuitErrorCard from '../../../features/circuits/components/CircuitErrorCard/CircuitErrorCard'
import AlgebraStepsView from '../../../features/circuits/components/AlgebraStepsView/AlgebraStepsView'
import CircuitSandbox from '../../../features/circuits/components/CircuitSandbox/CircuitSandbox'
import FsmView from '../../../features/circuits/components/FsmView/FsmView'
import { Button, SegmentedButton, md } from '../../../features/circuits/components/md'
import { analyse } from '../../../lib/circuits/truthTable'
import { minimize } from '../../../lib/circuits/quineMcCluskey'
import { synthesize } from '../../../lib/circuits/circuitSynthesis'
import { binarize } from '../../../lib/circuits/binarize'
import { layoutCircuit } from '../../../lib/circuits/circuitLayout'
import { fromNetlist } from '../../../lib/circuits/sandboxModel'
import { formatFullyParenthesised } from '../../../lib/circuits/expressionParser'
import { simplify } from '../../../lib/circuits/algebraSimplifier'
import { trackToolEvent } from '../../../lib/analytics/tracker'
import styles from './DigitalLogicPage.module.css'

const STAGES = [
  { id: 'table', label: 'Truth table' },
  { id: 'kmap', label: 'K-map' },
  { id: 'expression', label: 'Expression' },
  { id: 'circuit', label: 'Circuit' },
]

export default function DigitalLogicPage({ onAIStateChange }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // An unknown ?mode= is treated as absent rather than passed through: a stale
  // or mistyped link should land on the working mode, not on a blank panel.
  const requested = params.get('mode')
  const mode = isKnownMode(requested) ? requested : DEFAULT_MODE

  const [source, setSource] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [stage, setStage] = useState('table')
  const [unlocked, setUnlocked] = useState(1)
  const [coverIndex, setCoverIndex] = useState(0)
  const [form, setForm] = useState('sop')
  const [style, setStyle] = useState('basic')
  const [highlight, setHighlight] = useState(null)
  // Set only by the "Open full screen" handoff; null means the sandbox
  // restores whatever the student was last working on.
  const [handoff, setHandoff] = useState(null)
  // Which mode handed the student into full-screen sandbox, so the sandbox's
  // own back control can return them to the truth table, K-map, or state
  // machine they came from instead of always landing on the default mode.
  // Null means the sandbox was reached directly (a URL, a bookmark, its own
  // entry point) rather than via a handoff, so back goes to Home instead.
  const [sandboxOrigin, setSandboxOrigin] = useState(null)

  // Stable setter plus the minimum dwell, both from the shared hook
  // (docs/rules.md §15.3, §15.4). Returning to idle on unmount is the hook's
  // job too, so there is no separate cleanup effect here.
  const { setAIState, hold, release } = useAIState(onAIStateChange)

  useEffect(() => { trackToolEvent('digital-logic', 'open') }, [])

  // The full-screen canvas needs the top centre for its own navbar, so the pill
  // flies to the bottom-right corner for as long as this mode is showing.
  useEffect(() => {
    if (mode !== 'sandbox') return undefined
    return dockIsland(DOCK_BOTTOM_RIGHT)
  }, [mode])

  // A free-running circuit is genuinely working, so the island says so (owner
  // request). It is not held for a step or a single toggle — those finish in
  // one frame and the sweep animation is the feedback there.
  const handleRunningChange = useCallback((running) => {
    setAIState(running ? 'thinking' : 'idle')
  }, [setAIState])

  const handleModeChange = useCallback((next) => {
    setParams(next === DEFAULT_MODE ? {} : { mode: next }, { replace: true })
    trackToolEvent('digital-logic', `mode-${next}`)
  }, [setParams])

  const solve = useCallback((raw) => {
    const text = (raw ?? '').trim()
    if (!text) return

    // Held rather than set: analyse() and minimize() are synchronous, so
    // without the dwell the island is told to think and stop thinking inside
    // one frame and paints nothing at all.
    hold('thinking')
    setSource(text)
    setHighlight(null)
    setCoverIndex(0)

    try {
      const { table, ast } = analyse(text)
      setResult({ table, ast })
      setError(null)
      setStage('table')
      setUnlocked(1)
      trackToolEvent('digital-logic', 'solve')
    } catch (err) {
      // Anything the engines throw is an ExpressionError carrying a position,
      // so the card can underline the exact slice that failed.
      setResult(null)
      setError({
        message: err.message,
        position: err.position ?? 0,
        length: err.length ?? 1,
        hint: err.hint ?? '',
      })
    } finally {
      release()
    }
  }, [hold, release])

  // Recomputed rather than stored: changing the form or the cover must not be
  // able to leave a stale circuit on screen beside a fresh K-map.
  const solution = useMemo(
    () => (result ? minimize(result.table, { form }) : null),
    [result, form]
  )

  // Binarised on the way out: the course teaches two-input gates, and a
  // four-literal product term otherwise synthesises to one four-input AND
  // (T-093). The rewrite is equivalence-checked against the wide netlist over
  // the whole truth table in binarize.test.js.
  const netlist = useMemo(
    () => (solution ? binarize(synthesize(solution, { coverIndex, style })) : null),
    [solution, coverIndex, style]
  )

  // Algebra mode reuses the same parsed expression as the K-map mode, so
  // switching between them never re-asks the question. Only computed when that
  // mode is showing: the rewrite search is the one expensive thing here.
  const algebra = useMemo(
    () => (mode === 'algebra' && result?.ast ? simplify(result.ast) : null),
    [mode, result]
  )

  // The synthesised circuit as an editable document. Rebuilt whenever the
  // netlist changes shape, and keyed on the same signature so switching form or
  // cover replaces the canvas rather than leaving stale edits over a new
  // circuit.
  const circuitDocument = useMemo(
    () => (netlist ? fromNetlist(netlist, layoutCircuit(netlist)) : null),
    [netlist]
  )
  const circuitKey = `${form}:${style}:${coverIndex}:${source}`

  // A cover index from the previous form may not exist under the new one.
  useEffect(() => {
    if (solution && coverIndex >= solution.covers.length) setCoverIndex(0)
  }, [solution, coverIndex])

  const reset = () => {
    setResult(null)
    setError(null)
    setSource('')
    setStage('table')
    setUnlocked(1)
    // Idle, not observing: nothing has focus yet. The pill announces itself
    // when the student actually clicks into the field.
    setAIState('idle')
  }

  const selectStage = (id) => {
    const index = STAGES.findIndex(s => s.id === id)
    if (index < 0) return
    setStage(id)
    setUnlocked(current => Math.max(current, index + 1))
    trackToolEvent('digital-logic', 'step')
  }

  // The expression-driven modes are the ones that share the question input and
  // the four-stage rail. Sandbox and FSM each own their whole surface.
  const isExpressionMode = mode !== 'sandbox' && mode !== 'fsm'

  const kmapUnsupported = solution && solution.vars.length > 5

  // Full-screen mode: the canvas *is* the page. No navbar, no sidebar, no
  // Starfield — every control floats over the canvas from inside the sandbox
  // itself, which is the FigJam shape T-093 asked for. The back arrow lives in
  // the transport dock.
  //
  // Rendered as a sibling of the normal shell rather than an early return that
  // replaces it, and the normal shell is hidden with CSS rather than removed:
  // the state machine mode owns its own local state (the FSM, which stage it
  // is on, encoding, flip-flop), and unmounting FsmView to show the sandbox
  // would throw all of that away, so "back" could never return a student to
  // the machine they were looking at. Hiding instead of unmounting keeps it
  // alive underneath.
  const backFromSandbox = () => {
    const origin = sandboxOrigin
    setSandboxOrigin(null)
    setHandoff(null)
    if (origin) handleModeChange(origin)
    else navigate('/home')
  }

  return (
    <>
      <div className={styles.page} style={mode === 'sandbox' ? { display: 'none' } : undefined}>
      <div className={styles.shell}>
        <BackButton onClick={() => navigate('/home')} />

        {/* No mode switcher left here (owner decision): each mode is its own
            card on the course landing page / home page, not a dropdown inside
            this one. "New question" is the only thing left that belongs in
            this slot — it only makes sense once there is a question. */}
        {result && (
          <div className={styles.modeBar}>
            <Button variant="text" onClick={reset}>New question</Button>
          </div>
        )}

        <main className={styles.main}>
        {/* A mode that is listed but not built yet gets its own panel. Falling
            through to the expression input would accept a question this mode
            cannot answer and then silently answer a different one. */}
        {isExpressionMode && !isReadyMode(mode) && (
          <div className={styles.pending}>
            <h2 className={`${styles.pendingTitle} ${md.headlineSmall}`}>
              {modeById(mode).label} is not built yet
            </h2>
            <p className={`${styles.pendingBody} ${md.bodyMedium} ${md.variantText}`}>
              {modeById(mode).hint}.
            </p>
            <Button variant="tonal" onClick={() => handleModeChange(DEFAULT_MODE)}>
              Use Truth table &amp; K-map
            </Button>
          </div>
        )}

        {/* The state machine mode owns its own flow: it has a network call, a
            manual fallback, and controls that change every stage below it. Kept
            mounted (just not the active mode) while the student is in
            full-screen sandbox via this mode's own handoff, so its state
            survives the round trip. */}
        {(mode === 'fsm' || sandboxOrigin === 'fsm') && (
          <div className={styles.sandbox} style={mode === 'fsm' ? undefined : { display: 'none' }}>
            <FsmView
              onAIStateChange={setAIState}
              onOpenSandbox={(built) => {
                const narrow = binarize(built)
                setSandboxOrigin('fsm')
                setHandoff(fromNetlist(narrow, layoutCircuit(narrow)))
                handleModeChange('sandbox')
                trackToolEvent('digital-logic', 'to-sandbox')
              }}
            />
          </div>
        )}

        {isExpressionMode && isReadyMode(mode) && !result && !error && (
          <ExpressionInput
            mode={mode}
            onSubmit={solve}
            onAIStateChange={setAIState}
          />
        )}

        {isExpressionMode && isReadyMode(mode) && error && (
          <CircuitErrorCard
            error={error}
            source={source}
            onEdit={reset}
            onUseExample={(example) => { setError(null); solve(example) }}
          />
        )}

        {isExpressionMode && isReadyMode(mode) && result && solution && (
          <div className={styles.result}>
            <header className={styles.header}>
              <div className={styles.echo}>
                <span className={`${styles.echoLabel} ${md.labelMedium} ${md.variantText}`}>Read as</span>
                <code className={styles.echoValue}>
                  {result.ast ? formatFullyParenthesised(result.ast) : source}
                </code>
              </div>
            </header>

            <div className={styles.toggles}>
              {/* SOP/POS picks which form the K-map is minimised into, so it
                  has nothing to change in algebra mode, where the laws work on
                  the expression as written. */}
              {mode !== 'algebra' && (
                <div className={styles.toggle}>
                  <span className={`${styles.toggleLabel} ${md.labelMedium} ${md.variantText}`}>Form</span>
                  <SegmentedButton
                    label="Output form"
                    options={[{ id: 'sop', label: 'SOP' }, { id: 'pos', label: 'POS' }]}
                    value={form}
                    onChange={setForm}
                  />
                </div>
              )}
              {stage === 'circuit' && (
                <div className={styles.toggle}>
                  <span className={`${styles.toggleLabel} ${md.labelMedium} ${md.variantText}`}>Gates</span>
                  <SegmentedButton
                    label="Gate style"
                    options={[
                      { id: 'basic', label: 'AND / OR / NOT' },
                      { id: 'universal', label: form === 'pos' ? 'NOR only' : 'NAND only' },
                    ]}
                    value={style}
                    onChange={setStyle}
                  />
                </div>
              )}
            </div>

            {mode === 'algebra' ? (
              <section className={styles.stage}>
                {algebra
                  ? <AlgebraStepsView run={algebra} />
                  : (
                    <p className={`${styles.footnote} ${md.bodyMedium}`}>
                      The step-by-step laws need an expression. A minterm list has no algebra to
                      work on, so switch to Truth table &amp; K-map for this input.
                    </p>
                  )}
              </section>
            ) : (
              <>
            <StageRail
              stages={STAGES}
              active={stage}
              unlocked={unlocked}
              onSelect={selectStage}
              onRevealAll={() => { setUnlocked(STAGES.length); trackToolEvent('digital-logic', 'step') }}
            />

            <section className={styles.stage}>
              {stage === 'table' && (
                <TruthTableView
                  table={result.table}
                  highlight={highlight}
                  onHighlight={setHighlight}
                />
              )}

              {stage === 'kmap' && (
                <KMapView
                  table={result.table}
                  solution={solution}
                  coverIndex={coverIndex}
                  onCoverChange={setCoverIndex}
                  highlight={highlight}
                  onHighlight={setHighlight}
                />
              )}

              {stage === 'expression' && (
                <MinimalFormView
                  solution={solution}
                  coverIndex={coverIndex}
                  original={source}
                />
              )}

              {/* Editable in place rather than a picture with a button under it
                  (owner request). The synthesised netlist is already the shape
                  the sandbox edits, so this is the same circuit, not a copy of
                  it — the student can drag it about and run it without leaving
                  the stage they are working. Not persisted: this is scratch
                  space belonging to one question, and autosaving it would
                  overwrite whatever they have built in the sandbox proper. */}
              {stage === 'circuit' && netlist && (
                <div className={styles.circuitStage}>
                  <CircuitSandbox
                    key={circuitKey}
                    variant="embedded"
                    persist={false}
                    initialDocument={circuitDocument}
                  />
                  <Button
                    variant="tonal"
                    onClick={() => {
                      setSandboxOrigin('kmap')
                      setHandoff(circuitDocument)
                      handleModeChange('sandbox')
                      trackToolEvent('digital-logic', 'to-sandbox')
                    }}
                  >
                    Open full screen
                  </Button>
                </div>
              )}
            </section>

              </>
            )}

            {mode !== 'algebra' && kmapUnsupported && stage === 'table' && (
              <p className={`${styles.footnote} ${md.bodySmall}`}>
                {solution.vars.length} variables is past what a K-map can show. The other
                stages still work: the minimisation never needed the map.
              </p>
            )}
          </div>
        )}
        </main>
      </div>
      </div>

      {mode === 'sandbox' && (
        <div className={`${styles.page} ${styles.pageFull}`}>
          <CircuitSandbox
            variant="full"
            initialDocument={handoff}
            onBack={backFromSandbox}
            onRunningChange={handleRunningChange}
            onDocumentChange={() => trackToolEvent('digital-logic', 'simulate')}
          />
        </div>
      )}
    </>
  )
}

