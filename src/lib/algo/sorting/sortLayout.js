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
 * The main array row plus every optional band, sized to whatever the step
 * actually carries.
 *
 * @param {object} step - one animation step, or null before a run starts
 * @param {number} count - array length
 */
export function layoutForStep(step, count) {
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
