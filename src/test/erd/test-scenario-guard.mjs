// Guards the spam gate against both failure directions.
//
// Over-strict is the more damaging bug: a rejected student loses their diagram,
// while a false accept costs one call out of an hourly allowance. The accept
// cases below are therefore the ones to protect when tuning thresholds.

import {
  validateScenario,
  scenarioCacheKey,
  MIN_WORDS,
  MIN_CHARS,
} from '../../lib/erdScenarioGuard.js'

let failures = 0
const check = (name, cond, detail = '') => {
  if (!cond) failures++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('\nCase 1: real scenarios are accepted')
const accept = [
  'A club has members.',
  'Students enrol in courses.',
  'Students enrol in courses. Each course is taught by one lecturer.',
  'A hospital tracks patients and their admissions over time.',
  'A mobile shop tracks customers and the mobiles they purchase, generating a bill.',
  "L'université a des étudiants qui suivent des cours.",
]
for (const text of accept) {
  const r = validateScenario(text)
  check(JSON.stringify(text.slice(0, 44)), r.ok, r.ok ? '' : r.code)
}

console.log('\nCase 2: spam and mash are rejected')
const reject = [
  ['', 'bad_request'],
  ['hi', 'too_short'],
  ['aaaaaaaaaaaaaaaaaaaaaaaaaa', 'too_few_words'],
  ['asdf asdf asdf asdf asdf asdf', 'low_variety'],
  ['apple apple apple apple apple apple', 'low_variety'],
  ['a a a a a a a a a a a a', 'low_variety'],
  ['x'.repeat(5000), 'too_long'],
]
for (const [text, code] of reject) {
  const r = validateScenario(text)
  check(
    `${JSON.stringify(text.slice(0, 30))} -> ${code}`,
    !r.ok && r.code === code,
    r.ok ? 'accepted' : `got ${r.code}`,
  )
}

console.log('\nCase 3: every rejection carries a message the UI can show')
for (const [text] of reject) {
  const r = validateScenario(text)
  check(`message for ${JSON.stringify(text.slice(0, 24))}`, !r.ok && typeof r.error === 'string' && r.error.length > 10)
}

console.log('\nCase 4: cache key normalises trivial edits together')
const a = scenarioCacheKey('Students enrol in Courses!')
const b = scenarioCacheKey('  students   ENROL in courses  ')
check('case and spacing collapse to one key', a === b, `${a} vs ${b}`)
check('different scenarios do not collide',
  scenarioCacheKey('Students enrol in courses') !== scenarioCacheKey('Doctors treat patients'))

console.log('\nCase 5: thresholds stay loose enough for minimal scenarios')
check(`MIN_WORDS (${MIN_WORDS}) admits a four-word scenario`, MIN_WORDS <= 4)
check(`MIN_CHARS (${MIN_CHARS}) admits "A club has members."`, MIN_CHARS <= 19)

console.log(failures === 0 ? '\nScenario guard behaves correctly.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
