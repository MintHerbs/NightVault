// src/lib/algo/sorting/index.js
//
// Public face of the sorting engines (T-105). One trace function, one method
// table, so the page never imports an individual algorithm and adding a seventh
// method is an edit in one place.

import traceBubbleSort from './bubbleSort.js'
import traceInsertionSort from './insertionSort.js'
import traceMergeSort from './mergeSort.js'
import traceQuickSort from './quickSort.js'
import traceRadixSort from './radixSort.js'
import traceSelectionSort from './selectionSort.js'
import { ASC, DESC } from './steps.js'

export { ASC, DESC } from './steps.js'
export { parseSortInput, MIN_VALUES, MAX_VALUES } from './parseSortInput.js'
export { pseudocodeFor } from './pseudocode.js'

/**
 * The methods the tool offers, in the order the dropdown lists them.
 *
 * `blurb` is the one-line "what am I watching" shown under the canvas, not a
 * complexity table: the complexity tool already exists and repeating it here
 * would be the wrong lesson for a page about the mechanics.
 */
export const METHODS = [
  {
    id: 'quick',
    label: 'Quicksort',
    trace: traceQuickSort,
    blurb: 'Pick the last value as the pivot, sweep j across the range moving smaller values behind i, then drop the pivot into the gap and repeat on each side.',
  },
  {
    id: 'merge',
    label: 'Merge Sort',
    trace: traceMergeSort,
    blurb: 'Split the array down to single values, then merge the pieces back together two at a time, always taking whichever run has the better head.',
  },
  {
    id: 'radix',
    label: 'Radix Sort',
    trace: traceRadixSort,
    blurb: 'No comparisons at all. Deal every value into a bucket by its ones digit, collect them back up, and repeat for each higher digit.',
  },
  {
    id: 'bubble',
    label: 'Bubble Sort',
    trace: traceBubbleSort,
    blurb: 'Walk j along the array swapping any pair that is out of order. Each pass carries one more value to its final place at the end.',
  },
  {
    id: 'insertion',
    label: 'Insertion Sort',
    trace: traceInsertionSort,
    blurb: 'Lift each value out into key, walk back through the sorted prefix shifting bigger values right, and drop key into the gap that opens.',
  },
  {
    id: 'selection',
    label: 'Selection Sort',
    trace: traceSelectionSort,
    blurb: 'Scan the unsorted part for the value that belongs next, then make exactly one swap to put it there.',
  },
]

export const METHOD_BY_ID = new Map(METHODS.map((m) => [m.id, m]))

export const DEFAULT_METHOD = 'quick'

/**
 * Build the animation steps for one run.
 *
 * @param {number[]} values
 * @param {string} method - a METHODS id
 * @param {string} direction - ASC | DESC
 * @returns {object[]} steps, never mutating `values`
 */
export function traceSort(values, method, direction) {
  const entry = METHOD_BY_ID.get(method)
  if (!entry) return []
  return entry.trace([...values], direction === DESC ? DESC : ASC)
}

/** The result the run should reach, for the page's summary line and the tests. */
export function expectedResult(values, direction) {
  return [...values].sort((a, b) => (direction === DESC ? b - a : a - b))
}
