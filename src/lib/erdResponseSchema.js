// Gemini structured-output schema for the ERD generator.
//
// With responseMimeType 'application/json' the model returns *some* JSON; with a
// responseSchema it returns json of THIS shape, with enum fields constrained at
// decode time. That removes the class of failure erdParser.js was written to
// survive by hand ("multi_valued" instead of "multiValued", a missing isWeak, a
// cardinality of "many") rather than repairing it after the fact.
//
// The enums are imported, never re-typed, so this file cannot drift from the
// validator. test-erd-integration.js asserts that.
//
// Deliberately restricted to the subset of OpenAPI schema that Gemini has
// supported for the longest: type / properties / items / required / enum /
// description / nullable. No anyOf, no propertyOrdering, no $ref: the payload is
// worth less than the risk of a 400 on an untested field. api/gemini.js also
// falls back to a schema-less call if the schema is ever rejected, so a bad field
// here degrades to today's behaviour instead of breaking generation.

import { ATTRIBUTE_TYPES, CARDINALITIES, PARTICIPATIONS, ISA_CONSTRAINTS } from './erdParser.js'

// Attributes have the same shape on entities and on relationships.
const attributeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique identifier, lowercase, no spaces' },
    name: { type: 'string', description: 'Display name' },
    type: { type: 'string', enum: ATTRIBUTE_TYPES },
  },
  required: ['id', 'name', 'type'],
}

export const ERD_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      description: 'Every entity in the diagram',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier, lowercase, no spaces' },
          name: { type: 'string', description: 'Display name, singular' },
          isWeak: { type: 'boolean', description: 'True only for a weak entity' },
          attributes: { type: 'array', items: attributeSchema },
        },
        required: ['id', 'name', 'isWeak', 'attributes'],
      },
    },
    relationships: {
      type: 'array',
      description: 'Relationships between entities. Empty array if there are none.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', description: 'Verb phrase' },
          isIdentifying: { type: 'boolean', description: 'True only if it identifies a weak entity' },
          participants: {
            type: 'array',
            description: 'At least two. Three only for a genuine ternary.',
            items: {
              type: 'object',
              properties: {
                entityId: { type: 'string', description: 'Must match an entities[].id' },
                cardinality: { type: 'string', enum: CARDINALITIES },
                participation: { type: 'string', enum: PARTICIPATIONS },
              },
              required: ['entityId', 'cardinality', 'participation'],
            },
          },
          attributes: { type: 'array', items: attributeSchema },
        },
        required: ['id', 'name', 'isIdentifying', 'participants', 'attributes'],
      },
    },
    isA: {
      type: 'array',
      description: 'IS-A hierarchies. Empty array if there are none.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          parent: { type: 'string', description: 'Superclass entity id' },
          children: { type: 'array', items: { type: 'string' }, description: 'Subclass entity ids' },
          constraint: { type: 'string', enum: ISA_CONSTRAINTS },
          participation: { type: 'string', enum: PARTICIPATIONS },
        },
        required: ['id', 'parent', 'children', 'constraint', 'participation'],
      },
    },
  },
  required: ['entities', 'relationships', 'isA'],
}
