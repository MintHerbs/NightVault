// Gemini structured-output schema for the FSM generator (T-089 phase 3).
//
// Follows erdResponseSchema.js's conventions: only the subset of OpenAPI schema
// Gemini has supported longest (type / properties / items / required / enum /
// description), no anyOf, no propertyOrdering, no $ref. api/fsm.js falls back
// to a schema-less call if the schema is ever rejected, so a bad field here
// degrades to plain JSON mode rather than taking generation down.
//
// **Deliberately loose where it matters.** The ERD prompt experiment on
// 2026-07-31 found the cardinality enum was itself blocking correct ternary
// relationships: the prompt was not the ceiling, the schema was. So here:
//   - the state count is not capped,
//   - `inputs` is not restricted to a single signal,
//   - state ids are not enumerated,
//   - input/output maps are free-form objects, because their keys are the
//     signal names the model chose and cannot be known in advance.
// fsmParser.js is the authority on all of that, and it can explain a rejection
// in a sentence where a schema violation just returns a 400.

import { MACHINE_TYPES } from './fsmParser.js'

const signalSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Signal name, a letter then letters or digits' },
    description: { type: 'string', description: 'What this signal means' },
  },
  required: ['name'],
}

// The value maps are keyed by signal name, which is only known once the model
// has chosen it, so they are declared as plain objects. Gemini cannot express
// "an object whose keys come from another field".
const valueMap = {
  type: 'object',
  description: 'Keys are signal names, values are the numbers 0 or 1',
}

export const FSM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short name for the machine' },
    machineType: { type: 'string', enum: MACHINE_TYPES },
    inputs: { type: 'array', description: 'Every input signal', items: signalSchema },
    outputs: { type: 'array', description: 'Every output signal', items: signalSchema },
    reset: { type: 'string', description: 'Id of the starting state' },
    states: {
      type: 'array',
      description: 'Every state. Moore machines put the output here.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier, no spaces' },
          label: { type: 'string', description: 'What this state means, e.g. "saw 10"' },
          output: valueMap,
        },
        required: ['id'],
      },
    },
    transitions: {
      type: 'array',
      description: 'One per state per input combination. Mealy machines put the output here.',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Must match a states[].id' },
          to: { type: 'string', description: 'Must match a states[].id' },
          input: valueMap,
          output: valueMap,
        },
        required: ['from', 'to', 'input'],
      },
    },
  },
  required: ['machineType', 'inputs', 'outputs', 'reset', 'states', 'transitions'],
}
