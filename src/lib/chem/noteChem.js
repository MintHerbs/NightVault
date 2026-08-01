// Validation and parsing core for chemistry note content (T-090/T-091).
//
// This is the security boundary for two content shapes that both eventually
// reach the DOM as OpenChemLib-rendered SVG:
//   - `::molecule{smiles="..." label="..."}` (a leaf directive, T-091)
//   - ```reaction\n{...json...}\n``` (a fenced code block, T-090)
//
// Everything here is a charset/shape/size gate, NOT full SMILES grammar or
// chemistry validation — a string that passes `isValidSmiles` can still be
// chemically nonsensical and throw inside `OCL.Molecule.fromSmiles`. That is
// OpenChemLib's job at render time; the renderer components must catch it
// and degrade gracefully. This module's job is only to stop a hostile or
// malformed string from ever reaching a parser (SMILES or JSON) unbounded.
//
// Pure module: no OpenChemLib import, no DOM. Covered by
// `npm run test:chem` (noteChem.test.js).

/** Generous for teaching material; also caps recursive-parser DoS risk. */
export const SMILES_MAX_LEN = 500

// Atoms/brackets/ring-closure digits & %nn/bond symbols/charges/wildcards.
// This is deliberately loose — grammar correctness is OpenChemLib's job.
const SMILES_CHARSET_RE = /^[A-Za-z0-9@+\-[\]()=#$:/\\.%*]+$/

export function isValidSmiles(smiles) {
  if (typeof smiles !== 'string') return false
  if (smiles.length === 0 || smiles.length > SMILES_MAX_LEN) return false
  return SMILES_CHARSET_RE.test(smiles)
}

/** `::molecule`'s optional `label` only ever becomes an aria-label/visible
 * fallback text, so no character restriction is needed — just a length cap
 * (an empty label is valid: it means "fall back to the SMILES string"). */
export const LABEL_MAX_LEN = 200

export function isValidLabel(label) {
  return typeof label === 'string' && label.length <= LABEL_MAX_LEN
}

// ---------------------------------------------------------------------------
// Reaction JSON schema (T-090, Layer 3)
// ---------------------------------------------------------------------------

/** Reject before `JSON.parse` is even called — the same reasoning as the
 * SMILES length cap, so an author-supplied string can't be turned into a
 * parser DoS. */
export const MAX_REACTION_JSON_BYTES = 20000
export const MAX_STEPS = 20
export const MAX_ITEMS_PER_STEP = 6
export const MAX_CONDITIONS_PER_STEP = 6
export const MAX_CONDITION_LEN = 200

function validateSmilesArray(value, max) {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null
  const out = []
  for (const entry of value) {
    if (!isValidSmiles(entry)) return null
    out.push(entry)
  }
  return out
}

function validateConditions(value, max) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) return null
  const out = []
  for (const line of value) {
    if (typeof line !== 'string' || line.length > MAX_CONDITION_LEN) return null
    out.push(line)
  }
  return out
}

/** Accepts an agent entry as a plain SMILES string or `{smiles, label}`,
 * normalising to `{smiles, label}` (label defaults to `''`). */
function normalizeAgent(entry) {
  if (typeof entry === 'string') {
    return isValidSmiles(entry) ? { smiles: entry, label: '' } : null
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    if (!isValidSmiles(entry.smiles)) return null
    const label = typeof entry.label === 'string' ? entry.label : ''
    return { smiles: entry.smiles, label }
  }
  return null
}

function validateAgents(value, max) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > max) return null
  const out = []
  for (const entry of value) {
    const normalized = normalizeAgent(entry)
    if (!normalized) return null
    out.push(normalized)
  }
  return out
}

/**
 * Parses and validates a `` ```reaction `` fenced block's JSON payload.
 * Never throws — any violation (bad JSON, oversized payload, a field over its
 * cap) returns `{ ok: false }` so the caller can fall back to rendering the
 * raw block as plain code, matching how a parse failure already degrades for
 * `::molecule`.
 *
 * @returns {{ ok: true, steps: Array } | { ok: false }}
 */
export function parseReactionBlock(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false }
  if (raw.length > MAX_REACTION_JSON_BYTES) return { ok: false }

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false }
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) return { ok: false }
  if (data.steps.length === 0 || data.steps.length > MAX_STEPS) return { ok: false }

  const steps = []
  for (const rawStep of data.steps) {
    if (!rawStep || typeof rawStep !== 'object') return { ok: false }

    const reactants = validateSmilesArray(rawStep.reactants, MAX_ITEMS_PER_STEP)
    if (!reactants) return { ok: false }

    const products = validateSmilesArray(rawStep.products, MAX_ITEMS_PER_STEP)
    if (!products) return { ok: false }

    const conditionsAbove = validateConditions(rawStep.conditionsAbove, MAX_CONDITIONS_PER_STEP)
    if (conditionsAbove === null) return { ok: false }

    const agents = validateAgents(rawStep.agents, MAX_ITEMS_PER_STEP)
    if (agents === null) return { ok: false }

    steps.push({ reactants, conditionsAbove, agents, products })
  }

  return { ok: true, steps }
}

/** `{reactants, conditionsAbove, agents, products}` -> the same shape
 * `parseReactionBlock` returns, with `agents` normalised to `{smiles, label}`.
 * Used both by `serializeReactionBlock` and directly by callers building a
 * step (e.g. paste conversion, the future toolbar). */
export function serializeReactionStep(step) {
  return {
    reactants: [...(step.reactants || [])],
    conditionsAbove: [...(step.conditionsAbove || [])],
    agents: (step.agents || []).map((agent) => (
      typeof agent === 'string'
        ? { smiles: agent, label: '' }
        : { smiles: agent.smiles, label: agent.label || '' }
    )),
    products: [...(step.products || [])],
  }
}

/** Produces the fenced ` ```reaction\n{...}\n``` ` markdown string for a list
 * of steps — used both by paste-conversion and (later) the toolbar's "copy as
 * note directive" action. */
export function serializeReactionBlock(steps) {
  const payload = { steps: steps.map(serializeReactionStep) }
  return '```reaction\n' + JSON.stringify(payload, null, 2) + '\n```'
}

// ---------------------------------------------------------------------------
// Paste detection (T-091/T-090)
// ---------------------------------------------------------------------------

/**
 * Cheap synchronous check only — no OCL, no real MOL parsing. Decides only
 * WHETHER to attempt a MOL->SMILES conversion (which does need OpenChemLib,
 * and therefore happens later, async, at the call site).
 *
 * A MOL/SDF file's 4th line (the "counts line") ends in `V2000` or `V3000`.
 */
export function detectMolBlock(text) {
  if (typeof text !== 'string') return false
  const lines = text.split('\n')
  if (lines.length < 4) return false
  const countsLine = lines[3].replace(/\s+$/, '')
  return countsLine.endsWith('V2000') || countsLine.endsWith('V3000')
}

// `>` cannot appear inside a valid SMILES token, so a plain split producing
// exactly 3 parts is sufficient to detect the unambiguous reaction-SMILES
// shape `reactants>agents>products` — no library needed.
function isValidFragmentGroup(segment) {
  if (segment === '') return true
  return segment.split('.').every((fragment) => isValidSmiles(fragment))
}

/**
 * `"reactants>agents>products"` -> `{ reactants, agents, products }` (each a
 * `.`-separated list of SMILES strings), or `null` if `text` doesn't match
 * the unambiguous reaction-SMILES shape (exactly 3 segments from exactly 2
 * `>` characters; reactants/products non-empty; every fragment a valid
 * SMILES token). Pure string logic, no OCL needed.
 */
export function splitReactionSmiles(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null

  const parts = trimmed.split('>')
  if (parts.length !== 3) return null

  const [reactantsPart, agentsPart, productsPart] = parts
  if (reactantsPart === '' || productsPart === '') return null
  if (!isValidFragmentGroup(reactantsPart)) return null
  if (!isValidFragmentGroup(agentsPart)) return null
  if (!isValidFragmentGroup(productsPart)) return null

  return {
    reactants: reactantsPart.split('.'),
    agents: agentsPart === '' ? [] : agentsPart.split('.'),
    products: productsPart.split('.'),
  }
}

/**
 * Pasted reaction-SMILES -> a fenced `` ```reaction `` markdown block, or
 * `null` if `text` isn't reaction-SMILES. Pure string conversion (no OCL
 * needed for this path, unlike MOL-block conversion) — safe to call
 * synchronously from `handlePaste`.
 *
 * `conditionsAbove` is always `[]`: reaction SMILES carries no condition
 * text. Documented, deliberate gap (see chemistry-notes.md Layer 3), not a
 * bug — the author fills conditions in by hand afterward.
 */
export function convertChemPaste(text) {
  const parsed = splitReactionSmiles(text)
  if (!parsed) return null
  return serializeReactionBlock([{
    reactants: parsed.reactants,
    conditionsAbove: [],
    agents: parsed.agents,
    products: parsed.products,
  }])
}
