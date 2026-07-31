// Test ERD JSON parsing and layout generation
import { parseERD } from '../../lib/erdParser.js'
import { calculateERDLayout } from '../../lib/erdLayout.js'

console.log('=== Testing ERD JSON Parsing & Layout ===\n')

// Test 1: Valid ERD with entities and relationships
console.log('Test 1: Valid ERD with entities and relationships')
const validERD = {
  "entities": [
    {
      "id": "student",
      "name": "Student",
      "attributes": [
        { "id": "student_id", "name": "Student ID", "type": "key" },
        { "id": "name", "name": "Name", "type": "simple" },
        { "id": "email", "name": "Email", "type": "simple" }
      ],
      "isWeak": false
    },
    {
      "id": "course",
      "name": "Course",
      "attributes": [
        { "id": "course_id", "name": "Course ID", "type": "key" },
        { "id": "title", "name": "Title", "type": "simple" },
        { "id": "credits", "name": "Credits", "type": "simple" }
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
      "attributes": [
        { "id": "grade", "name": "Grade", "type": "simple" }
      ]
    }
  ],
  "isA": []
}

const result1 = parseERD(JSON.stringify(validERD))
console.log('✓ Parse result:', result1.valid ? 'VALID' : 'INVALID')
if (!result1.valid) {
  console.log('  Error:', result1.error)
} else {
  console.log('  Entities:', result1.data.entities.length)
  console.log('  Relationships:', result1.data.relationships.length)
  
  // Test layout generation
  const layout = calculateERDLayout(result1.data, {})
  console.log('✓ Layout generated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges')
}
console.log()

// Test 2: ERD with weak entity and identifying relationship
console.log('Test 2: Weak entity with identifying relationship')
const weakEntityERD = {
  "entities": [
    {
      "id": "employee",
      "name": "Employee",
      "attributes": [
        { "id": "emp_id", "name": "Employee ID", "type": "key" }
      ],
      "isWeak": false
    },
    {
      "id": "dependent",
      "name": "Dependent",
      "attributes": [
        { "id": "dep_name", "name": "Name", "type": "partialKey" },
        { "id": "age", "name": "Age", "type": "simple" }
      ],
      "isWeak": true
    }
  ],
  "relationships": [
    {
      "id": "has_dependent",
      "name": "Has",
      "isIdentifying": true,
      "participants": [
        { "entityId": "employee", "cardinality": "1", "participation": "total" },
        { "entityId": "dependent", "cardinality": "N", "participation": "total" }
      ],
      "attributes": []
    }
  ],
  "isA": []
}

const result2 = parseERD(JSON.stringify(weakEntityERD))
console.log('✓ Parse result:', result2.valid ? 'VALID' : 'INVALID')
if (result2.valid) {
  console.log('  Weak entity detected:', result2.data.entities.find(e => e.isWeak).name)
  console.log('  Identifying relationship:', result2.data.relationships.find(r => r.isIdentifying).name)
  
  const layout = calculateERDLayout(result2.data, {})
  console.log('✓ Layout generated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges')
}
console.log()

// Test 3: ERD with IS-A hierarchy
console.log('Test 3: IS-A hierarchy')
const isaERD = {
  "entities": [
    {
      "id": "person",
      "name": "Person",
      "attributes": [
        { "id": "person_id", "name": "Person ID", "type": "key" },
        { "id": "name", "name": "Name", "type": "simple" }
      ],
      "isWeak": false
    },
    {
      "id": "student",
      "name": "Student",
      "attributes": [
        { "id": "gpa", "name": "GPA", "type": "simple" }
      ],
      "isWeak": false
    },
    {
      "id": "employee",
      "name": "Employee",
      "attributes": [
        { "id": "salary", "name": "Salary", "type": "simple" }
      ],
      "isWeak": false
    }
  ],
  "relationships": [],
  "isA": [
    {
      "id": "person_isa",
      "parent": "person",
      "children": ["student", "employee"],
      "constraint": "disjoint",
      "participation": "partial"
    }
  ]
}

const result3 = parseERD(JSON.stringify(isaERD))
console.log('✓ Parse result:', result3.valid ? 'VALID' : 'INVALID')
if (result3.valid) {
  console.log('  IS-A hierarchies:', result3.data.isA.length)
  console.log('  Parent:', result3.data.isA[0].parent)
  console.log('  Children:', result3.data.isA[0].children.join(', '))
  
  const layout = calculateERDLayout(result3.data, {})
  console.log('✓ Layout generated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges')
}
console.log()

// Test 4: Invalid JSON
console.log('Test 4: Invalid JSON syntax')
const result4 = parseERD('{ invalid json }')
console.log('✓ Correctly rejected:', !result4.valid ? 'YES' : 'NO')
if (!result4.valid) {
  console.log('  Error:', result4.error)
}
console.log()

// Test 5: Missing required fields
console.log('Test 5: Missing required fields')
const invalidERD = {
  "entities": [
    {
      "id": "student",
      // Missing "name" field
      "attributes": []
    }
  ]
}

const result5 = parseERD(JSON.stringify(invalidERD))
console.log('✓ Correctly rejected:', !result5.valid ? 'YES' : 'NO')
if (!result5.valid) {
  console.log('  Error:', result5.error)
}
console.log()

// Test 6: Invalid entity reference
console.log('Test 6: Invalid entity reference in relationship')
const invalidRefERD = {
  "entities": [
    {
      "id": "student",
      "name": "Student",
      "attributes": [
        { "id": "id", "name": "ID", "type": "key" }
      ],
      "isWeak": false
    }
  ],
  "relationships": [
    {
      "id": "rel1",
      "name": "Test",
      "isIdentifying": false,
      "participants": [
        { "entityId": "student", "cardinality": "1", "participation": "total" },
        { "entityId": "nonexistent", "cardinality": "N", "participation": "partial" }
      ],
      "attributes": []
    }
  ]
}

const result6 = parseERD(JSON.stringify(invalidRefERD))
console.log('✓ Correctly rejected:', !result6.valid ? 'YES' : 'NO')
if (!result6.valid) {
  console.log('  Error:', result6.error)
}
console.log()

// Test 7: Complex ERD with multiple attribute types
console.log('Test 7: Complex ERD with various attribute types')
const complexERD = {
  "entities": [
    {
      "id": "employee",
      "name": "Employee",
      "attributes": [
        { "id": "emp_id", "name": "Employee ID", "type": "key" },
        { "id": "name", "name": "Name", "type": "simple" },
        { "id": "phones", "name": "Phone Numbers", "type": "multiValued" },
        { "id": "age", "name": "Age", "type": "derived" }
      ],
      "isWeak": false
    }
  ],
  "relationships": [],
  "isA": []
}

const result7 = parseERD(JSON.stringify(complexERD))
console.log('✓ Parse result:', result7.valid ? 'VALID' : 'INVALID')
if (result7.valid) {
  const attrs = result7.data.entities[0].attributes
  console.log('  Key attributes:', attrs.filter(a => a.type === 'key').length)
  console.log('  Multi-valued attributes:', attrs.filter(a => a.type === 'multiValued').length)
  console.log('  Derived attributes:', attrs.filter(a => a.type === 'derived').length)
  
  const layout = calculateERDLayout(result7.data, {})
  console.log('✓ Layout generated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges')
}
console.log()

// Test 8: Ternary relationship using the M:N:P convention
// Regression: "P" used to be rejected, which pushed the model into either
// mislabelling a side or inventing a junction entity to get down to two
// participants. Both produce a diagram that is silently wrong.
console.log('Test 8: Ternary relationship (M:N:P)')
const ternaryERD = {
  "entities": [
    { "id": "supplier", "name": "Supplier", "isWeak": false, "attributes": [{ "id": "sup_id", "name": "Supplier ID", "type": "key" }] },
    { "id": "part", "name": "Part", "isWeak": false, "attributes": [{ "id": "part_no", "name": "Part Number", "type": "key" }] },
    { "id": "project", "name": "Project", "isWeak": false, "attributes": [{ "id": "proj_id", "name": "Project ID", "type": "key" }] }
  ],
  "relationships": [
    {
      "id": "supplies",
      "name": "Supplies",
      "isIdentifying": false,
      "participants": [
        { "entityId": "supplier", "cardinality": "M", "participation": "partial" },
        { "entityId": "part", "cardinality": "N", "participation": "partial" },
        { "entityId": "project", "cardinality": "P", "participation": "partial" }
      ],
      "attributes": []
    }
  ],
  "isA": []
}

const result8 = parseERD(JSON.stringify(ternaryERD))
console.log('✓ Parse result:', result8.valid ? 'VALID' : 'INVALID')
if (!result8.valid) {
  console.log('  Error:', result8.error)
  process.exitCode = 1
} else {
  const cards = result8.data.relationships[0].participants.map(p => p.cardinality).join(':')
  console.log('  Cardinalities preserved:', cards, cards === 'M:N:P' ? '(OK)' : '(WRONG)')
  if (cards !== 'M:N:P') process.exitCode = 1
  const layout = calculateERDLayout(result8.data, {})
  console.log('✓ Layout generated:', layout.nodes.length, 'nodes,', layout.edges.length, 'edges')
}
console.log()

// Test 9: cardinality casing is normalised rather than rejected
console.log('Test 9: Lowercase cardinality is normalised, junk is still rejected')
const lowerCard = JSON.parse(JSON.stringify(ternaryERD))
lowerCard.relationships[0].participants[0].cardinality = 'm'
lowerCard.relationships[0].participants[1].cardinality = ' n '
const result9 = parseERD(JSON.stringify(lowerCard))
console.log('✓ Parse result:', result9.valid ? 'VALID' : 'INVALID')
if (!result9.valid) {
  console.log('  Error:', result9.error)
  process.exitCode = 1
} else {
  const cards = result9.data.relationships[0].participants.map(p => p.cardinality).join(':')
  console.log('  Normalised to:', cards, cards === 'M:N:P' ? '(OK)' : '(WRONG)')
  if (cards !== 'M:N:P') process.exitCode = 1
}

const junkCard = JSON.parse(JSON.stringify(ternaryERD))
junkCard.relationships[0].participants[0].cardinality = 'many'
const result9b = parseERD(JSON.stringify(junkCard))
console.log('✓ Rejected "many":', !result9b.valid ? 'YES' : 'NO')
if (result9b.valid) process.exitCode = 1
console.log()

console.log('=== All ERD Tests Complete ===')
