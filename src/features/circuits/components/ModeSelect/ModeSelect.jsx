/**
 * ModeSelect - the Digital Logic mode registry (T-089).
 *
 * Used to also export the dropdown that switched between the four modes
 * in-page. That's gone (owner decision): each mode is its own card on the
 * course landing page / home page now (src/constants/tools.js), reached
 * through its own `?mode=` route rather than a selector inside the page. What
 * stays here is the data every mode-aware view still needs — the list itself,
 * and the lookup helpers DigitalLogicPage and ExpressionInput read from it.
 *
 */

// `ready` is flipped as each phase lands (docs/specs/digital-logic.md §11).
// A mode that is listed but not ready renders its own panel rather than
// falling through to an input it cannot answer.
export const MODES = [
  {
    id: 'algebra',
    label: 'Boolean algebra',
    hint: 'Simplify step by step, with the law used at each stage',
    ready: true,
  },
  {
    id: 'kmap',
    label: 'Truth table & K-map',
    hint: 'Expression to truth table to K-map to circuit',
    ready: true,
  },
  {
    id: 'sandbox',
    label: 'Circuit sandbox',
    hint: 'Build and run a circuit with gates and flip-flops',
    ready: true,
  },
  {
    id: 'fsm',
    label: 'State machine',
    hint: 'A question to an FSM to a synthesised circuit',
    ready: true,
  },
]

export const DEFAULT_MODE = 'kmap'
export const isKnownMode = (id) => MODES.some(m => m.id === id)
export const isReadyMode = (id) => MODES.some(m => m.id === id && m.ready)
export const modeById = (id) => MODES.find(m => m.id === id) ?? MODES.find(m => m.id === DEFAULT_MODE)
