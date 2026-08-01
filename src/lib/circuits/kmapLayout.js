/**
 * Karnaugh map geometry (T-089).
 *
 * Pure placement: which minterm sits in which cell, and where a prime implicant
 * from quineMcCluskey.js lands once drawn. No minimisation happens here, and
 * nothing here decides which groups to show.
 *
 * The one thing this file exists to get right: a group is returned as a LIST of
 * rectangles, not one. On a Gray-coded map the grid is a torus, so B'D' over
 * ABCD occupies the four corners and any single bounding box drawn around them
 * covers ten cells the group does not contain. Same for any group that wraps one
 * edge. At most four rectangles are ever needed (two row runs x two column runs).
 */

// Above five variables the map stops being a reading aid. The caller falls back
// to the truth table and the minimised expression.
export const MAX_KMAP_VARS = 5

/** Gray code: consecutive entries differ in exactly one bit. */
export function grayCode(bits) {
  return Array.from({ length: 2 ** bits }, (_, i) => i ^ (i >> 1))
}

/**
 * How the variables split across the axes.
 *
 * Five variables become two four-variable planes selected by the first
 * variable, which is how it is taught: two maps side by side, and a group that
 * appears in the same place on both has that variable eliminated.
 */
export function axesFor(vars) {
  const n = vars.length
  switch (n) {
    case 0: return { planeVar: null, rowVars: [], colVars: [] }
    case 1: return { planeVar: null, rowVars: [], colVars: [vars[0]] }
    case 2: return { planeVar: null, rowVars: [vars[0]], colVars: [vars[1]] }
    case 3: return { planeVar: null, rowVars: [vars[0]], colVars: [vars[1], vars[2]] }
    case 4: return { planeVar: null, rowVars: [vars[0], vars[1]], colVars: [vars[2], vars[3]] }
    case 5: return { planeVar: vars[0], rowVars: [vars[1], vars[2]], colVars: [vars[3], vars[4]] }
    default: return null
  }
}

/**
 * @typedef {Object} KMapPlane
 * @property {number} index
 * @property {string|null} label      e.g. "A = 0", null when there is one plane
 * @property {number[][]} cells       cells[row][col] = minterm index
 * @property {string[]} rowLabels     Gray-ordered bit patterns
 * @property {string[]} colLabels
 */

/**
 * @typedef {Object} KMapLayout
 * @property {boolean} supported
 * @property {string[]} vars
 * @property {string[]} rowVars
 * @property {string[]} colVars
 * @property {string|null} planeVar
 * @property {KMapPlane[]} planes
 * @property {Map<number, {plane: number, row: number, col: number}>} positionOf
 */

/**
 * Builds the cell grid for a set of variables.
 * @param {string[]} vars - MSB first, as produced by truthTable.js
 * @returns {KMapLayout}
 */
export function buildKMap(vars) {
  const axes = axesFor(vars)
  if (!axes) {
    return { supported: false, vars, rowVars: [], colVars: [], planeVar: null, planes: [], positionOf: new Map() }
  }

  const { planeVar, rowVars, colVars } = axes
  const width = vars.length
  const rowOrder = grayCode(rowVars.length)
  const colOrder = grayCode(colVars.length)
  const planeCount = planeVar ? 2 : 1

  // Bit position of each variable in the minterm index. vars[0] is the MSB, so
  // it sits at bit width-1. This is the single place the mapping is defined.
  const bitOf = {}
  vars.forEach((name, k) => { bitOf[name] = width - 1 - k })

  const planes = []
  const positionOf = new Map()

  for (let p = 0; p < planeCount; p += 1) {
    const cells = []
    for (let r = 0; r < rowOrder.length; r += 1) {
      const row = []
      for (let c = 0; c < colOrder.length; c += 1) {
        let index = 0
        if (planeVar && p === 1) index |= 1 << bitOf[planeVar]
        rowVars.forEach((name, k) => {
          const bit = (rowOrder[r] >> (rowVars.length - 1 - k)) & 1
          if (bit) index |= 1 << bitOf[name]
        })
        colVars.forEach((name, k) => {
          const bit = (colOrder[c] >> (colVars.length - 1 - k)) & 1
          if (bit) index |= 1 << bitOf[name]
        })
        row.push(index)
        positionOf.set(index, { plane: p, row: r, col: c })
      }
      cells.push(row)
    }

    planes.push({
      index: p,
      label: planeVar ? `${planeVar} = ${p}` : null,
      cells,
      rowLabels: rowOrder.map(v => toBits(v, rowVars.length)),
      colLabels: colOrder.map(v => toBits(v, colVars.length)),
    })
  }

  return { supported: true, vars, rowVars, colVars, planeVar, planes, positionOf }
}

function toBits(value, width) {
  if (width === 0) return ''
  return value.toString(2).padStart(width, '0')
}

/**
 * @typedef {Object} GroupRectangle
 * @property {number} plane
 * @property {number} row
 * @property {number} col
 * @property {number} rowSpan
 * @property {number} colSpan
 */

/**
 * Where one implicant lands on the map.
 *
 * @param {import('./quineMcCluskey.js').Implicant} implicant
 * @param {KMapLayout} layout
 * @returns {{rectangles: GroupRectangle[], cells: number[], spansPlanes: boolean, wraps: boolean}}
 */
export function implicantRectangles(implicant, layout) {
  if (!layout.supported) return { rectangles: [], cells: [], spansPlanes: false, wraps: false }

  const rowCount = 2 ** layout.rowVars.length
  const colCount = 2 ** layout.colVars.length
  const covered = new Set(implicant.covers)

  const rectangles = []
  const cells = []
  let wraps = false
  const planesTouched = new Set()

  for (const plane of layout.planes) {
    const rows = new Set()
    const cols = new Set()

    for (let r = 0; r < rowCount; r += 1) {
      for (let c = 0; c < colCount; c += 1) {
        if (!covered.has(plane.cells[r][c])) continue
        rows.add(r)
        cols.add(c)
        cells.push(plane.cells[r][c])
      }
    }

    if (rows.size === 0) continue
    planesTouched.add(plane.index)

    // A subcube on a Gray map is always a full row-set x column-set product,
    // and each of those sets is contiguous once the wrap is allowed for. Take
    // the cyclic runs, then cut any run that crosses the edge in two: a
    // rectangle that wrapped could not be drawn as a single <rect>, so the
    // splitting has to happen here rather than in every renderer.
    const rowRuns = cyclicRuns([...rows].sort((a, b) => a - b), rowCount).flatMap(r => splitRun(r, rowCount))
    const colRuns = cyclicRuns([...cols].sort((a, b) => a - b), colCount).flatMap(r => splitRun(r, colCount))

    if (rowRuns.length > 1 || colRuns.length > 1) wraps = true

    for (const rowRun of rowRuns) {
      for (const colRun of colRuns) {
        rectangles.push({
          plane: plane.index,
          row: rowRun.start,
          col: colRun.start,
          rowSpan: rowRun.length,
          colSpan: colRun.length,
        })
      }
    }
  }

  return {
    rectangles,
    cells: [...new Set(cells)].sort((a, b) => a - b),
    spansPlanes: planesTouched.size > 1,
    wraps,
  }
}

/**
 * Maximal runs of consecutive indices on a ring of `size` positions.
 *
 * [0, 1] of 4 is one run. [0, 3] of 4 is also one run, because 3 wraps to 0 and
 * the two cells are adjacent on the map even though they are not adjacent as
 * numbers. Treating them as two separate runs would draw two 1-wide boxes where
 * the group is really one 2-wide box crossing the edge.
 *
 * @param {number[]} sorted - ascending, deduped
 * @param {number} size
 * @returns {Array<{start: number, length: number}>}
 */
export function cyclicRuns(sorted, size) {
  if (sorted.length === 0) return []
  if (sorted.length >= size) return [{ start: 0, length: size }]

  const present = new Set(sorted)
  const runs = []

  for (const start of sorted) {
    // Only begin a run where the previous position is absent, so each run is
    // counted once from its true start.
    const before = (start - 1 + size) % size
    if (present.has(before)) continue

    let length = 0
    let at = start
    while (present.has(at) && length < size) {
      length += 1
      at = (at + 1) % size
    }
    runs.push({ start, length })
  }

  return runs
}

/**
 * Cuts a cyclic run at the grid edge so every rectangle can be drawn directly.
 *
 * A run of length 2 starting at row 3 of 4 covers rows 3 and 0. As one rectangle
 * that is un-drawable; as two 1-high rectangles it is exactly the pair of boxes a
 * textbook draws for a group that wraps.
 *
 * @param {{start: number, length: number}} run
 * @param {number} size
 * @returns {Array<{start: number, length: number}>}
 */
function splitRun(run, size) {
  const end = run.start + run.length
  if (end <= size) return [run]
  return [
    { start: run.start, length: size - run.start },
    { start: 0, length: end - size },
  ]
}

/**
 * Colour index per group.
 *
 * Every group gets its own colour while the palette lasts. Colouring only to
 * resolve overlaps is the textbook graph-colouring answer and it is wrong here:
 * three disjoint groups would all come out colour 0, and the legend beside the
 * map becomes unmatchable to it, which is the whole reason the colours exist.
 *
 * Past eight groups the palette has to repeat. It repeats on a colour no
 * OVERLAPPING group is using, because two boxes sharing a cell in one colour
 * read as a single group, whereas two separated boxes in one colour are merely
 * ambiguous.
 *
 * @param {Array<{cells: number[]}>} placements
 * @param {number} paletteSize
 * @returns {number[]}
 */
export function assignGroupColours(placements, paletteSize = 8) {
  const sets = placements.map(p => new Set(p.cells))
  const colours = []

  for (let i = 0; i < placements.length; i += 1) {
    const clashing = new Set()
    for (let j = 0; j < i; j += 1) {
      if ([...sets[i]].some(cell => sets[j].has(cell))) clashing.add(colours[j])
    }

    let colour = firstFree(new Set(colours), paletteSize)
    if (colour === null) colour = firstFree(clashing, paletteSize)
    if (colour === null) colour = i % paletteSize

    colours.push(colour)
  }

  return colours
}

function firstFree(taken, paletteSize) {
  for (let colour = 0; colour < paletteSize; colour += 1) {
    if (!taken.has(colour)) return colour
  }
  return null
}

/**
 * Everything the K-map view needs for one solution.
 *
 * @param {import('./quineMcCluskey.js').Solution} solution
 * @param {{coverIndex?: number}} [options]
 */
export function placeCover(solution, { coverIndex = 0 } = {}) {
  const layout = buildKMap(solution.vars)
  const cover = solution.covers[coverIndex] ?? solution.covers[0]

  const placements = (cover?.implicants ?? []).map((implicant) => ({
    implicant,
    ...implicantRectangles(implicant, layout),
    essential: solution.essential.includes(implicant),
  }))

  const colours = assignGroupColours(placements)
  placements.forEach((p, i) => { p.colour = colours[i] })

  return { layout, cover, placements }
}
