/**
 * K-map geometry tests (T-089).
 * Run with: npm run test:circuits
 *
 * The load-bearing assertion is the last sweep: for EVERY cube at every
 * supported width, the cells enclosed by the returned rectangles must equal the
 * cube exactly. That is what proves a wrapped group is not being drawn as one
 * oversized bounding box.
 */

import { buildKMap, implicantRectangles, cyclicRuns, grayCode, placeCover, assignGroupColours, MAX_KMAP_VARS } from './kmapLayout.js'
import { minimize, expandCube, cubeToBits } from './quineMcCluskey.js'
import { tableFromMinterms } from './truthTable.js'

let failures = 0
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  FAIL: ${msg}`) }
}

const VARS = ['A', 'B', 'C', 'D', 'E']
const popcount = (n) => { let c = 0; let v = n; while (v) { v &= v - 1; c += 1 } return c }

// --- Gray code ---------------------------------------------------------------

assert(grayCode(2).join(',') === '0,1,3,2', '1: 2-bit Gray order is 00 01 11 10')
assert(grayCode(1).join(',') === '0,1', '2: 1-bit Gray order')
assert(grayCode(3).join(',') === '0,1,3,2,6,7,5,4', '3: 3-bit Gray order')

for (const bits of [1, 2, 3]) {
  const seq = grayCode(bits)
  assert(new Set(seq).size === seq.length, `4: ${bits}-bit Gray is a permutation`)
  for (let i = 0; i < seq.length; i += 1) {
    const next = seq[(i + 1) % seq.length]
    assert(popcount(seq[i] ^ next) === 1, `4: ${bits}-bit Gray step ${i} differs in one bit`)
  }
}

// --- cyclicRuns --------------------------------------------------------------

assert(JSON.stringify(cyclicRuns([0, 1], 4)) === '[{"start":0,"length":2}]', '5: plain run')
assert(JSON.stringify(cyclicRuns([1, 2], 4)) === '[{"start":1,"length":2}]', '6: offset run')
// The case that matters: 3 and 0 are adjacent on the ring.
assert(JSON.stringify(cyclicRuns([0, 3], 4)) === '[{"start":3,"length":2}]', '7: wrapped run is one run')
assert(cyclicRuns([0, 2], 4).length === 2, '8: non-adjacent pair is two runs')
assert(JSON.stringify(cyclicRuns([0, 1, 2, 3], 4)) === '[{"start":0,"length":4}]', '9: full ring')
assert(cyclicRuns([], 4).length === 0, '10: empty')
assert(JSON.stringify(cyclicRuns([2], 4)) === '[{"start":2,"length":1}]', '11: single cell')
assert(JSON.stringify(cyclicRuns([0, 1], 2)) === '[{"start":0,"length":2}]', '12: full ring of 2')

// --- Grid construction -------------------------------------------------------

for (let width = 1; width <= MAX_KMAP_VARS; width += 1) {
  const vars = VARS.slice(0, width)
  const layout = buildKMap(vars)
  assert(layout.supported, `13: ${width} variables supported`)

  const seen = new Set()
  for (const plane of layout.planes) {
    for (const row of plane.cells) for (const cell of row) {
      assert(!seen.has(cell), `14: ${width}v minterm ${cell} appears twice`)
      seen.add(cell)
    }
  }
  assert(seen.size === 2 ** width, `15: ${width}v every minterm placed exactly once`)

  // Neighbouring cells must differ in exactly one variable, wrap included. That
  // property is the entire reason a K-map works.
  for (const plane of layout.planes) {
    const rows = plane.cells.length
    const cols = plane.cells[0].length
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const here = plane.cells[r][c]
        if (cols > 1) {
          const right = plane.cells[r][(c + 1) % cols]
          assert(popcount(here ^ right) === 1, `16: ${width}v horizontal neighbour (${r},${c}) differs in one bit`)
        }
        if (rows > 1) {
          const down = plane.cells[(r + 1) % rows][c]
          assert(popcount(here ^ down) === 1, `17: ${width}v vertical neighbour (${r},${c}) differs in one bit`)
        }
      }
    }
  }

  // positionOf must agree with the grid it came from.
  for (const [minterm, pos] of layout.positionOf) {
    assert(layout.planes[pos.plane].cells[pos.row][pos.col] === minterm,
      `18: ${width}v positionOf(${minterm}) round trips`)
  }
}

assert(buildKMap(['A', 'B', 'C', 'D', 'E', 'F']).supported === false, '19: 6 variables unsupported')

// Five variables become two planes selected by the first variable.
const five = buildKMap(VARS)
assert(five.planes.length === 2, '20: 5 variables is two planes')
assert(five.planeVar === 'A', '21: the first variable selects the plane')
assert(five.planes[0].label === 'A = 0' && five.planes[1].label === 'A = 1', '22: plane labels')
assert(four().planes.length === 1, '23: 4 variables is one plane')
function four() { return buildKMap(['A', 'B', 'C', 'D']) }

// --- Known groupings ---------------------------------------------------------

const layout4 = four()

// Bit positions over ABCD: A is bit 3, B bit 2, C bit 1, D bit 0.
// B'D' eliminates A and C, so mask = bit3 | bit1 = 0b1010, giving the four
// corners 0, 2, 8, 10. Four separate 1x1 rectangles, never one box spanning
// the whole map.
const corners = { mask: 0b1010, value: 0b0000, covers: expandCube(0b1010, 0b0000, 4) }
const cornerPlacement = implicantRectangles(corners, layout4)
assert(cornerPlacement.cells.join(',') === '0,2,8,10', '24: four-corner cells')
assert(cornerPlacement.rectangles.length === 4, `25: four corners is 4 rectangles, got ${cornerPlacement.rectangles.length}`)
assert(cornerPlacement.rectangles.every(r => r.rowSpan === 1 && r.colSpan === 1), '26: each corner is 1x1')
assert(cornerPlacement.wraps, '27: four corners flagged as wrapping')

// B'C' eliminates A and D (mask 0b1001), giving minterms 0, 1, 8, 9. Rows 0 and
// 3 of the AB axis are adjacent through the wrap, so this is one logical group
// cut into two drawable boxes.
const sideWrap = { mask: 0b1001, value: 0b0000, covers: expandCube(0b1001, 0b0000, 4) }
const sidePlacement = implicantRectangles(sideWrap, layout4)
assert(sidePlacement.cells.join(',') === '0,1,8,9', '28: edge-wrap cells')
assert(sidePlacement.rectangles.length === 2, `29: one wrapped axis is 2 rectangles, got ${sidePlacement.rectangles.length}`)
assert(sidePlacement.wraps, '30: edge wrap flagged')

// A group that does not wrap stays a single rectangle. Mask 0b0011 eliminates
// C and D; value 0b0100 fixes A = 0, B = 1, which is row 1 in full.
const middle = { mask: 0b0011, value: 0b0100, covers: expandCube(0b0011, 0b0100, 4) }
const middlePlacement = implicantRectangles(middle, layout4)
assert(middlePlacement.rectangles.length === 1, '31: non-wrapping group is one rectangle')
assert(!middlePlacement.wraps, '32: non-wrapping group not flagged')

// The whole map.
const everything = { mask: 0b1111, value: 0, covers: expandCube(0b1111, 0, 4) }
const allPlacement = implicantRectangles(everything, layout4)
assert(allPlacement.rectangles.length === 1, '33: full map is one rectangle')
assert(allPlacement.rectangles[0].rowSpan === 4 && allPlacement.rectangles[0].colSpan === 4, '34: full map spans everything')

// Five variables, group with the plane variable eliminated: appears on both maps.
const layout5 = buildKMap(VARS)
const bothPlanes = { mask: 0b10000, value: 0, covers: expandCube(0b10000, 0, 5) }
const bothPlacement = implicantRectangles(bothPlanes, layout5)
assert(bothPlacement.spansPlanes, '35: group with A eliminated spans both planes')
assert(bothPlacement.rectangles.length === 2, '36: one rectangle per plane')

const onePlane = { mask: 0b00001, value: 0b10000, covers: expandCube(0b00001, 0b10000, 5) }
assert(!implicantRectangles(onePlane, layout5).spansPlanes, '37: group with A fixed stays on one plane')

// --- The exhaustive rectangle sweep ------------------------------------------
//
// For every cube at every supported width: expand the rectangles back into cells
// and require an exact match with the cube. An oversized bounding box, a missed
// wrap, or an off-by-one span all fail here.

let cubesChecked = 0
for (let width = 1; width <= MAX_KMAP_VARS; width += 1) {
  const vars = VARS.slice(0, width)
  const layout = buildKMap(vars)
  const rowCount = 2 ** layout.rowVars.length
  const colCount = 2 ** layout.colVars.length

  for (let mask = 0; mask < 2 ** width; mask += 1) {
    for (let value = 0; value < 2 ** width; value += 1) {
      if (value & mask) continue                    // fixed bits cannot overlap eliminated ones
      cubesChecked += 1

      const covers = expandCube(mask, value, width)
      const placement = implicantRectangles({ mask, value, covers }, layout)

      const fromRectangles = new Set()
      for (const rect of placement.rectangles) {
        for (let dr = 0; dr < rect.rowSpan; dr += 1) {
          for (let dc = 0; dc < rect.colSpan; dc += 1) {
            const r = (rect.row + dr) % rowCount
            const c = (rect.col + dc) % colCount
            fromRectangles.add(layout.planes[rect.plane].cells[r][c])
          }
        }
      }

      // The renderer's contract: no rectangle may run off the edge, because a
      // wrapped <rect> cannot be drawn. Any wrap must already have been cut.
      for (const rect of placement.rectangles) {
        if (rect.row + rect.rowSpan > rowCount || rect.col + rect.colSpan > colCount) {
          failures++
          console.error(`  FAIL: ${width}v cube ${cubeToBits(mask, value, width)} has a rectangle that wraps the edge`)
          break
        }
      }

      const expected = new Set(covers)
      const extra = [...fromRectangles].filter(m => !expected.has(m))
      const missing = [...expected].filter(m => !fromRectangles.has(m))

      if (extra.length > 0) {
        failures++
        console.error(`  FAIL: ${width}v cube ${cubeToBits(mask, value, width)} rectangles cover ${extra.length} extra cell(s): ${extra.slice(0, 4)}`)
      }
      if (missing.length > 0) {
        failures++
        console.error(`  FAIL: ${width}v cube ${cubeToBits(mask, value, width)} rectangles miss ${missing.length} cell(s): ${missing.slice(0, 4)}`)
      }
      if (failures > 10) break
    }
    if (failures > 10) break
  }
  if (failures > 10) break
}
console.log(`  rectangle sweep: ${cubesChecked} cubes across 1-${MAX_KMAP_VARS} variables`)

// Rectangle count is bounded: two row runs times two column runs, per plane.
for (let width = 1; width <= 4; width += 1) {
  const layout = buildKMap(VARS.slice(0, width))
  for (let mask = 0; mask < 2 ** width; mask += 1) {
    for (let value = 0; value < 2 ** width; value += 1) {
      if (value & mask) continue
      const count = implicantRectangles({ mask, value, covers: expandCube(mask, value, width) }, layout).rectangles.length
      assert(count >= 1 && count <= 4, `38: ${width}v cube produces ${count} rectangles`)
    }
  }
}

// --- placeCover --------------------------------------------------------------

const solution = minimize(tableFromMinterms({ vars: ['A', 'B', 'C', 'D'], minterms: [0, 2, 8, 10] }))
const placed = placeCover(solution)
assert(placed.placements.length === 1, '39: B\'D\' is a single group')
assert(placed.placements[0].rectangles.length === 4, '39: drawn as four corners')
assert(placed.placements[0].essential === true, '40: the only group is essential')
assert(typeof placed.placements[0].colour === 'number', '41: colour assigned')

// Overlapping groups must not share a colour.
const overlapping = minimize(tableFromMinterms({ vars: ['A', 'B', 'C'], minterms: [0, 1, 2, 5, 6, 7] }))
const placedOverlap = placeCover(overlapping)
for (let i = 0; i < placedOverlap.placements.length; i += 1) {
  for (let j = i + 1; j < placedOverlap.placements.length; j += 1) {
    const a = new Set(placedOverlap.placements[i].cells)
    const shares = placedOverlap.placements[j].cells.some(cell => a.has(cell))
    if (shares) {
      assert(placedOverlap.placements[i].colour !== placedOverlap.placements[j].colour,
        '42: overlapping groups get different colours')
    }
  }
}

// DISJOINT groups must also differ, which is the case colouring-for-conflicts
// alone gets wrong: these three share no cell, so a conflict-graph colouring
// gives all three colour 0 and the legend stops matching the map.
const disjoint = placeCover(minimize(tableFromMinterms({
  vars: ['A', 'B', 'C', 'D'],
  minterms: [0, 1, 2, 5, 6, 7],
  dontCares: [8, 10, 11, 15],
})))
assert(disjoint.placements.length === 3, '43: three groups for this function')
assert(new Set(disjoint.placements.map(p => p.colour)).size === 3,
  '43: disjoint groups still get distinct colours')

// Distinct up to the palette size, in general.
for (const count of [1, 2, 3, 5, 8]) {
  const fake = Array.from({ length: count }, (_, i) => ({ cells: [i * 10] }))
  const colours = assignGroupColours(fake, 8)
  assert(new Set(colours).size === count, `44: ${count} groups get ${count} distinct colours`)
}

// Past the palette it repeats, but never onto an overlapping group.
const crowded = Array.from({ length: 11 }, (_, i) => ({ cells: [0, i + 1] }))
const crowdedColours = assignGroupColours(crowded, 8)
assert(crowdedColours.length === 11, '45: every group is coloured')
assert(crowdedColours.every(c => c >= 0 && c < 8), '45: colours stay inside the palette')

// A constant-0 solution has no groups but must still lay out a grid.
const zero = placeCover(minimize(tableFromMinterms({ vars: ['A', 'B'], minterms: [] })))
assert(zero.placements.length === 0, '43: constant 0 has no groups')
assert(zero.layout.supported && zero.layout.planes[0].cells.length === 2, '43: grid still built')

// Six variables: no grid, and asking for rectangles is a no-op rather than a throw.
const big = buildKMap(['A', 'B', 'C', 'D', 'E', 'F'])
assert(implicantRectangles({ mask: 0, value: 0, covers: [0] }, big).rectangles.length === 0,
  '44: unsupported width yields no rectangles')

if (failures === 0) console.log('kmapLayout: all tests passed')
else { console.error(`kmapLayout: ${failures} failure(s)`); process.exit(1) }
