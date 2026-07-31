// Validates and parses ERD JSON into internal structure

// Canonical attribute types, keyed by every spelling an LLM realistically emits.
// Models drift between camelCase, snake_case and lowercase for the two
// multi-word types, so normalise rather than reject: a casing slip should not
// cost the student their whole diagram.
const ATTRIBUTE_TYPE_ALIASES = {
  simple: 'simple',
  key: 'key',
  primarykey: 'key',
  primary_key: 'key',
  derived: 'derived',
  computed: 'derived',
  multivalued: 'multiValued',
  multi_valued: 'multiValued',
  'multi-valued': 'multiValued',
  multivalue: 'multiValued',
  partialkey: 'partialKey',
  partial_key: 'partialKey',
  'partial-key': 'partialKey',
  discriminator: 'partialKey',
}

function canonicalAttributeType(raw) {
  if (typeof raw !== 'string') return null
  return ATTRIBUTE_TYPE_ALIASES[raw.trim().toLowerCase()] ?? null
}

// The accepted vocabularies, exported so src/lib/erdResponseSchema.js can build
// Gemini's structured-output schema from the same lists this parser validates
// against. A drift test asserts the two agree: a schema permitting a value the
// parser rejects would turn a model that obeyed us perfectly into an "invalid
// ERD" error for the student.
//
// Chen notation labels each "many" side of a relationship with its own letter, so
// a ternary reads M:N:P. Rejecting P forced the model to either mislabel a side or
// invent a junction entity to get down to two participants, and the student then
// saw a diagram that was silently wrong rather than an honest ternary.
export const CARDINALITIES = ['1', 'N', 'M', 'P']
export const PARTICIPATIONS = ['total', 'partial']
export const ISA_CONSTRAINTS = ['disjoint', 'overlapping']
export const ATTRIBUTE_TYPES = [...new Set(Object.values(ATTRIBUTE_TYPE_ALIASES))]

// Cardinality is normalised for case for the same reason attribute types are: a
// lowercase "n" should not cost the student the whole diagram.
function canonicalCardinality(raw) {
  if (typeof raw !== 'string') return null
  const up = raw.trim().toUpperCase()
  return CARDINALITIES.includes(up) ? up : null
}

/**
 * Parses and validates ERD JSON
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object} - { valid: true, data: {...} } or { valid: false, error: '...' }
 */
export function parseERD(jsonString) {
  try {
    // Step 1: Parse JSON
    let data
    try {
      data = JSON.parse(jsonString)
    } catch (err) {
      return { valid: false, error: 'Invalid JSON syntax' }
    }

    // Step 2: Validate top-level structure
    if (typeof data !== 'object' || data === null) {
      return { valid: false, error: 'JSON must be an object' }
    }

    // Step 3: Validate entities array
    if (!data.entities || !Array.isArray(data.entities)) {
      return { valid: false, error: 'Missing or invalid "entities" array' }
    }

    if (data.entities.length === 0) {
      return { valid: false, error: 'At least one entity is required' }
    }

    // Build entity ID map for reference validation
    const entityIds = new Set()
    
    // Step 4: Validate each entity
    for (let i = 0; i < data.entities.length; i++) {
      const entity = data.entities[i]
      
      if (!entity.id || typeof entity.id !== 'string') {
        return { valid: false, error: `Entity at index ${i} missing valid "id"` }
      }
      
      if (!entity.name || typeof entity.name !== 'string') {
        return { valid: false, error: `Entity "${entity.id}" missing valid "name"` }
      }
      
      if (!entity.attributes || !Array.isArray(entity.attributes)) {
        return { valid: false, error: `Entity "${entity.id}" missing "attributes" array` }
      }
      
      // Fill in missing optional fields
      entity.isWeak = entity.isWeak === true
      
      // Validate attributes
      for (let j = 0; j < entity.attributes.length; j++) {
        const attr = entity.attributes[j]
        
        if (!attr.id || typeof attr.id !== 'string') {
          return { valid: false, error: `Entity "${entity.id}" attribute at index ${j} missing "id"` }
        }
        
        if (!attr.name || typeof attr.name !== 'string') {
          return { valid: false, error: `Entity "${entity.id}" attribute "${attr.id}" missing "name"` }
        }
        
        // Validate type, accepting casing/underscore variants and rewriting to canonical
        const canonicalType = canonicalAttributeType(attr.type)
        if (!canonicalType) {
          return { valid: false, error: `Entity "${entity.id}" attribute "${attr.id}" has invalid type` }
        }
        attr.type = canonicalType
        
        // Ensure composedOf is an array if present
        if (attr.composedOf && !Array.isArray(attr.composedOf)) {
          attr.composedOf = []
        }
      }
      
      entityIds.add(entity.id)
    }

    // Step 5: Validate relationships array (optional)
    if (!data.relationships) {
      data.relationships = []
    }
    
    if (!Array.isArray(data.relationships)) {
      return { valid: false, error: '"relationships" must be an array' }
    }

    for (let i = 0; i < data.relationships.length; i++) {
      const rel = data.relationships[i]
      
      if (!rel.id || typeof rel.id !== 'string') {
        return { valid: false, error: `Relationship at index ${i} missing valid "id"` }
      }
      
      if (!rel.name || typeof rel.name !== 'string') {
        return { valid: false, error: `Relationship "${rel.id}" missing valid "name"` }
      }
      
      if (!rel.participants || !Array.isArray(rel.participants)) {
        return { valid: false, error: `Relationship "${rel.id}" missing "participants" array` }
      }
      
      if (rel.participants.length < 2) {
        return { valid: false, error: `Relationship "${rel.id}" must have at least 2 participants` }
      }
      
      // Fill in missing optional fields
      rel.isIdentifying = rel.isIdentifying === true
      rel.attributes = rel.attributes || []
      
      // Validate participants
      for (let j = 0; j < rel.participants.length; j++) {
        const participant = rel.participants[j]
        
        if (!participant.entityId || typeof participant.entityId !== 'string') {
          return { valid: false, error: `Relationship "${rel.id}" participant at index ${j} missing "entityId"` }
        }
        
        // Verify entityId references a real entity
        if (!entityIds.has(participant.entityId)) {
          return { valid: false, error: `Relationship "${rel.id}" references non-existent entity "${participant.entityId}"` }
        }
        
        // Validate cardinality, rewriting to canonical case
        const canonicalCard = canonicalCardinality(participant.cardinality)
        if (!canonicalCard) {
          return { valid: false, error: `Relationship "${rel.id}" participant "${participant.entityId}" has invalid cardinality` }
        }
        participant.cardinality = canonicalCard
        
        // Validate participation
        if (!participant.participation || !PARTICIPATIONS.includes(participant.participation)) {
          return { valid: false, error: `Relationship "${rel.id}" participant "${participant.entityId}" has invalid participation` }
        }
      }
      
      // Validate relationship attributes. These reach the canvas the same way
      // entity attributes do, so they need the same type normalisation — an
      // unrecognised type here would render as a plain ellipse.
      if (!Array.isArray(rel.attributes)) {
        rel.attributes = []
      } else {
        for (const attr of rel.attributes) {
          const canonicalType = canonicalAttributeType(attr.type)
          if (!canonicalType) {
            return { valid: false, error: `Relationship "${rel.id}" attribute "${attr.id || '?'}" has invalid type` }
          }
          attr.type = canonicalType
        }
      }
    }

    // Step 6: Validate IS-A hierarchies (optional)
    if (!data.isA) {
      data.isA = []
    }
    
    if (!Array.isArray(data.isA)) {
      return { valid: false, error: '"isA" must be an array' }
    }

    for (let i = 0; i < data.isA.length; i++) {
      const hierarchy = data.isA[i]
      
      if (!hierarchy.id || typeof hierarchy.id !== 'string') {
        return { valid: false, error: `IS-A hierarchy at index ${i} missing valid "id"` }
      }
      
      if (!hierarchy.parent || typeof hierarchy.parent !== 'string') {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" missing valid "parent"` }
      }
      
      // Verify parent references a real entity
      if (!entityIds.has(hierarchy.parent)) {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" references non-existent parent entity "${hierarchy.parent}"` }
      }
      
      if (!hierarchy.children || !Array.isArray(hierarchy.children)) {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" missing "children" array` }
      }
      
      if (hierarchy.children.length === 0) {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" must have at least one child` }
      }
      
      // Verify all children reference real entities
      for (let j = 0; j < hierarchy.children.length; j++) {
        const childId = hierarchy.children[j]
        if (!entityIds.has(childId)) {
          return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" references non-existent child entity "${childId}"` }
        }
      }
      
      // Validate constraint
      if (!hierarchy.constraint || !ISA_CONSTRAINTS.includes(hierarchy.constraint)) {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" has invalid constraint` }
      }
      
      // Validate participation
      if (!hierarchy.participation || !PARTICIPATIONS.includes(hierarchy.participation)) {
        return { valid: false, error: `IS-A hierarchy "${hierarchy.id}" has invalid participation` }
      }
    }

    // All validation passed
    return { valid: true, data }

  } catch (err) {
    return { valid: false, error: `Unexpected error: ${err.message}` }
  }
}

// ============================================================================
// TEST BLOCK
// ============================================================================

// Uncomment to run tests:
/*
console.log('=== ERD Parser Tests ===\n')

// Test 1: Valid ERD
const validERD = {
  "entities": [
    {
      "id": "student",
      "name": "Student",
      "attributes": [
        { "id": "student_id", "name": "Student ID", "type": "key" },
        { "id": "name", "name": "Name", "type": "simple" }
      ],
      "isWeak": false
    },
    {
      "id": "course",
      "name": "Course",
      "attributes": [
        { "id": "course_id", "name": "Course ID", "type": "key" },
        { "id": "title", "name": "Title", "type": "simple" }
      ],
      "isWeak": false
    }
  ],
  "relationships": [
    {
      "id": "enrolls",
      "name": "Enrolls In",
      "isIdentifying": false,
      "participants": [
        { "entityId": "student", "cardinality": "N", "participation": "partial" },
        { "entityId": "course", "cardinality": "M", "participation": "partial" }
      ],
      "attributes": []
    }
  ],
  "isA": []
}

const result1 = parseERD(JSON.stringify(validERD))
console.log('Test 1 (Valid ERD):', result1.valid ? 'PASS' : 'FAIL')
if (!result1.valid) console.log('  Error:', result1.error)

// Test 2: Invalid JSON syntax
const result2 = parseERD('{ invalid json }')
console.log('Test 2 (Invalid JSON):', !result2.valid ? 'PASS' : 'FAIL')
if (!result2.valid) console.log('  Error:', result2.error)

// Test 3: Missing entities array
const result3 = parseERD('{"relationships": []}')
console.log('Test 3 (Missing entities):', !result3.valid ? 'PASS' : 'FAIL')
if (!result3.valid) console.log('  Error:', result3.error)

// Test 4: Invalid entity reference in relationship
const invalidRef = {
  "entities": [
    { "id": "student", "name": "Student", "attributes": [{ "id": "id", "name": "ID", "type": "key" }], "isWeak": false }
  ],
  "relationships": [
    {
      "id": "rel1",
      "name": "Test",
      "participants": [
        { "entityId": "student", "cardinality": "1", "participation": "total" },
        { "entityId": "nonexistent", "cardinality": "N", "participation": "partial" }
      ]
    }
  ]
}

const result4 = parseERD(JSON.stringify(invalidRef))
console.log('Test 4 (Invalid entity ref):', !result4.valid ? 'PASS' : 'FAIL')
if (!result4.valid) console.log('  Error:', result4.error)

console.log('\n=== Tests Complete ===')
*/
