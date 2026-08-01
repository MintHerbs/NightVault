// Layout invariants for reaction schemes (T-090). Run with: npm run test:chem
//
// The whole point of this module is the non-overlap fix, so this asserts it
// directly on deliberately mismatched fixtures rather than eyeballing
// rendered output — same convention as tableauxLayout.test.js /
// recurrenceTreeLayout.js's own overlap checks.
import { layoutReactionScheme, findOverlaps, DEFAULTS } from './reactionLayout.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) {
    failures++
    console.error(`  FAIL: ${msg}`)
  }
}

function assertNoOverlaps(label, layout) {
  const clashes = findOverlaps(layout.cells)
  assert(clashes.length === 0, `${label}: ${clashes.length} overlapping cell pair(s): ${JSON.stringify(clashes)}`)
}

function assertBoundsCoverCells(label, layout) {
  for (const cell of layout.cells) {
    assert(cell.x >= -0.001, `${label}: cell ${cell.kind} has negative x (${cell.x})`)
    assert(cell.y >= -0.001, `${label}: cell ${cell.kind} has negative y (${cell.y})`)
    assert(cell.x + cell.width <= layout.width + 0.001,
      `${label}: cell ${cell.kind} right edge (${cell.x + cell.width}) exceeds layout width (${layout.width})`)
    assert(cell.y + cell.height <= layout.height + 0.001,
      `${label}: cell ${cell.kind} bottom edge (${cell.y + cell.height}) exceeds layout height (${layout.height})`)
  }
}

// ---- Fixture 1: a tiny 20x20 cell next to a 200x150 cell ----
{
  const cellSizes = { HCl: { width: 20, height: 20 }, naphthol: { width: 200, height: 150 } }
  const steps = [{ reactants: ['HCl'], conditionsAbove: [], agents: [], products: ['naphthol'] }]
  const layout = layoutReactionScheme(steps, cellSizes)
  assertNoOverlaps('mismatched sizes', layout)
  assertBoundsCoverCells('mismatched sizes', layout)
  assert(layout.cells.length === 3, 'mismatched sizes: expected exactly 3 cells (reactant, arrow, product — no plus)')
}

// ---- Fixture 2: a step with 3 reactants ----
{
  const cellSizes = { A: { width: 40, height: 30 }, B: { width: 90, height: 60 }, C: { width: 30, height: 30 }, D: { width: 50, height: 50 } }
  const steps = [{ reactants: ['A', 'B', 'C'], conditionsAbove: [], agents: [], products: ['D'] }]
  const layout = layoutReactionScheme(steps, cellSizes)
  assertNoOverlaps('3 reactants', layout)
  assertBoundsCoverCells('3 reactants', layout)
  // 3 reactants -> 2 plus cells between them, 1 arrow, 1 product = 7 cells
  assert(layout.cells.length === 7, `3 reactants: expected 7 cells, got ${layout.cells.length}`)
}

// ---- Fixture 3: an agent and long condition text ----
{
  const cellSizes = {
    aryl: { width: 60, height: 60 },
    diazo: { width: 70, height: 70 },
    naphthol: { width: 200, height: 150 },
  }
  const steps = [{
    reactants: ['aryl'],
    conditionsAbove: ['1) NaNO2, HCl, 0 degrees C, stirred for a long time', '2) NaOH, 0 degrees C'],
    agents: [{ smiles: 'naphthol', label: '1-naphthol' }],
    products: ['diazo'],
  }]
  const layout = layoutReactionScheme(steps, cellSizes)
  assertNoOverlaps('agent + long conditions', layout)
  assertBoundsCoverCells('agent + long conditions', layout)

  const arrow = layout.cells.find((c) => c.kind === 'arrow')
  const agent = layout.cells.find((c) => c.kind === 'agent')
  assert(Boolean(arrow), 'agent + long conditions: has an arrow cell')
  assert(Boolean(agent), 'agent + long conditions: has an agent cell')
  // The overlap fix: the agent band never intersects the main row's band.
  assert(agent.y >= arrow.y + arrow.height + DEFAULTS.belowAgentGap - 0.001,
    `agent + long conditions: agent band (y=${agent.y}) is not offset below the main row (arrow bottom=${arrow.y + arrow.height})`)
  // The arrow is wide enough for its widest condition line and its agent group.
  assert(arrow.width >= DEFAULTS.arrowCoreLength, 'agent + long conditions: arrow at least as wide as the core length')
  assert(arrow.width >= agent.width, 'agent + long conditions: arrow at least as wide as the below-arrow agent')
}

// ---- Fixture 4: two chained steps (the motivating diazotisation/coupling case) ----
{
  const cellSizes = {
    amine: { width: 55, height: 55 },
    diazonium: { width: 65, height: 65 },
    naphthol: { width: 180, height: 140 },
    azo: { width: 220, height: 160 },
  }
  const steps = [
    {
      reactants: ['amine'],
      conditionsAbove: ['1) NaNO2, HCl, 0 °C'],
      agents: [],
      products: ['diazonium'],
    },
    {
      reactants: ['diazonium'],
      conditionsAbove: ['2) NaOH, 0 °C'],
      agents: [{ smiles: 'naphthol', label: '1-naphthol' }],
      products: ['azo'],
    },
  ]
  const layout = layoutReactionScheme(steps, cellSizes)
  assertNoOverlaps('two chained steps', layout)
  assertBoundsCoverCells('two chained steps', layout)

  const arrows = layout.cells.filter((c) => c.kind === 'arrow')
  assert(arrows.length === 2, `two chained steps: expected 2 arrows, got ${arrows.length}`)
  assert(arrows[1].x > arrows[0].x, 'two chained steps: second arrow is to the right of the first')
}

// ---- Fixture 5: a degenerate lone heavy atom (getBounds width:0,height:0) ----
{
  const cellSizes = { Cl: { width: 0, height: 0 }, big: { width: 150, height: 120 } }
  const steps = [{ reactants: ['Cl'], conditionsAbove: [], agents: [], products: ['big'] }]
  const layout = layoutReactionScheme(steps, cellSizes)
  assertNoOverlaps('degenerate zero-size cell', layout)
  const clCell = layout.cells.find((c) => c.smiles === 'Cl')
  assert(clCell.width >= DEFAULTS.minCellSize, 'degenerate cell: width clamped to minCellSize')
  assert(clCell.height >= DEFAULTS.minCellSize, 'degenerate cell: height clamped to minCellSize')
}

// ---- Fixture 6: empty steps input degrades to an empty layout, not a crash ----
{
  const layout = layoutReactionScheme([], {})
  assert(layout.cells.length === 0, 'empty steps: no cells')
  assert(layout.width === 0 && layout.height === 0, 'empty steps: zero bounds')
}

if (failures > 0) {
  console.error(`[reactionLayout] ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('[reactionLayout] all tests passed (6 fixtures)')
