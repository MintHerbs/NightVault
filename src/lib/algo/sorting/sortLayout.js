// src/lib/algo/sorting/sortLayout.js
//
// Geometry for the sorting canvas (T-105). Pure, like src/lib/treeLayout.js and
// for the same reason: cell positions, frame offsets and bucket rows are the
// part most likely to go subtly wrong, and a function of numbers can be tested
// without a browser where an SVG component cannot.
//
// Everything is laid out in one viewBox-space coordinate system. The component
// scales the whole thing to fit, so nothing here needs to know the real pixel
// size of the panel.

export const CELL_WIDTH = 56
export const CELL_HEIGHT = 56
export const CELL_GAP = 8
export const POINTER_LANE = 46 // vertical room above the row for the i/j markers
export const TEMP_LANE = 94 // vertical room below the row for the temp box

/* Gap between a row and its temp box. Wide enough to clear the row's index
   numbers, which sit 13px under the cells — at the old 16px the word "temp"
   landed on top of them. */
export const TEMP_OFFSET = 30
export const BUCKET_ROW_HEIGHT = 34
export const BUCKET_LABEL_WIDTH = 34
export const RUN_ROW_HEIGHT = 44

/** Vertical space between one recursion level and the next. */
export const LEVEL_GAP = 26

/**
 * Clear space a `quickSort` label plus its bracket needs on one side.
 *
 * The label goes on whichever side has room, left preferred, which is what the
 * lecture slide does: `quickSort( … )` on the left half and `( … )quickSort` on
 * the right. Pinning every label to the left instead put the right half's label
 * straight through the left half's last cell.
 */
export const LABEL_SPACE = 78

/** Room either side of the tree, wide enough for a label on the outer edge. */
export const TREE_MARGIN = 128

/** Width a row of `count` cells occupies, gaps included. */
export function rowWidth(count) {
  if (count <= 0) return 0
  return count * CELL_WIDTH + (count - 1) * CELL_GAP
}

/** Left edge of cell `index` in a row starting at x = 0. */
export function cellX(index) {
  return index * (CELL_WIDTH + CELL_GAP)
}

/** Centre of cell `index`, which is where a pointer marker sits. */
export function cellCenterX(index) {
  return cellX(index) + CELL_WIDTH / 2
}

/**
 * Where a pointer marker goes, including the case that matters most.
 *
 * `i` legitimately sits at `low - 1` while it is still outside the range — the
 * descending lecture trace opens on exactly that state and holds it for the
 * first comparison. Clamping it onto cell 0 would draw the pointer as if it had
 * already entered, which is the one thing this marker must not imply. Half a
 * gap outside the row is the honest position.
 */
export function pointerX(index, count) {
  if (index < 0) return cellX(0) - CELL_GAP - CELL_WIDTH / 2
  if (index >= count) return cellX(count - 1) + CELL_WIDTH + CELL_GAP + CELL_WIDTH / 2
  return cellCenterX(index)
}

/**
 * The recursion tree: one row per depth, deepest last, plus the combined
 * result underneath once the run finishes.
 *
 * Only the level currently being worked on gets the pointer lane above it and
 * the temp lane below it. Reserving that room on every level would make a deep
 * recursion three times taller than it needs to be; reserving it only when temp
 * is actually on screen would make every row below jump by 78px twice per swap.
 * Reserving it for the whole time a level is active is the version that neither
 * wastes space nor moves.
 *
 * @param {object} step - one animation step carrying `segments`
 * @param {number} count - array length
 */
export function layoutTree(step, count) {
  const width = rowWidth(count)
  const segments = step?.segments || []
  const activeDepth = segments.find((s) => s.state === 'active')?.depth ?? null

  const byDepth = new Map()
  for (const segment of segments) {
    if (!byDepth.has(segment.depth)) byDepth.set(segment.depth, [])
    byDepth.get(segment.depth).push(segment)
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b)
  const levels = []
  let y = 0

  for (const depth of depths) {
    const isActive = depth === activeDepth
    const rowY = y + (isActive ? POINTER_LANE : 10)
    // Siblings own disjoint ranges, so left-to-right order is by `low` and the
    // gap between two of them is exactly the pivot column that separated them.
    const placed = byDepth
      .get(depth)
      .map((segment) => ({
        ...segment,
        x: cellX(segment.low),
        width: rowWidth(segment.high - segment.low + 1),
      }))
      .sort((a, b) => a.x - b.x)

    placed.forEach((segment, index) => {
      const leftRoom = segment.x - (index === 0 ? -TREE_MARGIN : placed[index - 1].x + placed[index - 1].width)
      const rightRoom =
        (index === placed.length - 1 ? width + TREE_MARGIN : placed[index + 1].x) -
        (segment.x + segment.width)
      segment.labelSide =
        leftRoom >= LABEL_SPACE ? 'left' : rightRoom >= LABEL_SPACE ? 'right' : null
    })

    levels.push({ depth, y: rowY, isActive, segments: placed })
    y = rowY + CELL_HEIGHT + (isActive ? TEMP_LANE : 0) + LEVEL_GAP
  }

  // The payoff row. Held back until the run finishes: showing it earlier would
  // give away the answer the animation is in the middle of working out.
  const result = step?.type === 'done' ? { y: y + 14, values: step.array } : null
  if (result) y = result.y + CELL_HEIGHT + LEVEL_GAP

  const activeLevel = levels.find((level) => level.isActive) || null

  return {
    mode: 'tree',
    width,
    height: Math.max(y, CELL_HEIGHT + POINTER_LANE),
    levels,
    activeLevel,
    result,
    // The temp box hangs off the active row; everything else is per-level.
    tempY: activeLevel ? activeLevel.y + CELL_HEIGHT + TEMP_OFFSET : null,
    viewBox: `${-TREE_MARGIN} 0 ${width + TREE_MARGIN * 2} ${Math.max(y, CELL_HEIGHT + POINTER_LANE)}`,
  }
}

/* History ------------------------------------------------------------------
   The stacked record of every look the algorithm took at the array: one row
   per comparison (or per bucket move, or per merge take), frozen at the state
   that look left behind, grouped under the pass it belongs to.

   This is the thing the lecture diagram is actually made of, and it is why the
   rows are kept rather than mutated in place — "what did the array look like
   three comparisons ago" is the question the diagram exists to answer.
*/

export const HISTORY_ROW_GAP = 10
export const PASS_GAP = 26
export const PASS_LABEL_LANE = 22
export const PASS_RULE_INSET = 14

/**
 * Fold a step prefix into history rows.
 *
 * Pure and prefix-driven rather than accumulated into each step: a step already
 * carries a full array snapshot, so storing the whole history on every one of
 * them would be quadratic in memory for no new information.
 *
 * @param {object[]} steps - the whole run
 * @param {number} index - the step currently on screen
 * @returns {object[]} rows, oldest first, the last one live
 */
export function buildHistory(steps, index) {
  if (!steps || steps.length === 0) return []
  const upto = Math.max(0, Math.min(index, steps.length - 1))
  const rows = []

  for (let n = 0; n <= upto; n++) {
    const step = steps[n]
    if (step.rowStart || rows.length === 0) {
      rows.push({
        rowIndex: rows.length,
        pass: step.pass ?? 0,
        passLabel: step.passLabel || '',
        values: step.array,
        marks: step.marks || {},
        ranges: step.ranges || null,
        live: false,
      })
    } else {
      // Not a new row: this step refines the one already open, which is how the
      // three beats of a swap animate inside a single comparison's row.
      const row = rows[rows.length - 1]
      row.values = step.array
      row.marks = step.marks || {}
      row.ranges = step.ranges || null
    }
  }

  const last = rows[rows.length - 1]
  if (last) last.live = true
  for (const row of rows) {
    // Cheap identity so a finished row can skip re-rendering while the live one
    // moves. Completed rows never change again, so this is stable for them.
    row.signature = `${row.values.join(',')}|${Object.entries(row.marks).sort().join(',')}|${row.live}`
  }
  return rows
}

/**
 * Geometry for the history stack.
 *
 * Only the live row reserves the pointer lane above and the temp lane below,
 * for the same reason the recursion tree does it: reserving on every row
 * triples the height of a long run, and reserving only while temp is on screen
 * makes everything below it jump twice per swap.
 */
export function layoutHistory(rows, count, { hasTemp = true, auxHeight = 0 } = {}) {
  const width = rowWidth(count)
  const groups = []
  let y = 0

  for (const row of rows) {
    let group = groups[groups.length - 1]
    if (!group || group.pass !== row.pass) {
      if (group) y += PASS_GAP
      y += PASS_LABEL_LANE
      group = { pass: row.pass, label: row.passLabel, y, rows: [], height: 0 }
      groups.push(group)
    }

    const rowY = y + (row.live ? POINTER_LANE : 0)
    group.rows.push({ ...row, y: rowY })
    // The live row also carries whatever auxiliary display this method needs
    // hanging off it — merge's two runs, radix's ten buckets — so the rows that
    // come after it have to clear that too.
    y =
      rowY +
      CELL_HEIGHT +
      (row.live && hasTemp ? TEMP_LANE : 0) +
      (row.live ? auxHeight : 0) +
      HISTORY_ROW_GAP
    group.height = y - group.y
  }

  const liveGroup = groups.find((g) => g.rows.some((r) => r.live)) || null
  const liveRow = liveGroup?.rows.find((r) => r.live) || null

  return {
    mode: 'history',
    width,
    height: Math.max(y, CELL_HEIGHT + POINTER_LANE),
    groups,
    liveRow,
    tempY: liveRow ? liveRow.y + CELL_HEIGHT + TEMP_OFFSET : null,
    auxY: liveRow ? liveRow.y + CELL_HEIGHT + (hasTemp ? TEMP_LANE : 0) + TEMP_OFFSET : null,
    // Everything that belongs to the live row, not just the row: the scroll
    // anchor spans this, so following the live row does not leave its temp box
    // or its buckets hanging below the fold.
    liveBlockHeight: CELL_HEIGHT + (hasTemp ? TEMP_LANE : 0) + auxHeight,
    viewBox: `${-TREE_MARGIN} 0 ${width + TREE_MARGIN * 2} ${Math.max(y, CELL_HEIGHT + POINTER_LANE)}`,
  }
}
