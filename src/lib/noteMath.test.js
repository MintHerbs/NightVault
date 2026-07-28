// Tests for noteMath.js — run with `npm run test:math`.
//
// The interesting half of this file is the "must not touch" section: rules 3
// and 4 are heuristics, and a false positive corrupts prose, so every shape
// that must survive untouched is pinned here.
import { normalizeNoteMath, noteHasMath } from './noteMath.js'

let passed = 0
const failures = []

function check(name, input, expected) {
  const actual = normalizeNoteMath(input)
  if (actual === expected) {
    passed += 1
    return
  }
  failures.push({ name, expected, actual })
}

function unchanged(name, input) {
  check(name, input, input)
}

// ---------------------------------------------------------------- rule 3
check(
  'bare formula line becomes display maths',
  '\\text{Average Waiting Time} = \\frac{0 + 24 + 27}{3} = 17 \\text{ seconds}',
  '$$\n\\text{Average Waiting Time} = \\frac{0 + 24 + 27}{3} = 17 \\text{ seconds}\n$$',
)

check(
  'formula line between blank lines',
  'Given the schedule:\n\n\\sum_{i=1}^{n} t_i = 51\n\nso the mean is 17.',
  'Given the schedule:\n\n$$\n\\sum_{i=1}^{n} t_i = 51\n$$\n\nso the mean is 17.',
)

check(
  'formula line inside a paragraph stays inline',
  'The answer:\n\\alpha = \\frac{1}{2}',
  'The answer:\n$\\alpha = \\frac{1}{2}$',
)

check(
  'negative leading sign is not a list bullet',
  '-\\frac{b}{2a}',
  '$$\n-\\frac{b}{2a}\n$$',
)

check(
  'markdown escapes inside a formula are undone',
  'a\\_{11} = \\frac{x\\_1}{2}',
  '$$\na_{11} = \\frac{x_1}{2}\n$$',
)

// ---------------------------------------------------------------- rule 4
check(
  'formula embedded in prose becomes inline maths',
  'We compute \\frac{1}{2} of the total here.',
  'We compute $\\frac{1}{2}$ of the total here.',
)

check(
  'adjacent commands merge into one run',
  'Compare \\alpha + \\beta against the bound.',
  'Compare $\\alpha + \\beta$ against the bound.',
)

check(
  'prose between commands blocks the merge',
  'Use \\alpha and then \\beta later.',
  'Use $\\alpha$ and then $\\beta$ later.',
)

check(
  'scripts are absorbed, trailing prose is not',
  'The term \\alpha_i^{2} grows.',
  'The term $\\alpha_i^{2}$ grows.',
)

check(
  'a lone trailing variable is absorbed',
  'so \\log_2 n bounds it',
  'so $\\log_2 n$ bounds it',
)

check(
  "English's one-letter words are not absorbed",
  'It costs \\frac{1}{2} a bit more.',
  'It costs $\\frac{1}{2}$ a bit more.',
)

check(
  'formula in a heading stays inline',
  '## The \\frac{1}{2} case',
  '## The $\\frac{1}{2}$ case',
)

check(
  'formula in a list item stays inline',
  '- cost is \\log_2 n here',
  '- cost is $\\log_2 n$ here',
)

// ---------------------------------------------------------------- rules 1 & 2
check(
  'TeX display delimiters',
  '\\[ x = \\frac{1}{2} \\]',
  '$$\nx = \\frac{1}{2}\n$$',
)

check(
  'TeX display delimiters spanning lines',
  '\\[\nx = \\frac{1}{2}\n\\]',
  '$$\nx = \\frac{1}{2}\n$$',
)

check(
  'TeX inline delimiters',
  'so \\( x = 2 \\) follows.',
  'so $x = 2$ follows.',
)

check(
  'delimiters win over the whole-line rule',
  '\\[ \\frac{1}{2} \\]',
  '$$\n\\frac{1}{2}\n$$',
)

check(
  'bare matrix environment',
  '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
  '$$\n\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}\n$$',
)

check(
  'multi-line environment',
  '\\begin{align}\nx &= 1 \\\\\ny &= 2\n\\end{align}',
  '$$\n\\begin{align}\nx &= 1 \\\\\ny &= 2\n\\end{align}\n$$',
)

check(
  'environment embedded in prose',
  'The matrix \\begin{pmatrix} 1 & 0 \\end{pmatrix} is identity-ish.',
  'The matrix $$\n\\begin{pmatrix} 1 & 0 \\end{pmatrix}\n$$ is identity-ish.',
)

// ------------------------------------------------ rule 0: escaped delimiters
// T-074. A Markdown-escaping source (an LLM answer, a converted doc) emits
// `\$\$x\$\$` for `$$x$$`. The bytes are `\`,`$`,`\`,`$`, so there is no
// adjacent `$$` for the protection scan to notice, and rules 3/4 used to wrap a
// fragment of the body, stranding a live maths node inside literal `$$` text.
check(
  'escaped display delimiters are repaired',
  '\\$\\$\\text{Standard deviation of } X = \\sqrt{\\text{Var}(X)}\\$\\$',
  '$$\\text{Standard deviation of } X = \\sqrt{\\text{Var}(X)}$$',
)

check(
  'escaped inline delimiters are repaired',
  '> (ii) \\$\\text{Var}(aX) = a^2 \\text{Var}(X)\\$',
  '> (ii) $\\text{Var}(aX) = a^2 \\text{Var}(X)$',
)

check(
  'escaped display delimiters inside a blockquote',
  '> \\$\\$\\text{Var}(X) = 0\\$\\$',
  '> $$\\text{Var}(X) = 0$$',
)

check(
  'a lone variable body still reads as maths',
  'the random variable \\$X\\$ is well defined',
  'the random variable $X$ is well defined',
)

check(
  'escaped markdown inside a repaired body is undone',
  '\\$\\$a\\_{11} = \\frac{x\\_1}{2}\\$\\$',
  '$$a_{11} = \\frac{x_1}{2}$$',
)

// The escaped-bracket half of T-074: `\[` is Markdown's escape for a literal
// `[`, so the tolerant bare-`]` closing must not be read as TeX display maths.
check(
  'escaped literal brackets are not TeX display maths',
  '\\text{Var}(X) = E(X^2) - \\[E(X)]^2',
  '$$\n\\text{Var}(X) = E(X^2) - [E(X)]^2\n$$',
)

check(
  'a bare closing bracket is honoured when the body is LaTeX',
  '\\[ \\frac{a}{b} ]',
  '$$\n\\frac{a}{b}\n$$',
)

// ---------------------------------------------------------- must not touch
unchanged('plain prose', 'Round robin gives each process a fixed time slice.')
unchanged('prose with no backslash but maths words', 'Average waiting time = 17 seconds')

unchanged('already-delimited inline maths', 'so $\\frac{1}{2}$ follows.')
unchanged('already-delimited display maths', '$$\n\\frac{1}{2}\n$$')
unchanged('already-delimited display maths on one line', '$$\\frac{1}{2}$$')
unchanged(
  'multi-line display block with a bare-looking body',
  '$$\n\\text{Average} = \\frac{51}{3}\n$$',
)
unchanged(
  'consecutive display blocks',
  '$$\n\\frac{1}{2}\n$$\n\n$$\n\\frac{3}{4}\n$$',
)

unchanged('inline code span', 'call `\\frac{1}{2}` verbatim')
unchanged('fenced code block', '```latex\n\\frac{1}{2}\n```')
unchanged('tilde-fenced code block', '~~~\n\\text{x} = \\frac{1}{2}\n~~~')
unchanged('backticks inside a tilde fence', '~~~\n```\n\\frac{1}{2}\n```\n~~~')
unchanged('indented code block', '    \\frac{1}{2}')

unchanged('markdown emphasis escape', 'a literal \\*star\\* here')
unchanged('note directive from the editor', ':color[hello]{hex="#ff0000"}')
// A table cell is prose-shaped, so rule 4 (not rule 3) handles it: the cell
// gets inline maths and the row structure survives.
check('table cell gets inline maths', '| \\frac{1}{2} | b |', '| $\\frac{1}{2}$ | b |')
unchanged('markdown escape is not LaTeX', 'the term x\\_i stays literal')

unchanged('line with a stray dollar', 'costs $5 and \\frac{1}{2} of it')
unchanged('currency pair', 'from $5 to $10 per unit')

// T-074: the repair above is gated on the body looking like maths, which is
// what keeps prose about money out of it. A digit body never qualifies.
unchanged('escaped currency pair', 'it costs \\$5 and \\$10 total')
unchanged('escaped currency with a real formula alongside', 'costs \\$5 and \\frac{1}{2} of it')
unchanged('escaped currency with a digit body', 'the \\$5\\$ tier is cheapest')
unchanged('a single escaped dollar has nothing to pair with', 'it costs \\$5 in total')
// Documentation *about* the escape syntax has to survive verbatim.
unchanged('escaped delimiters inside a fenced block', '```\n\\$\\$\\text{Var}(X)\\$\\$\n```')
unchanged('escaped delimiters inside an inline code span', 'write `\\$\\$\\text{Var}(X)\\$\\$` to escape')

// ------------------------------------------------------------- properties
const IDEMPOTENT_CASES = [
  '\\text{Average Waiting Time} = \\frac{0 + 24 + 27}{3} = 17 \\text{ seconds}',
  'We compute \\frac{1}{2} of the total here.',
  '\\[ x = \\frac{1}{2} \\]',
  '\\begin{bmatrix} a & b \\end{bmatrix}',
  'Given:\n\n\\sum_{i=1}^{n} t_i\n\nand `\\frac{1}{2}` in code.',
  '\\$\\$\\text{Var}(X) = 0\\$\\$',
  '\\text{Var}(X) = E(X^2) - \\[E(X)]^2',
  'it costs \\$5 and \\$10 total',
]
for (const source of IDEMPOTENT_CASES) {
  const once = normalizeNoteMath(source)
  check(`idempotent: ${source.slice(0, 32)}…`, once, once)
}

// ----------------------------------------------------------- noteHasMath
const HAS_MATH = [
  '\\text{Average} = \\frac{51}{3}',
  'so \\( x = 2 \\) follows',
  'inline $x$ maths',
  '\\begin{bmatrix} a \\end{bmatrix}',
]
const NO_MATH = [
  'Round robin gives each process a time slice.',
  '```\n\\frac{1}{2}\n```',
  'a literal \\*star\\* here',
  '',
  null,
]
for (const source of HAS_MATH) {
  if (noteHasMath(source)) passed += 1
  else failures.push({ name: `noteHasMath true: ${String(source).slice(0, 32)}`, expected: 'true', actual: 'false' })
}
for (const source of NO_MATH) {
  if (!noteHasMath(source)) passed += 1
  else failures.push({ name: `noteHasMath false: ${String(source).slice(0, 32)}`, expected: 'false', actual: 'true' })
}

// ---------------------------------------------------------------- report
console.log(`noteMath: ${passed} passed, ${failures.length} failed`)
for (const { name, expected, actual } of failures) {
  console.log(`\nFAIL ${name}`)
  console.log(`  expected: ${JSON.stringify(expected)}`)
  console.log(`  actual:   ${JSON.stringify(actual)}`)
}
if (failures.length) process.exitCode = 1
