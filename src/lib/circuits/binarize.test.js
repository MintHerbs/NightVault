/**
 * Two-input rewrite tests (T-093).
 * Run with: npm run test:circuits
 *
 * The contract is equivalence, so it is checked by *running* both netlists over
 * the whole truth table rather than by looking at the shape. Shape is checked
 * too, but only after equivalence: a pass that produces beautiful 2-input gates
 * computing the wrong function is worse than no pass at all.
 *
 * The netlists come from the real synthesiser over exhaustively enumerated
 * truth tables, so this covers the circuits the tool actually builds — including
 * the constant-0 and constant-1 cases, which have no gates at all.
 */

import { binarize, maxFanIn, soleGateKind } from './binarize.js'
import { synthesize } from './circuitSynthesis.js'
import { minimize } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'
import { evaluateCombinational } from './simulator.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

/** A truth table from a bit mask, one bit per row. */
function tableFor(vars, mask) {
  const minterms = []
  for (let i = 0; i < 2 ** vars.length; i += 1) {
    if ((mask >> i) & 1) minterms.push(i)
  }
  return tableFromMinterms({ vars, minterms })
}

/**
 * Every input assignment, read off the table's own rows rather than rebuilt
 * from the index — bit order is the table's business, not this test's.
 */
function assignments(table) {
  return table.rows.map((row) => {
    const values = {}
    table.vars.forEach((name, i) => { values[name] = row.inputs[i] })
    return values
  })
}

function sameOnEveryInput(before, after, table, label) {
  for (const assignment of assignments(table)) {
    const a = evaluateCombinational(before, assignment)
    const b = evaluateCombinational(after, assignment)
    for (const name of Object.keys(a)) {
      if (a[name] === b[name]) continue
      failures += 1
      console.error(`  FAIL: ${label} — ${JSON.stringify(assignment)} gave ${a[name]} then ${b[name]}`)
      return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
console.log('1. every synthesised circuit survives the rewrite unchanged in meaning')
// ---------------------------------------------------------------------------
{
  const vars = ['A', 'B', 'C', 'D']
  let widened = 0
  let checked = 0

  // Every 4-variable function is 65536 masks; step through a spread of them
  // rather than all, and include the two degenerate ends explicitly.
  const masks = [0, 65535]
  for (let mask = 1; mask < 65535; mask += 277) masks.push(mask)

  for (const mask of masks) {
    const table = tableFor(vars, mask)
    for (const form of ['sop', 'pos']) {
      for (const style of ['basic', 'universal']) {
        const solution = minimize(table, { form })
        const before = synthesize(solution, { coverIndex: 0, style })
        const after = binarize(before)
        checked += 1
        if (maxFanIn(before) > 2) widened += 1

        assert(maxFanIn(after) <= 2, `mask ${mask} ${form}/${style} still has a wide gate`)
        sameOnEveryInput(before, after, table, `mask ${mask} ${form}/${style}`)
      }
    }
  }

  console.log(`   ${checked} circuits, ${widened} of them had a gate wider than two`)
  assert(widened > 0, 'no circuit in the sample was actually wide — the test proves nothing')
}

// ---------------------------------------------------------------------------
console.log('2. the rewrite never introduces a gate kind the circuit did not have')
// ---------------------------------------------------------------------------
{
  // "NAND only" as this tool builds it is NANDs plus inverters for the
  // complemented literals — `soleGateKind` reads the *associative* gates, which
  // is the set the cascade is built from. What must hold is that binarising a
  // NAND-shaped circuit adds nothing but NANDs: fold it with plain AND cores
  // instead and a circuit whose whole point was "implement this using only NAND
  // gates" comes back with ANDs in it.
  const vars = ['A', 'B', 'C', 'D']
  const gates = ['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor']
  let sawUniversal = 0

  for (let mask = 3; mask < 65535; mask += 1013) {
    for (const form of ['sop', 'pos']) {
      const table = tableFor(vars, mask)
      const solution = minimize(table, { form })
      const before = synthesize(solution, { coverIndex: 0, style: 'universal' })
      const only = soleGateKind(before)
      if (!only || maxFanIn(before) <= 2) continue
      sawUniversal += 1

      const was = new Set(before.components.filter(c => gates.includes(c.kind)).map(c => c.kind))
      const now = new Set(binarize(before).components.filter(c => gates.includes(c.kind)).map(c => c.kind))
      const added = [...now].filter(kind => !was.has(kind))

      assert(added.length === 0,
        `mask ${mask} ${form}: ${only}-only circuit gained ${added.join(', ')}`)
      sameOnEveryInput(before, binarize(before), table, `universal mask ${mask} ${form}`)
    }
  }

  console.log(`   ${sawUniversal} single-kind circuits gained no new kind`)
  assert(sawUniversal > 0, 'never saw a wide single-kind circuit — the test proves nothing')
}

// ---------------------------------------------------------------------------
console.log('3. an already-narrow netlist is returned untouched')
// ---------------------------------------------------------------------------
{
  const solution = minimize(tableFor(['A', 'B'], 0b1000), { form: 'sop' })
  const netlist = synthesize(solution, { coverIndex: 0, style: 'basic' })
  assert(maxFanIn(netlist) <= 2, 'fixture is not narrow to begin with')
  assert(binarize(netlist) === netlist, 'a narrow netlist should be the same object back')
}

// ---------------------------------------------------------------------------
console.log('4. the rewrite leaves the netlist internally consistent')
// ---------------------------------------------------------------------------
{
  const vars = ['A', 'B', 'C', 'D', 'E']
  const solution = minimize(tableFor(vars, 0b10110010110100101101001011010010), { form: 'sop' })
  const after = binarize(synthesize(solution, { coverIndex: 0, style: 'basic' }))

  const ports = new Set(after.components.flatMap(c => [...c.inputs, ...c.outputs]))
  const ids = new Set()
  for (const component of after.components) {
    assert(!ids.has(component.id), `duplicate component id ${component.id}`)
    ids.add(component.id)
  }

  const driven = new Set()
  for (const wire of after.wires) {
    assert(ports.has(wire.from), `wire ${wire.id} leaves a port that does not exist: ${wire.from}`)
    assert(ports.has(wire.to), `wire ${wire.id} reaches a port that does not exist: ${wire.to}`)
    assert(!driven.has(wire.to), `two wires drive ${wire.to}`)
    driven.add(wire.to)
  }

  const wireIds = new Set()
  for (const wire of after.wires) {
    assert(!wireIds.has(wire.id), `duplicate wire id ${wire.id}`)
    wireIds.add(wire.id)
  }

  // Every gate pin is fed. A cascade that leaves a stage floating computes `x`
  // and would still pass an equivalence check on a function that ignores it.
  for (const component of after.components) {
    for (const pin of component.inputs) {
      assert(driven.has(pin), `${component.id} has a floating pin after the rewrite: ${pin}`)
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nbinarize: all checks passed')
