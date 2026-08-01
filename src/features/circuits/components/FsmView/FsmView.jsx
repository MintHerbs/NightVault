/**
 * FsmView - the whole state-machine mode (T-089 phase 3).
 *
 * Owns the question, the generation call, and the five stages that follow it.
 * Kept out of DigitalLogicPage because this mode's flow is genuinely different
 * from the expression modes: it has a network call, a manual fallback, and its
 * own controls (encoding, flip-flop type) that change every downstream stage.
 *
 * Only the English-to-FSM step is a model call. State assignment, excitation
 * tables, K-maps and the circuit are all derived by fsmSynthesis.js, where they
 * are covered by an oracle test that simulates the synthesised circuit against
 * the FSM it came from.
 */
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ScrambleText } from '../../../../components/ui/ScrambleText'
import PillInput from '../../../../components/ui/PillInput/PillInput'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import FsmCopyStep from '../FsmManualSteps/FsmCopyStep'
import FsmPasteStep from '../FsmManualSteps/FsmPasteStep'
import StageRail from '../StageRail/StageRail'
import StateDiagramView from '../StateDiagramView/StateDiagramView'
import StateTableView from '../StateTableView/StateTableView'
import KMapView from '../KMapView/KMapView'
import CircuitSandbox from '../CircuitSandbox/CircuitSandbox'
import { Button, Chip, SegmentedButton, md } from '../md'
import { generateFSM } from '../../../../lib/circuits/fsmService'
import { buildFSMPrompt } from '../../../../lib/circuits/fsmPromptBuilder'
import { parseFSM, completeWithSelfLoops } from '../../../../lib/circuits/fsmParser'
import { synthesizeFSM, equivalentStates, ENCODINGS, ENCODING_LABELS } from '../../../../lib/circuits/fsmSynthesis'
import { FLIP_FLOP_KINDS, FLIP_FLOP_LABELS } from '../../../../lib/circuits/flipFlops'
import { binarize } from '../../../../lib/circuits/binarize'
import { layoutCircuit } from '../../../../lib/circuits/circuitLayout'
import { fromNetlist } from '../../../../lib/circuits/sandboxModel'
import styles from './FsmView.module.css'

const STAGES = [
  { id: 'diagram', label: 'State diagram' },
  { id: 'table', label: 'State table' },
  { id: 'kmaps', label: 'K-maps' },
  { id: 'circuit', label: 'Circuit' },
]

export default function FsmView({ onAIStateChange, onOpenSandbox }) {
  const [question, setQuestion] = useState('')
  const [fsm, setFsm] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [status, setStatus] = useState('idle')
  const [failure, setFailure] = useState(null)
  // Manual flow position: 1 asks the question, 2 hands over the prompt, 3 takes
  // the JSON back. Same three-step carousel as ERD, because it is the same job.
  const [step, setStep] = useState(1)
  const [manualReason, setManualReason] = useState(null)

  const [stage, setStage] = useState('diagram')
  const [unlocked, setUnlocked] = useState(1)
  const [encoding, setEncoding] = useState('binary')
  const [flipFlop, setFlipFlop] = useState('dff')
  const [functionIndex, setFunctionIndex] = useState(0)

  const setAI = (state) => { if (typeof onAIStateChange === 'function') onAIStateChange(state) }

  const design = useMemo(
    () => (fsm ? synthesizeFSM(fsm, { encoding, flipFlop }) : null),
    [fsm, encoding, flipFlop]
  )
  const equivalents = useMemo(() => (fsm ? equivalentStates(fsm) : []), [fsm])

  // Editable in place rather than a picture with a button under it (same call
  // as the K-map mode's circuit stage). Binarised on the way in: the course
  // teaches two-input gates, and the synthesised netlist has one gate per
  // product term, which can be wider than that.
  const circuitDocument = useMemo(() => {
    if (!design) return null
    const narrow = binarize(design.netlist)
    return fromNetlist(narrow, layoutCircuit(narrow))
  }, [design])
  const circuitKey = fsm ? `${encoding}:${flipFlop}:${fsm.title}` : ''

  const accept = (next, extraWarnings = []) => {
    setFsm(next)
    setWarnings(extraWarnings)
    setFailure(null)
    setStage('diagram')
    setUnlocked(1)
    setFunctionIndex(0)
  }

  const generate = async (value) => {
    const text = (value ?? question).trim()
    if (!text) return

    setQuestion(text)
    setStatus('generating')
    setAI('generating')
    setFailure(null)

    const result = await generateFSM(text)
    setStatus('idle')

    if (result.success) { setAI('idle'); accept(result.fsm, result.warnings); return }

    // Generation is unavailable in `vite dev` and on a locked-down network. A
    // revision tool that hard-fails there is worse than one that walks the
    // student through doing it themselves, so a failure drops straight into the
    // manual flow rather than leaving them on a dead end (same call as ERD).
    setFailure(result)
    setManualReason(result.error)
    setStep(2)
    setAI('waiting')
  }

  /** Deliberate escape hatch, as opposed to being pushed here by a failure. */
  const useManualFlow = () => {
    if (!question.trim()) return
    setFailure(null)
    setManualReason(null)
    setStep(2)
    setAI('waiting')
  }

  const acceptPasted = (text) => {
    setAI('thinking')
    const parsed = parseFSM(text)
    if (!parsed.valid) {
      setFailure({ error: parsed.error, terminal: false, detail: parsed.detail, manual: true })
      setAI('observing')
      return
    }
    setFailure(null)
    setAI('idle')
    accept(parsed.fsm, parsed.warnings)
  }

  const backToQuestion = () => {
    setStep(1)
    setFailure(null)
    setManualReason(null)
    setAI('observing')
  }

  // --- Input -----------------------------------------------------------------

  if (!fsm && step === 2) {
    return (
      <FsmCopyStep
        prompt={buildFSMPrompt(question)}
        reason={manualReason}
        onRetry={manualReason ? () => { setStep(1); generate(question) } : null}
        onBack={backToQuestion}
        onNext={() => { setStep(3); setAI('waiting') }}
      />
    )
  }

  if (!fsm && step === 3) {
    return (
      <FsmPasteStep
        onSubmit={acceptPasted}
        onBack={() => { setStep(2); setAI('waiting') }}
        failure={failure}
        onAIStateChange={onAIStateChange}
      />
    )
  }

  if (!fsm) {
    return (
      <motion.div
        className={styles.input}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      >
        <h1 className={styles.title}>
          <ScrambleText duration={500} speed={125}>State Machine</ScrambleText>
        </h1>
        <p className={styles.subtitle}>
          <ScrambleText duration={500} speed={125}>describe your scenario below</ScrambleText>
        </p>

        <PillInput
          activeTool="digital-logic"
          placeholder="e.g. A vending machine takes nickels and dimes and vends once it has 20 cents or more..."
          value={question}
          onValueChange={setQuestion}
          onSubmit={generate}
          onAIStateChange={onAIStateChange}
          disabled={status === 'generating'}
        />

        <p className={`${styles.supporting} ${md.bodySmall} ${md.variantText}`}>
          {status === 'generating' ? 'Working on it…' : 'One or two sentences is enough.'}
        </p>

        {/* Never disabled on an empty box: a greyed-out link that swallows the
            click reads as the page being broken (same call as ERDStep1). */}
        {status === 'idle' && (
          <button type="button" className={styles.manualLink} onClick={useManualFlow}>
            Use my own LLM instead
          </button>
        )}

        <PaginationDots total={3} current={1} />
      </motion.div>
    )
  }

  // --- Result ----------------------------------------------------------------

  const selectStage = (id) => {
    const index = STAGES.findIndex(s => s.id === id)
    if (index < 0) return
    setStage(id)
    setUnlocked(current => Math.max(current, index + 1))
  }

  const activeFunction = design.functions[Math.min(functionIndex, design.functions.length - 1)]

  return (
    <div className={styles.result}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={`${md.labelMedium} ${md.variantText}`}>{fsm.machineType} machine</span>
          <h2 className={md.titleMedium}>{fsm.title}</h2>
        </div>
        <div className={styles.headerActions}>
          <Button variant="text" onClick={() => { setFsm(null); setQuestion('') }}>New question</Button>
        </div>
      </header>

      {(warnings.length > 0 || equivalents.length > 0) && (
        <div className={styles.notices}>
          {warnings.map((warning, i) => (
            <p key={i} className={md.bodySmall}>{warning}</p>
          ))}
          {equivalents.map((group, i) => (
            <p key={`eq${i}`} className={md.bodySmall}>
              {group.join(' and ')} behave identically, so the machine could be reduced. Left as
              written, because the question may have asked for it this way.
            </p>
          ))}
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={`${md.labelMedium} ${md.variantText}`}>Encoding</span>
          <SegmentedButton
            label="State encoding"
            options={ENCODINGS.map(id => ({ id, label: ENCODING_LABELS[id] }))}
            value={encoding}
            onChange={setEncoding}
          />
        </div>
        <div className={styles.control}>
          <span className={`${md.labelMedium} ${md.variantText}`}>Flip-flop</span>
          <SegmentedButton
            label="Flip-flop type"
            options={FLIP_FLOP_KINDS.map(id => ({ id, label: FLIP_FLOP_LABELS[id].replace(' flip-flop', '') }))}
            value={flipFlop}
            onChange={setFlipFlop}
          />
        </div>
      </div>

      <StageRail
        stages={STAGES}
        active={stage}
        unlocked={unlocked}
        onSelect={selectStage}
        onRevealAll={() => setUnlocked(STAGES.length)}
      />

      <section className={styles.stage}>
        {stage === 'diagram' && <StateDiagramView fsm={fsm} />}
        {stage === 'table' && <StateTableView design={design} />}

        {stage === 'kmaps' && (
          <div className={styles.kmaps}>
            <div className={styles.functionPicker}>
              {design.functions.map((fn, i) => (
                <Chip key={fn.name} selected={i === functionIndex} onClick={() => setFunctionIndex(i)}>
                  {fn.name}
                </Chip>
              ))}
            </div>
            <p className={`${styles.equation} ${md.titleMedium}`}>
              {activeFunction.name} = {activeFunction.expression}
            </p>
            <KMapView
              table={activeFunction.table}
              solution={activeFunction.solution}
              coverIndex={0}
              onCoverChange={() => {}}
              highlight={null}
              onHighlight={() => {}}
            />
          </div>
        )}

        {stage === 'circuit' && (
          <div className={styles.circuit}>
            <CircuitSandbox
              key={circuitKey}
              variant="embedded"
              persist={false}
              initialDocument={circuitDocument}
            />
            <div className={styles.equations}>
              {design.functions.map(fn => (
                <code key={fn.name} className={styles.equationLine}>
                  {fn.name} = {fn.expression}
                </code>
              ))}
            </div>
            {onOpenSandbox && (
              <Button variant="tonal" onClick={() => onOpenSandbox(design.netlist)}>
                Open full screen
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
