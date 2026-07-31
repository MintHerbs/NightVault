// Builds the prompt engineering string for LLM to generate ERD JSON
//
// The MODELLING RULES block is not general advice: every rule removes a decision
// the model was previously left to guess at, and each maps to a mistake measured
// on this model. Two of them exist because the renderer cannot draw the
// alternative (composite attributes are never read by erdLayout.js), not because
// the alternative is bad ER modelling.

/**
 * Builds a prompt for an LLM to generate an ER Diagram in JSON format
 * @param {string} userQuestion - The user's description of their ER scenario
 * @returns {string} - The complete prompt string
 */
export function buildERDPrompt(userQuestion) {
  return `You are an expert database designer. Based on the scenario described below, generate an Entity-Relationship Diagram in JSON format following Chen notation.

CRITICAL INSTRUCTIONS:
- Return ONLY a raw JSON object
- Do NOT include any explanation, markdown, or code fences
- Do NOT wrap the JSON in \`\`\`json or \`\`\` blocks
- Return the JSON object directly with no additional text

The JSON must follow this exact schema:

{
  "entities": [
    {
      "id": "string (unique identifier, no spaces, lowercase, e.g. 'student')",
      "name": "string (display name, e.g. 'Student')",
      "attributes": [
        {
          "id": "string (unique identifier)",
          "name": "string (display name)",
          "type": "simple | multiValued | derived | key | partialKey"
        }
      ],
      "isWeak": false
    }
  ],
  "relationships": [
    {
      "id": "string (unique identifier)",
      "name": "string (verb phrase, e.g. 'Enrolls In')",
      "isIdentifying": false,
      "participants": [
        {
          "entityId": "string (references entities[].id)",
          "cardinality": "1 | N | M | P",
          "participation": "total | partial"
        }
      ],
      "attributes": []
    }
  ],
  "isA": [
    {
      "id": "string (unique identifier)",
      "parent": "string (entity id)",
      "children": ["entity_id_1", "entity_id_2"],
      "constraint": "disjoint | overlapping",
      "participation": "total | partial"
    }
  ]
}

SCHEMA FIELD EXPLANATIONS:

Entities:
- id: unique lowercase identifier with no spaces
- name: human-readable display name, singular (Student, not Students)
- attributes: array of attribute objects
- isWeak: true if this is a weak entity (depends on another entity for identification)

Attributes:
- id: unique identifier
- name: display name
- type:
  * "simple" - regular single-valued attribute
  * "multiValued" - can have multiple values per instance (e.g. phone numbers)
  * "derived" - computed from other stored data (e.g. age from date of birth)
  * "key" - primary key attribute
  * "partialKey" - discriminator for a weak entity

Relationships:
- id: unique identifier
- name: verb phrase describing the relationship
- isIdentifying: true if this relationship identifies a weak entity
- participants: the entities taking part
  * entityId: references an entity's id
  * cardinality: "1", "N", "M" or "P". See CARDINALITY below; this is the rule
    most often got wrong, read it carefully
  * participation: "total" (every instance must participate) or "partial"
- attributes: attributes belonging to the relationship itself

IS-A Hierarchies:
- id: unique identifier for this hierarchy
- parent: entity id of the superclass
- children: array of entity ids for subclasses
- constraint: "disjoint" (a parent instance is in at most one subclass) or
  "overlapping" (it may be in several)
- participation: "total" (every parent instance is in some subclass) or "partial"

CARDINALITY (read-across convention, apply this exactly):

For a binary relationship between A and B, the cardinality you write on
participant A is the number of A instances that can be linked to ONE instance
of B. It describes the far side, not the near side.

Worked example: "one Department employs many Employees."
  - One Department links to many Employees, so participant EMPLOYEE gets "N".
  - One Employee links to exactly one Department, so participant DEPARTMENT gets "1".
  - Result: participants = [ {department, "1"}, {employee, "N"} ]

Getting this backwards is the single most common error. Before writing each
participant, state the sentence "one <other entity> is linked to ___ <this
entity>" to yourself and write the answer.

Each "many" side gets its own letter, in order: use "M" then "N" for a
many-to-many between two entities, and "M", "N" then "P" for a ternary
relationship where all three sides are many.

MODELLING RULES:

1. NEVER add foreign-key attributes. A Chen ER diagram expresses references
   through relationships, not through key columns. Do not give Order an
   attribute like "customer_id"; draw a relationship between Order and Customer
   instead. Attributes named "<something>_id" are only allowed when they are
   that entity's OWN key.

2. NEVER create a junction/bridge/link entity for a many-to-many. Chen notation
   represents M:N directly as one relationship between the two entities. Data
   that belongs to the pairing (grade, quantity, enrolment date) goes in that
   relationship's "attributes" array. Only make it a real entity if it has its
   own independent identity in the scenario.

3. Entity vs attribute: something is an entity if it has its own key and its own
   relationships, or the scenario describes several facts about it. Otherwise it
   is an attribute. Do not create an entity for a value that is only ever a
   property of one thing.

4. Every regular entity needs exactly one "key" attribute.

5. Weak entities must have ALL of the following, or they are not weak:
   - "isWeak": true
   - a "partialKey" attribute and NO "key" attribute
   - participation in a relationship with "isIdentifying": true
   - "participation": "total" on the weak entity's side of that relationship
   - cardinality "1" on the owner's side and "N" on the weak entity's side
   Use a weak entity only when the thing genuinely cannot be identified without
   its owner (e.g. Dependent of an Employee, Room within a Building).

6. Participation: use "total" when the scenario says every / must / each, or
   when the entity cannot exist without the relationship. Use "partial" when it
   says may / can / optionally, or when the scenario is silent. Do not mark
   everything total.

7. Use a relationship with three participants only when the fact is genuinely
   irreducible: all three are needed together to identify one occurrence. If it
   can be expressed as two binary relationships, use two binary relationships.

8. Do not emit composite attributes or a "composedOf" field. Break a composite
   into its component parts as separate simple attributes (Address becomes
   Street, City, Postcode) rather than nesting them.

9. Use "derived" for anything the scenario describes as calculated or computed
   from other stored values. Use "multiValued" when one instance can hold several
   values at once.

10. Use an IS-A hierarchy only where the scenario describes a genuine
    specialisation (a Person who may be a Student or a Staff member). Do not
    invent one to share a couple of attributes.

11. Cover the scenario and nothing more: every entity, relationship and
    attribute must be traceable to something the scenario states or clearly
    implies. Do not add plausible extras the scenario never mentions.

12. Consistency requirements:
    - all ids unique across the whole document and lowercase with no spaces
    - every entityId, parent and child must reference an entity that exists
    - every relationship needs at least 2 participants
    - if there are no IS-A hierarchies, use "isA": []

WORKED EXAMPLE

Scenario: "A library has members, each with a membership number, name and
several contact numbers. Members borrow books; we record the date borrowed. Each
book has an ISBN and title. Every book is published by exactly one publisher,
which has a name and address."

{
  "entities": [
    {
      "id": "member", "name": "Member", "isWeak": false,
      "attributes": [
        { "id": "member_no", "name": "Membership Number", "type": "key" },
        { "id": "member_name", "name": "Name", "type": "simple" },
        { "id": "member_phone", "name": "Contact Number", "type": "multiValued" }
      ]
    },
    {
      "id": "book", "name": "Book", "isWeak": false,
      "attributes": [
        { "id": "isbn", "name": "ISBN", "type": "key" },
        { "id": "book_title", "name": "Title", "type": "simple" }
      ]
    },
    {
      "id": "publisher", "name": "Publisher", "isWeak": false,
      "attributes": [
        { "id": "pub_name", "name": "Publisher Name", "type": "key" },
        { "id": "pub_address", "name": "Address", "type": "simple" }
      ]
    }
  ],
  "relationships": [
    {
      "id": "borrows", "name": "Borrows", "isIdentifying": false,
      "participants": [
        { "entityId": "member", "cardinality": "M", "participation": "partial" },
        { "entityId": "book", "cardinality": "N", "participation": "partial" }
      ],
      "attributes": [ { "id": "date_borrowed", "name": "Date Borrowed", "type": "simple" } ]
    },
    {
      "id": "published_by", "name": "Published By", "isIdentifying": false,
      "participants": [
        { "entityId": "book", "cardinality": "N", "participation": "total" },
        { "entityId": "publisher", "cardinality": "1", "participation": "partial" }
      ],
      "attributes": []
    }
  ],
  "isA": []
}

Note in that example: Book has NO publisher_id attribute (rule 1), the M:N
borrowing has no junction entity and carries its own date attribute (rule 2),
"exactly one publisher" made Book's side total and Publisher's side "1" while
Book's side is "N" (CARDINALITY), and the several contact numbers became one
multiValued attribute rather than three simple ones (rule 9).

USER SCENARIO:
${userQuestion}

Remember: Return ONLY the raw JSON object with no markdown formatting, code fences, or explanatory text.`
}
