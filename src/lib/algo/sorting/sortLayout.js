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
export const TEMP_LANE = 78 // vertical room below the row for the temp box
export const FRAME_ROW_HEIGHT = 46
export const BUCKET_ROW_HEIGHT = 34
export const BUCKET_LABEL_WIDTH = 34
export const RUN_ROW_HEIGHT = 44

/**
 * Room reserved either side of the array row in the viewBox.
 *
 * The left margin is not decorative. Two things live out there: the `i` pointer
 * when it sits at `low - 1`, and the `quickSort(` label on each recursion frame,
 * which is right-aligned to the frame's left edge. At the old one-cell margin
 * the label was clipped to "uickSort".
 */
export const LEFT_MARGIN = 120
export const RIGHT_MARGIN = 64

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
    tempY: activeLevel ? activeLevel.y + CELL_HEIGHT + 16 : null,
    viewBox: `${-TREE_MARGIN} 0 ${width + TREE_MARGIN * 2} ${Math.max(y, CELL_HEIGHT + POINTER_LANE)}`,
  }
}

/**
 * The main array row plus every optional band, sized to whatever the step
 * actually carries. Used by every method that sorts one array in place;
 * quicksort goes through layoutTree instead.
 *
 * @param {object} step - one animation step, or null before a run starts
 * @param {number} count - array length
 */
export function layoutForStep(step, count) {
  if (step?.segments) return layoutTree(step, count)

  const width = rowWidth(count)
  const arrayY = POINTER_LANE

  let y = arrayY + CELL_HEIGHT + 18
  const bands = []

  // The two runs being merged, drawn under the array they are feeding.
  if (step?.runs) {
    bands.push({ kind: 'runs', y, height: RUN_ROW_HEIGHT * 2 + 12 })
    y += RUN_ROW_HEIGHT * 2 + 12 + 16
  }

  // Ten bucket rows, only while a radix pass is in flight.
  if (step?.buckets) {
    bands.push({ kind: 'buckets', y, height: BUCKET_ROW_HEIGHT * 10 })
    y += BUCKET_ROW_HEIGHT * 10 + 16
  }

  // The temp box sits directly under the array, where the lecture draws it.
  if (step?.temp) {
    bands.push({ kind: 'temp', y, height: TEMP_LANE })
    y += TEMP_LANE + 8
  }

  // The call-stack ladder, deepest frame last, as in the lecture's nested
  // quickSort( … ) rows.
  const frames = (step?.frames || []).map((frame, depth) => ({
    ...frame,
    y: y + depth * FRAME_ROW_HEIGHT,
    x: cellX(frame.low),
    width: rowWidth(frame.high - frame.low + 1),
  }))
  if (frames.length > 0) {
    bands.push({ kind: 'frames', y, height: frames.length * FRAME_ROW_HEIGHT })
    y += frames.length * FRAME_ROW_HEIGHT + 8
  }

  return {
    mode: 'row',
    width,
    height: y,
    arrayY,
    bands,
    frames,
    viewBox: `${-LEFT_MARGIN} 0 ${width + LEFT_MARGIN + RIGHT_MARGIN} ${y}`,
  }
}

/** Screen span of a `ranges` entry, for the red/blue partition bands. */
export function rangeBox(range) {
  const span = range.high - range.low + 1
  return {
    x: cellX(range.low) - 4,
    width: rowWidth(span) + 8,
    role: range.role,
  }
}
