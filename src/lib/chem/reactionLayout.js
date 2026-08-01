// Pure layout for reaction schemes (T-090). No SVG, no React, no OpenChemLib
// import — follows the same convention as this codebase's other diagram
// layout modules (erdLayout.js, logic/tableauxLayout.js, algo/
// recurrenceTreeLayout.js): a DEFAULTS constants object, a measuring step,
// then a placement pass returning positioned, sized cells.
//
// The overlap bug this fixes has one root cause: assuming every structure
// renders at the same fixed size. `cellSizes` (SMILES string -> {width,
// height} in pixels) is supplied by the caller, already measured via the
// layer-2 renderer's `toSVG(...).autoCrop` — this module never touches
// SVG/DOM, exactly like every layout module it mirrors.
//
// The actual fix: the main row (reactants, +, arrow, +, products) is
// centred on one shared baseline — the arrow's vertical middle — across
// every step, and `agents` for a step are placed in their OWN band below
// that baseline, offset by `belowAgentGap`. That vertical separation is
// unconditional: an agent band's top edge is always the main row's lowest
// edge plus a fixed gap, so their bounding boxes cannot intersect regardless
// of how tall or wide any individual structure is. See reactionLayout.test.js
// for the assertion that proves this on deliberately mismatched fixtures.

export const DEFAULTS = {
  gap: 16,              // horizontal gap between cells in a row
  plusSize: 20,          // width (and height) reserved for a "+" glyph cell
  arrowCoreLength: 80,   // minimum arrow shaft length with no stretching content
  arrowHeight: 24,
  conditionLineHeight: 16,
  belowAgentGap: 12,     // vertical gap between the main row and the agent band
  minCellSize: 24,       // clamp for a degenerate single-atom structure (0x0)
}

// Crude monospace-ish text-width estimate. This module never touches the DOM
// (no canvas measureText, no ResizeObserver) — same constraint as every other
// layout module here — so condition-line/agent-label width is an estimate
// used only to decide how wide the arrow cell needs to be, not a rendered
// value.
const CHAR_W = 7

function estimateTextWidth(text) {
  return String(text ?? '').length * CHAR_W
}

function clampSize(size) {
  return {
    width: Math.max(DEFAULTS.minCellSize, size?.width || 0),
    height: Math.max(DEFAULTS.minCellSize, size?.height || 0),
  }
}

function sizeOf(cellSizes, smiles) {
  return clampSize(cellSizes?.[smiles])
}

/**
 * @param {Array} steps - `{ reactants, conditionsAbove, agents, products }[]`
 *   (the shape `parseReactionBlock` returns — `agents` already normalised to
 *   `{smiles, label}`).
 * @param {Object} cellSizes - SMILES string -> `{width, height}` in pixels.
 * @param {Object} [overrides] - overrides merged onto DEFAULTS.
 * @returns {{ width: number, height: number, cells: Array }}
 */
export function layoutReactionScheme(steps, cellSizes, overrides = {}) {
  const D = { ...DEFAULTS, ...overrides }

  if (!Array.isArray(steps) || steps.length === 0) {
    return { width: 0, height: 0, cells: [] }
  }

  // ---- Pass 1: measure each step's arrow width and vertical extents ----
  const stepInfo = steps.map((step) => {
    const reactantSizes = (step.reactants || []).map((s) => sizeOf(cellSizes, s))
    const productSizes = (step.products || []).map((s) => sizeOf(cellSizes, s))
    const agents = step.agents || []
    const agentSizes = agents.map((a) => sizeOf(cellSizes, a.smiles))

    const conditionsAbove = step.conditionsAbove || []
    const conditionsWidth = conditionsAbove.reduce(
      (max, line) => Math.max(max, estimateTextWidth(line)), 0,
    )
    const agentsRowWidth = agentSizes.reduce((sum, s) => sum + s.width, 0)
      + Math.max(0, agentSizes.length - 1) * D.gap

    // The arrow must be at least as wide as its widest condition line or its
    // below-arrow agent group, or that content would overrun the arrow/next
    // cell — this is what stops a long condition line or a below-arrow
    // structure from colliding with a neighbour.
    const arrowWidth = Math.max(D.arrowCoreLength, conditionsWidth, agentsRowWidth)
    const conditionsHeight = conditionsAbove.length * D.conditionLineHeight
    const agentLabelHeight = agents.some((a) => a.label) ? D.conditionLineHeight : 0
    const agentsHeight = agentSizes.length
      ? Math.max(...agentSizes.map((s) => s.height)) + agentLabelHeight
      : 0

    return { reactantSizes, productSizes, agentSizes, agents, conditionsAbove, arrowWidth, conditionsHeight, agentsHeight }
  })

  // ---- Shared vertical baseline ----
  // `aboveCenter`/`belowCenter` are the furthest any main-row cell (a
  // reactant/product/plus box, or the arrow-plus-conditions box) reaches
  // above/below one shared centre line, across every step in the scheme —
  // this is what keeps every step's row aligned on the same baseline.
  let aboveCenter = D.arrowHeight / 2
  let belowCenter = D.arrowHeight / 2
  let maxAgentsHeight = 0
  for (const info of stepInfo) {
    aboveCenter = Math.max(aboveCenter, D.arrowHeight / 2 + info.conditionsHeight)
    for (const size of [...info.reactantSizes, ...info.productSizes]) {
      aboveCenter = Math.max(aboveCenter, size.height / 2)
      belowCenter = Math.max(belowCenter, size.height / 2)
    }
    maxAgentsHeight = Math.max(maxAgentsHeight, info.agentsHeight)
  }
  aboveCenter = Math.max(aboveCenter, D.plusSize / 2)
  belowCenter = Math.max(belowCenter, D.plusSize / 2)

  const centerY = aboveCenter
  // The agent band's top is unconditionally below the main row's lowest
  // edge (`centerY + belowCenter`) by a fixed gap — the actual overlap fix.
  const agentsTop = centerY + belowCenter + D.belowAgentGap

  const cells = []
  let cursorX = 0

  const placeRow = (sizes, smilesList) => {
    sizes.forEach((size, i) => {
      cells.push({
        x: cursorX, y: centerY - size.height / 2,
        width: size.width, height: size.height,
        kind: 'structure', smiles: smilesList[i],
      })
      cursorX += size.width
      if (i < sizes.length - 1) {
        cells.push({
          x: cursorX, y: centerY - D.plusSize / 2,
          width: D.plusSize, height: D.plusSize,
          kind: 'plus', text: '+',
        })
        cursorX += D.plusSize + D.gap
      }
    })
  }

  // ---- Pass 2: place cells left to right, chaining steps ----
  steps.forEach((step, idx) => {
    const info = stepInfo[idx]
    if (idx > 0) cursorX += D.gap // previous step's products -> this step's reactants

    placeRow(info.reactantSizes, step.reactants)
    cursorX += D.gap

    const arrowX = cursorX
    const arrowHeight = D.arrowHeight + info.conditionsHeight
    const arrowY = centerY - D.arrowHeight / 2 - info.conditionsHeight
    cells.push({
      x: arrowX, y: arrowY, width: info.arrowWidth, height: arrowHeight,
      kind: 'arrow', conditionsAbove: info.conditionsAbove,
    })
    cursorX += info.arrowWidth + D.gap

    placeRow(info.productSizes, step.products)

    // Below-arrow agents, centred under the step's arrow. `arrowWidth` was
    // sized to be >= the agent row's total width above, so this never
    // overflows the step's own horizontal footprint into a neighbour's.
    if (info.agents.length) {
      const agentsRowWidth = info.agentSizes.reduce((sum, s) => sum + s.width, 0)
        + Math.max(0, info.agentSizes.length - 1) * D.gap
      let agentX = arrowX + (info.arrowWidth - agentsRowWidth) / 2
      info.agents.forEach((agent, i) => {
        const size = info.agentSizes[i]
        cells.push({
          x: agentX, y: agentsTop, width: size.width, height: size.height,
          kind: 'agent', smiles: agent.smiles, label: agent.label,
        })
        agentX += size.width + D.gap
      })
    }
  })

  const width = cursorX
  const height = maxAgentsHeight ? agentsTop + maxAgentsHeight : centerY + belowCenter

  return { width, height, cells }
}

/** Every pair of cell bounding boxes with zero rectangle intersection (used
 * by the test suite to assert the fix directly rather than eyeballing
 * rendered output). */
export function findOverlaps(cells) {
  const clashes = []
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]
      const b = cells[j]
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      if (overlapX > 0 && overlapY > 0) clashes.push({ a: i, b: j, overlapX, overlapY })
    }
  }
  return clashes
}
