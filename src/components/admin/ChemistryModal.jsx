import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash } from '@phosphor-icons/react'
import MoleculeStructure from '../markdown/MoleculeStructure/MoleculeStructure'
import ReactionScheme from '../markdown/ReactionScheme/ReactionScheme'
import {
  isValidSmiles,
  parseReactionBlock,
  serializeReactionBlock,
  MAX_STEPS,
  MAX_ITEMS_PER_STEP,
  MAX_CONDITIONS_PER_STEP,
} from '../../lib/chem/noteChem'
import styles from './ChemistryModal.module.css'

const EMPTY_STEP = () => ({
  reactants: [''],
  conditionsAbove: ['', ''],
  agents: [],
  products: [''],
})

// Matches the fence shape `serializeReactionBlock` produces — used to pull the
// raw JSON payload back out so it can be round-tripped through
// `parseReactionBlock` (which expects the fence's inner JSON, not the fenced
// markdown string). Same regex the noteChem test suite uses.
const FENCE_RE = /^```reaction\n([\s\S]*)\n```$/

/** Strips blank rows out of the author's in-progress step state before it's
 * handed to `serializeReactionBlock`/`parseReactionBlock` — the controlled
 * inputs always keep at least one blank reactant/product/condition field
 * visible so there's somewhere to type, but an untouched blank field isn't
 * real content and must not reach the validators as e.g. an empty-string
 * SMILES. */
function buildStepsForSerialize(steps) {
  return steps.map((step) => ({
    reactants: step.reactants.map((s) => s.trim()).filter(Boolean),
    conditionsAbove: step.conditionsAbove.map((s) => s.trim()).filter(Boolean),
    agents: step.agents
      .filter((agent) => agent.smiles.trim())
      .map((agent) => ({ smiles: agent.smiles.trim(), label: agent.label.trim() })),
    products: step.products.map((s) => s.trim()).filter(Boolean),
  }))
}

function ReactionStepEditor({ step, index, onChange, onRemove, canRemoveStep }) {
  const updateArrayField = (field, arrayIndex, value) => {
    const next = step[field].slice()
    next[arrayIndex] = value
    onChange({ ...step, [field]: next })
  }

  const addArrayItem = (field, max, itemFactory) => {
    if (step[field].length >= max) return
    onChange({ ...step, [field]: [...step[field], itemFactory()] })
  }

  const removeArrayItem = (field, arrayIndex) => {
    const next = step[field].slice()
    next.splice(arrayIndex, 1)
    onChange({ ...step, [field]: next })
  }

  const updateAgentField = (agentIndex, key, value) => {
    const next = step.agents.slice()
    next[agentIndex] = { ...next[agentIndex], [key]: value }
    onChange({ ...step, agents: next })
  }

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <span className={styles.stepTitle}>Step {index + 1}</span>
        {canRemoveStep && (
          <button type="button" className={styles.smallIconButton} onClick={onRemove} aria-label={`Remove step ${index + 1}`}>
            <Trash size={14} />
          </button>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.smallLabel}>Reactants</label>
        {step.reactants.map((value, i) => (
          <div className={styles.inlineRow} key={i}>
            <input
              className={styles.smallInput}
              type="text"
              placeholder="SMILES"
              value={value}
              onChange={(e) => updateArrayField('reactants', i, e.target.value)}
            />
            {step.reactants.length > 1 && (
              <button type="button" className={styles.smallIconButton} onClick={() => removeArrayItem('reactants', i)} aria-label="Remove reactant">
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
        {step.reactants.length < MAX_ITEMS_PER_STEP && (
          <button type="button" className={styles.addLink} onClick={() => addArrayItem('reactants', MAX_ITEMS_PER_STEP, () => '')}>
            <Plus size={12} /> Add reactant
          </button>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.smallLabel}>Conditions (above arrow)</label>
        {step.conditionsAbove.map((value, i) => (
          <div className={styles.inlineRow} key={i}>
            <input
              className={styles.smallInput}
              type="text"
              placeholder={`e.g. ${i + 1}) NaOH, 0 °C`}
              value={value}
              onChange={(e) => updateArrayField('conditionsAbove', i, e.target.value)}
            />
            <button type="button" className={styles.smallIconButton} onClick={() => removeArrayItem('conditionsAbove', i)} aria-label="Remove condition line">
              <Trash size={14} />
            </button>
          </div>
        ))}
        {step.conditionsAbove.length < MAX_CONDITIONS_PER_STEP && (
          <button type="button" className={styles.addLink} onClick={() => addArrayItem('conditionsAbove', MAX_CONDITIONS_PER_STEP, () => '')}>
            <Plus size={12} /> Add condition line
          </button>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.smallLabel}>Agents (below arrow)</label>
        {step.agents.map((agent, i) => (
          <div className={styles.inlineRow} key={i}>
            <input
              className={styles.smallInput}
              type="text"
              placeholder="SMILES"
              value={agent.smiles}
              onChange={(e) => updateAgentField(i, 'smiles', e.target.value)}
            />
            <input
              className={styles.smallInput}
              type="text"
              placeholder="Label (optional)"
              value={agent.label}
              onChange={(e) => updateAgentField(i, 'label', e.target.value)}
            />
            <button type="button" className={styles.smallIconButton} onClick={() => removeArrayItem('agents', i)} aria-label="Remove agent">
              <Trash size={14} />
            </button>
          </div>
        ))}
        {step.agents.length < MAX_ITEMS_PER_STEP && (
          <button type="button" className={styles.addLink} onClick={() => addArrayItem('agents', MAX_ITEMS_PER_STEP, () => ({ smiles: '', label: '' }))}>
            <Plus size={12} /> Add agent
          </button>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.smallLabel}>Products</label>
        {step.products.map((value, i) => (
          <div className={styles.inlineRow} key={i}>
            <input
              className={styles.smallInput}
              type="text"
              placeholder="SMILES"
              value={value}
              onChange={(e) => updateArrayField('products', i, e.target.value)}
            />
            {step.products.length > 1 && (
              <button type="button" className={styles.smallIconButton} onClick={() => removeArrayItem('products', i)} aria-label="Remove product">
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
        {step.products.length < MAX_ITEMS_PER_STEP && (
          <button type="button" className={styles.addLink} onClick={() => addArrayItem('products', MAX_ITEMS_PER_STEP, () => '')}>
            <Plus size={12} /> Add product
          </button>
        )}
      </div>
    </div>
  )
}

function StructureTab({ open, onInsert, onClose }) {
  const [smiles, setSmiles] = useState('')
  const [label, setLabel] = useState('')

  const trimmedSmiles = smiles.trim()
  const valid = isValidSmiles(trimmedSmiles)

  const handleInsert = () => {
    if (!valid) return
    const trimmedLabel = label.trim().replace(/"/g, "'")
    const markdown = trimmedLabel
      ? `::molecule{smiles="${trimmedSmiles}" label="${trimmedLabel}"}`
      : `::molecule{smiles="${trimmedSmiles}"}`
    onInsert(markdown)
    onClose()
  }

  return (
    <>
      <div className={styles.content}>
        <div className={styles.formGroup}>
          <label className={styles.label}>SMILES</label>
          <input
            className={styles.textInput}
            type="text"
            placeholder="e.g., c1ccccc1 (benzene)"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Label (optional)</label>
          <input
            className={styles.textInput}
            type="text"
            placeholder="e.g., Benzene"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {smiles.trim() && !valid && (
          <div className={styles.error}>
            <strong>Error:</strong> not a valid SMILES string.
          </div>
        )}

        <div className={styles.preview}>
          <div className={styles.previewLabel}>Preview:</div>
          <div className={styles.previewContent}>
            {open && trimmedSmiles && valid ? (
              <MoleculeStructure smiles={trimmedSmiles} label={label.trim()} />
            ) : (
              <span className={styles.emptyPreview}>
                {trimmedSmiles ? 'Not valid SMILES yet' : 'Type a SMILES string to see preview'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
        <button className={styles.insertButton} onClick={handleInsert} disabled={!valid}>
          Insert Structure
        </button>
      </div>
    </>
  )
}

function ReactionTab({ open, onInsert, onClose }) {
  const [steps, setSteps] = useState(() => [EMPTY_STEP()])

  const updateStep = (index, nextStep) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? nextStep : s)))
  }

  const addStep = () => {
    if (steps.length >= MAX_STEPS) return
    setSteps((prev) => [...prev, EMPTY_STEP()])
  }

  const removeStep = (index) => {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  const fenceText = useMemo(
    () => serializeReactionBlock(buildStepsForSerialize(steps)),
    [steps],
  )

  const parsed = useMemo(() => {
    const match = FENCE_RE.exec(fenceText)
    if (!match) return { ok: false }
    return parseReactionBlock(match[1])
  }, [fenceText])

  const handleInsert = () => {
    if (!parsed.ok) return
    onInsert(fenceText)
    onClose()
  }

  return (
    <>
      <div className={styles.content}>
        {steps.map((step, i) => (
          <ReactionStepEditor
            key={i}
            step={step}
            index={i}
            onChange={(next) => updateStep(i, next)}
            onRemove={() => removeStep(i)}
            canRemoveStep={steps.length > 1}
          />
        ))}

        {steps.length < MAX_STEPS && (
          <button type="button" className={styles.addStepButton} onClick={addStep}>
            <Plus size={14} /> Add step
          </button>
        )}

        <div className={styles.preview}>
          <div className={styles.previewLabel}>Preview:</div>
          <div className={styles.previewContent}>
            {open && parsed.ok ? (
              <ReactionScheme data={{ steps: parsed.steps }} />
            ) : (
              <span className={styles.emptyPreview}>
                Add at least one reactant and one product to preview the scheme.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
        <button className={styles.insertButton} onClick={handleInsert} disabled={!parsed.ok}>
          Insert Reaction
        </button>
      </div>
    </>
  )
}

/**
 * Toolbar entry point for constructing chemistry note content (T-092/T-093's
 * follow-up toolbar work) — mirrors FormulaModal's shape exactly (same props,
 * same backdrop/header chrome) so it reads as a sibling, not a redesign. Two
 * tabs: Structure (a single `::molecule` directive) and Reaction (a
 * ```` ```reaction ```` fenced block). There is no Equation tab here — mhchem
 * equation input is covered elsewhere and out of scope for this component.
 */
export default function ChemistryModal({ open, onClose, onInsert }) {
  const [tab, setTab] = useState('structure')

  useEffect(() => {
    if (!open) setTab('structure')
  }, [open])

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Insert Chemistry</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === 'structure' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('structure')}
          >
            Structure
          </button>
          <button
            type="button"
            className={tab === 'reaction' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setTab('reaction')}
          >
            Reaction
          </button>
        </div>

        {tab === 'structure' ? (
          <StructureTab open={open} onInsert={onInsert} onClose={onClose} />
        ) : (
          <ReactionTab open={open} onInsert={onInsert} onClose={onClose} />
        )}
      </div>
    </>
  )
}
