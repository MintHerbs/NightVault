// src/lib/algo/sorting/parseSortInput.js
//
// Turns what was typed into the pill into the array the engines run on, or into
// a reason it cannot (T-105). Same `{ values, error }` shape as
// parseRecurrence, so the page's error path is the one it already has.

/** Fewer than this and there is nothing to watch being sorted. */
export const MIN_VALUES = 3

/**
 * A step-count bound, not a taste call. Bubble and selection are quadratic in
 * comparisons, so 24 values is already around 275 comparisons and, once the
 * pointer and swap beats are counted, over a thousand frames. The player
 * compresses long runs (useAnimationPlayer's maxTotalMs), which keeps that
 * watchable; at 50 values it would not be.
 */
export const MAX_VALUES = 24

/** Radix reads base-10 digits, and a digit has no representation for a sign. */
export const RADIX_NEEDS_NON_NEGATIVE =
  'Radix sort reads one base-10 digit at a time, and a digit cannot carry a minus sign. Remove the negative values, or pick another method.'

/**
 * @param {string} raw - the pill's contents
 * @param {string} [method] - the selected algorithm, for method-specific limits
 * @returns {{ values: number[], error: string|null }}
 */
export function parseSortInput(raw, method) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) {
    return { values: [], error: 'Enter some numbers to sort, separated by commas.' }
  }

  const tokens = text.split(/[\s,]+/).filter(Boolean)
  const values = []

  for (const token of tokens) {
    // Deliberately strict. Number('') is 0 and Number('1e3') is 1000, and both
    // would silently sort something other than what was typed.
    if (!/^-?\d+$/.test(token)) {
      return { values: [], error: `"${token}" is not a whole number. Use whole numbers separated by commas.` }
    }
    const value = Number(token)
    if (!Number.isSafeInteger(value)) {
      return { values: [], error: `${token} is too large to sort here. Keep values within safe integer range.` }
    }
    values.push(value)
  }

  if (values.length < MIN_VALUES) {
    return { values: [], error: `Give at least ${MIN_VALUES} numbers. There is nothing to watch with fewer.` }
  }

  if (values.length > MAX_VALUES) {
    return {
      values: [],
      error: `That is ${values.length} numbers. The animation is capped at ${MAX_VALUES}, because every comparison and every swap is its own step and a longer array runs to thousands of them.`,
    }
  }

  if (method === 'radix' && values.some((v) => v < 0)) {
    return { values: [], error: RADIX_NEEDS_NON_NEGATIVE }
  }

  return { values, error: null }
}
