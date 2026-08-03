// src/lib/algo/sorting/pseudocode.js
//
// The listing shown beside the canvas, with the line at `step.codeLine`
// highlighted (T-105). This is what turns "a cell moved" into "line 13 ran".
//
// Direction-aware rather than static: an engine that tested `A[j] >= pivot`
// beside a listing that reads `A[j] <= pivot` is teaching the wrong thing, and
// the comparison operator is the whole of what descending changes.
//
// The LINES tables below are the contract between each engine and its listing.
// Renumbering a listing without updating its table silently highlights the
// wrong row, so both live in this file.

import { DESC } from './steps.js'

/** Named line numbers, so no engine carries a bare index into a listing. */
export const QUICK_LINES = {
  call: 0,
  guard: 1,
  partitionCall: 2,
  recurseLeft: 3,
  recurseRight: 4,
  header: 6,
  pivot: 7,
  initI: 8,
  loop: 9,
  test: 10,
  incI: 11,
  hold: 12,
  writeLeft: 13,
  writeRight: 14,
  pivotHold: 15,
  pivotWriteLeft: 16,
  pivotWriteRight: 17,
  ret: 18,
}

export const MERGE_LINES = {
  call: 0,
  guard: 1,
  mid: 2,
  recurseLeft: 3,
  recurseRight: 4,
  mergeCall: 5,
  header: 7,
  split: 8,
  init: 9,
  loop: 10,
  test: 11,
  takeLeft: 12,
  takeRight: 14,
  drainLeft: 15,
  drainRight: 16,
}

export const RADIX_LINES = {
  call: 0,
  place: 1,
  empty: 2,
  scan: 3,
  scatter: 4,
  collect: 5,
  ret: 6,
}

export const BUBBLE_LINES = {
  call: 0,
  outer: 1,
  resetFlag: 2,
  inner: 3,
  test: 4,
  hold: 5,
  writeLeft: 6,
  writeRight: 7,
  setFlag: 8,
  earlyExit: 9,
}

export const INSERTION_LINES = {
  call: 0,
  outer: 1,
  key: 2,
  initJ: 3,
  test: 4,
  shift: 5,
  decJ: 6,
  place: 7,
}

export const SELECTION_LINES = {
  call: 0,
  outer: 1,
  initMin: 2,
  inner: 3,
  test: 4,
  setMin: 5,
  hold: 6,
  writeLeft: 7,
  writeRight: 8,
}

function quick(rel) {
  return [
    'quickSort(A, low, high)',
    '  if low < high',
    '    p = partition(A, low, high)',
    '    quickSort(A, low, p - 1)',
    '    quickSort(A, p + 1, high)',
    '',
    'partition(A, low, high)',
    '  pivot = A[high]',
    '  i = low - 1',
    '  for j = low to high - 1',
    `    if A[j] ${rel} pivot`,
    '      i = i + 1',
    '      temp = A[i]',
    '      A[i] = A[j]',
    '      A[j] = temp',
    '  temp = A[i + 1]',
    '  A[i + 1] = A[high]',
    '  A[high] = temp',
    '  return i + 1',
  ]
}

function merge(rel) {
  return [
    'mergeSort(A, low, high)',
    '  if low < high',
    '    mid = (low + high) / 2',
    '    mergeSort(A, low, mid)',
    '    mergeSort(A, mid + 1, high)',
    '    merge(A, low, mid, high)',
    '',
    'merge(A, low, mid, high)',
    '  L = A[low..mid]   R = A[mid+1..high]',
    '  i = 0   j = 0   k = low',
    '  while i < |L| and j < |R|',
    `    if L[i] ${rel} R[j]`,
    '      A[k++] = L[i++]',
    '    else',
    '      A[k++] = R[j++]',
    '  copy what is left of L into A[k..]',
    '  copy what is left of R into A[k..]',
  ]
}

function radix(direction) {
  return [
    'radixSort(A)',
    '  for each digit place d = 1, 10, 100, ...',
    '    empty buckets 0..9',
    '    for each value v in A, in order',
    '      append v to bucket[(v / d) mod 10]',
    direction === DESC
      ? '    collect buckets 9 -> 0 back into A'
      : '    collect buckets 0 -> 9 back into A',
    '  return A',
  ]
}

function bubble(rel) {
  return [
    'bubbleSort(A)',
    '  for i = 0 to n - 2',
    '    swapped = false',
    '    for j = 0 to n - 2 - i',
    `      if A[j] ${rel} A[j + 1]`,
    '        temp = A[j]',
    '        A[j] = A[j + 1]',
    '        A[j + 1] = temp',
    '        swapped = true',
    '    if not swapped, stop',
  ]
}

function insertion(rel) {
  return [
    'insertionSort(A)',
    '  for i = 1 to n - 1',
    '    key = A[i]',
    '    j = i - 1',
    `    while j >= 0 and A[j] ${rel} key`,
    '      A[j + 1] = A[j]',
    '      j = j - 1',
    '    A[j + 1] = key',
  ]
}

function selection(rel) {
  return [
    'selectionSort(A)',
    '  for i = 0 to n - 2',
    '    min = i',
    '    for j = i + 1 to n - 1',
    `      if A[j] ${rel} A[min]`,
    '        min = j',
    // Four spaces, not six: the swap runs once the scan has finished, not once
    // per comparison. Indenting it into the inner loop said selection sort
    // swaps on every comparison, which is precisely the thing that separates it
    // from bubble sort and precisely what the animation shows it not doing.
    '    temp = A[i]',
    '    A[i] = A[min]',
    '    A[min] = temp',
  ]
}

/**
 * The listing for one method, with its comparisons written for `direction`.
 *
 * @param {string} algo - quick | merge | radix | bubble | insertion | selection
 * @param {string} direction - asc | desc
 * @returns {string[]} one entry per line
 */
export function pseudocodeFor(algo, direction) {
  // Bubble and insertion compare two array cells and swap when they are out of
  // order, so their test is the *strict* opposite of the sort direction, where
  // quicksort and merge ask the inclusive "does this belong on this side".
  const inclusive = direction === DESC ? '>=' : '<='
  const strictSwap = direction === DESC ? '<' : '>'
  const strictPick = direction === DESC ? '>' : '<'

  switch (algo) {
    case 'quick':
      return quick(inclusive)
    case 'merge':
      return merge(inclusive)
    case 'radix':
      return radix(direction)
    case 'bubble':
      return bubble(strictSwap)
    case 'insertion':
      return insertion(strictSwap)
    case 'selection':
      return selection(strictPick)
    default:
      return []
  }
}
