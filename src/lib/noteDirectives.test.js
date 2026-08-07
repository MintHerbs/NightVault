// Tests for noteDirectives.js — run with `npm run test:directives`.
//
// The shape that matters is the accidental one: `09:30` in prose is a
// textDirective as far as remark-directive is concerned, and before this plugin
// existed it crashed the editor and silently vanished from the reader (T-107).
// The other half of the file pins the directives notes actually define, since
// flattening one of those to text would be the same bug pointed the other way.
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkStringify from 'remark-stringify'
import { visit } from 'unist-util-visit'
import { remarkNoteDirectiveFallback } from './noteDirectives.js'

let passed = 0
const failures = []

// Mirrors both real pipelines: remark-directive parses, the fallback runs
// straight after it, and nothing downstream is allowed to meet a directive it
// has no rule for.
const parse = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkNoteDirectiveFallback)

function treeFor(md) {
  const tree = parse.parse(md)
  return parse.runSync(tree, md)
}

/** Every directive left in the tree, as `type:name`. */
function survivingDirectives(md) {
  const found = []
  visit(treeFor(md), (node) => {
    if (/Directive$/.test(node.type)) found.push(`${node.type}:${node.name}`)
  })
  return found
}

/** The plain text the tree renders to, directives flattened. */
function textOf(md) {
  const parts = []
  visit(treeFor(md), (node) => {
    if (node.type === 'text' || node.type === 'inlineCode') parts.push(node.value)
  })
  return parts.join('')
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) passed += 1
  else failures.push({ name, expected: b, actual: a })
}

// ------------------------------------------------- accidental directives
eq(
  'a clock time leaves no directive behind',
  survivingDirectives('The time is now 09:30. What next?'),
  [],
)

eq(
  'a clock time keeps its text intact',
  textOf('The time is now 09:30. What next?'),
  'The time is now 09:30. What next?',
)

eq(
  'several times in one line all survive',
  textOf('Time = 09:30 + 04:00 = 13:30 = 01:30 PM'),
  'Time = 09:30 + 04:00 = 13:30 = 01:30 PM',
)

eq(
  'a directive at line start is text too',
  textOf(':30 past the hour.'),
  ':30 past the hour.',
)

eq(
  'an unknown named directive keeps its label and attributes',
  textOf('See :widget[the label]{id="x"} here.'),
  'See :widget[the label]{id="x"} here.',
)

eq(
  'an unknown leaf directive becomes a paragraph, not a crash',
  survivingDirectives('Before\n\n::widget{id="x"}\n\nAfter'),
  [],
)

eq(
  'an unknown container directive is flattened whole',
  survivingDirectives(':::note\ninside\n:::'),
  [],
)

// A name registered for one form is still unhandled as another — `::color` has
// no leaf parser on either path, so it must flatten rather than reach one.
eq(
  'a known name in the wrong form is still unhandled',
  survivingDirectives('::color{hex="#00FFA3"}'),
  [],
)

// ------------------------------------------------------ real directives
eq(
  'the seven real directives are left alone',
  survivingDirectives(
    ':color[a]{hex="#00FFA3"} :mark[b]{hex="#1E3A5C"}\n\n::youtube{id="dQw4w9WgXcQ"}\n\n::playground{id="ch02-target"}\n\n::molecule{smiles="CCO"}\n\n::anim{id="db-norm-flatten"}\n\n::sqlrun{id="ddl-create-branch"}',
  ),
  [
    'textDirective:color',
    'textDirective:mark',
    'leafDirective:youtube',
    'leafDirective:playground',
    'leafDirective:molecule',
    'leafDirective:anim',
    'leafDirective:sqlrun',
  ],
)

// Adding a name to HANDLED_DIRECTIVES without also giving Milkdown a schema for
// it re-opens T-107: the fallback stops rewriting the directive to literal text,
// and the editor then has no parser for the node, so opening the note takes the
// whole editor down. This pins the list so that pairing cannot be forgotten —
// every name here must have a `$nodeSchema` in NoteEditor.jsx.
eq(
  'anim and sqlrun survive as leaf directives, not text',
  survivingDirectives('::anim{id="x"}\n\n::sqlrun{id="y"}'),
  ['leafDirective:anim', 'leafDirective:sqlrun'],
)

// An invalid attribute is the *renderer's* call to make (it degrades to plain
// children / nothing); flattening here would take that decision away from it.
eq(
  'a known directive with a bad attribute still reaches the renderer',
  survivingDirectives(':color[a]{hex="not-a-hex"}'),
  ['textDirective:color'],
)

// ------------------------------------------------------------ untouched
eq(
  'a time inside maths is never a directive to begin with',
  survivingDirectives('$09:30 + 16:00$'),
  [],
)

eq(
  'a time inside code is untouched',
  textOf('`09:30`'),
  '09:30',
)

eq(
  'a URL is not a directive',
  textOf('Go to https://example.com/a for more.'),
  'Go to https://example.com/a for more.',
)

// ------------------------------------------------------------ round-trip
// The reader re-parses whatever the editor saved, so flattening has to reach a
// fixed point: one pass must produce Markdown that survives the next unchanged.
const roundTrip = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkNoteDirectiveFallback)
  .use(remarkStringify)

for (const source of ['The time is now 09:30.', ':30 past.', 'a :widget[l]{id="x"} b']) {
  const once = String(roundTrip.processSync(source))
  const twice = String(roundTrip.processSync(once))
  eq(`round-trip is stable: ${source}`, twice, once)
}

// ---------------------------------------------------------------- report
console.log(`noteDirectives: ${passed} passed, ${failures.length} failed`)
for (const { name, expected, actual } of failures) {
  console.log(`\nFAIL ${name}`)
  console.log(`  expected: ${expected}`)
  console.log(`  actual:   ${actual}`)
}
if (failures.length) process.exitCode = 1
