// Tests for noteChem.js — run with `npm run test:chem`.
import {
  isValidSmiles,
  SMILES_MAX_LEN,
  isValidLabel,
  LABEL_MAX_LEN,
  parseReactionBlock,
  detectMolBlock,
  splitReactionSmiles,
  convertChemPaste,
  serializeReactionBlock,
  MAX_REACTION_JSON_BYTES,
  MAX_STEPS,
  MAX_ITEMS_PER_STEP,
} from './noteChem.js'

let passed = 0
const failures = []

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed += 1
    return
  }
  failures.push({ name, expected: e, actual: a })
}

function ok(name, cond) {
  if (cond) {
    passed += 1
    return
  }
  failures.push({ name, expected: 'truthy', actual: 'falsy' })
}

// --------------------------------------------------------------- isValidSmiles
// The spec's ten-fixture set (chemistry-notes.md / ADR 0002).
const VALID_FIXTURES = [
  'c1ccccc1',                    // benzene
  'CC(=O)Oc1ccccc1C(=O)O',       // aspirin
  'Cn1cnc2c1c(=O)n(C)c(=O)n2C',  // caffeine
  'C[C@@H](N)C(=O)O',            // L-alanine (stereocentre)
  '[Fe+3]',                      // Fe3+ ion (charge)
  '[O-]S(=O)(=O)[O-]',           // sulfate ion (charge)
  '[227Th]',                     // thorium-227 (isotope)
  'C1CCCCC1',                    // cyclohexane
  'Oc1cccc2ccccc12',             // 1-naphthol (fused rings)
  'F/C=C\\F',                    // stereochemistry with a backslash
]
for (const smiles of VALID_FIXTURES) {
  ok(`valid SMILES: ${smiles}`, isValidSmiles(smiles))
}

ok('invalid SMILES fixture rejected by charset', !isValidSmiles('not a smiles###'))
ok('empty string is invalid', !isValidSmiles(''))
ok('non-string is invalid', !isValidSmiles(null))
ok('non-string number is invalid', !isValidSmiles(42))
ok('over-length string is invalid', !isValidSmiles('C'.repeat(SMILES_MAX_LEN + 1)))
ok('exactly-max-length string is valid', isValidSmiles('C'.repeat(SMILES_MAX_LEN)))

// --------------------------------------------------------------- isValidLabel
ok('empty label is valid (falls back to SMILES)', isValidLabel(''))
ok('short label is valid', isValidLabel('Aspirin'))
ok('exactly-max-length label is valid', isValidLabel('x'.repeat(LABEL_MAX_LEN)))
ok('over-length label is invalid', !isValidLabel('x'.repeat(LABEL_MAX_LEN + 1)))
ok('non-string label is invalid', !isValidLabel(null))

// --------------------------------------------------------------- parseReactionBlock
const VALID_STEP_JSON = JSON.stringify({
  steps: [{
    reactants: ['Nc1ccc(Br)cc1'],
    conditionsAbove: ['1) NaNO2, HCl, 0 °C', '2) NaOH, 0 °C'],
    agents: [{ smiles: 'Oc1cccc2ccccc12', label: '1-naphthol' }],
    products: ['Oc1ccc2ccccc2c1/N=N/c1ccc(Br)cc1'],
  }],
})

{
  const result = parseReactionBlock(VALID_STEP_JSON)
  ok('valid reaction JSON parses', result.ok)
  ok('valid reaction JSON has one step', result.ok && result.steps.length === 1)
  ok('valid reaction JSON keeps the agent label', result.ok && result.steps[0].agents[0].label === '1-naphthol')
}

{
  // agents may be a plain SMILES string, normalised to {smiles, label: ''}
  const raw = JSON.stringify({ steps: [{ reactants: ['CC'], agents: ['O'], products: ['CCO'] }] })
  const result = parseReactionBlock(raw)
  ok('plain-string agent normalises to {smiles,label}', result.ok
    && result.steps[0].agents[0].smiles === 'O'
    && result.steps[0].agents[0].label === '')
}

ok('oversized-before-parse payload rejected', !parseReactionBlock('x'.repeat(MAX_REACTION_JSON_BYTES + 1)).ok)
ok('malformed JSON rejected', !parseReactionBlock('{ not json').ok)
ok('non-string input rejected', !parseReactionBlock(null).ok)
ok('empty string rejected', !parseReactionBlock('').ok)
ok('empty steps array rejected', !parseReactionBlock(JSON.stringify({ steps: [] })).ok)
ok('missing steps key rejected', !parseReactionBlock(JSON.stringify({})).ok)

{
  const tooManySteps = JSON.stringify({
    steps: Array.from({ length: MAX_STEPS + 1 }, () => ({ reactants: ['C'], products: ['C'] })),
  })
  ok('over step-count cap rejected', !parseReactionBlock(tooManySteps).ok)
}

{
  const atCap = JSON.stringify({
    steps: Array.from({ length: MAX_STEPS }, () => ({ reactants: ['C'], products: ['C'] })),
  })
  ok('exactly-at step-count cap accepted', parseReactionBlock(atCap).ok)
}

{
  const tooManyReactants = JSON.stringify({
    steps: [{ reactants: Array.from({ length: MAX_ITEMS_PER_STEP + 1 }, () => 'C'), products: ['C'] }],
  })
  ok('over items-per-step cap rejected', !parseReactionBlock(tooManyReactants).ok)
}

ok('empty reactants array rejected', !parseReactionBlock(
  JSON.stringify({ steps: [{ reactants: [], products: ['C'] }] }),
).ok)

ok('missing products rejected', !parseReactionBlock(
  JSON.stringify({ steps: [{ reactants: ['C'] }] }),
).ok)

ok('invalid SMILES inside a step rejected', !parseReactionBlock(
  JSON.stringify({ steps: [{ reactants: ['not valid ###'], products: ['C'] }] }),
).ok)

ok('malformed agent entry rejected', !parseReactionBlock(
  JSON.stringify({ steps: [{ reactants: ['C'], products: ['C'], agents: [{ label: 'no smiles' }] }] }),
).ok)

ok('condition line over its length cap rejected', !parseReactionBlock(
  JSON.stringify({ steps: [{ reactants: ['C'], products: ['C'], conditionsAbove: ['x'.repeat(201)] }] }),
).ok)

ok('step that is not an object rejected', !parseReactionBlock(
  JSON.stringify({ steps: ['not an object'] }),
).ok)

// serializeReactionBlock round-trips through parseReactionBlock
{
  const block = serializeReactionBlock([{
    reactants: ['CC'],
    conditionsAbove: ['heat'],
    agents: [{ smiles: 'O', label: 'water' }],
    products: ['CCO'],
  }])
  const fenceMatch = /^```reaction\n([\s\S]*)\n```$/.exec(block)
  ok('serializeReactionBlock produces a reaction fence', Boolean(fenceMatch))
  const reparsed = fenceMatch ? parseReactionBlock(fenceMatch[1]) : { ok: false }
  ok('serialized block re-parses successfully', reparsed.ok)
  check('serialized block round-trips the step data', reparsed.ok && reparsed.steps, [{
    reactants: ['CC'],
    conditionsAbove: ['heat'],
    agents: [{ smiles: 'O', label: 'water' }],
    products: ['CCO'],
  }])
}

// --------------------------------------------------------------- detectMolBlock
const REAL_MOLFILE = [
  '',
  '     RDKit          2D',
  '',
  '  3  2  0  0  0  0  0  0  0  0999 V2000',
  '    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0',
  '    1.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0',
  '    2.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0',
  '  1  2  1  0',
  '  2  3  1  0',
  'M  END',
].join('\n')

ok('real V2000 counts-line fixture detected', detectMolBlock(REAL_MOLFILE))

const V3000_MOLFILE = [
  '',
  '  Header',
  '',
  '  0  0  0  0  0  0  0  0  0  0999 V3000',
  'M  V30 BEGIN CTAB',
].join('\n')
ok('V3000 counts-line fixture detected', detectMolBlock(V3000_MOLFILE))

ok('prose mentioning V2000 not at the counts-line position does not false-positive',
  !detectMolBlock('This spec references the V2000 file format\nin its second line.\nand a third\nand a fourth line with nothing special'))

ok('short text is not a MOL block', !detectMolBlock('CC(=O)O'))
ok('non-string input is not a MOL block', !detectMolBlock(null))
ok('three-line text (no fourth line) is not a MOL block', !detectMolBlock('one\ntwo\nthree'))

// --------------------------------------------------------------- splitReactionSmiles
{
  const result = splitReactionSmiles('Nc1ccc(Br)cc1>O.[Na+]>Oc1ccc2ccccc2c1')
  check('valid 3-segment reaction SMILES splits correctly', result, {
    reactants: ['Nc1ccc(Br)cc1'],
    agents: ['O', '[Na+]'],
    products: ['Oc1ccc2ccccc2c1'],
  })
}

ok('reaction SMILES with empty agents segment is valid', Boolean(splitReactionSmiles('CC>>CCO')))
ok('a 2-segment string returns null', splitReactionSmiles('CC>CCO') === null)
ok('a 4-segment string returns null', splitReactionSmiles('CC>O>CCO>extra') === null)
ok('prose containing a bare > does not match', splitReactionSmiles('if x > 5 then y > 3 do z') === null)
ok('empty reactants segment returns null', splitReactionSmiles('>O>CCO') === null)
ok('empty products segment returns null', splitReactionSmiles('CC>O>') === null)
ok('non-string input returns null', splitReactionSmiles(null) === null)
ok('empty string returns null', splitReactionSmiles('') === null)

// --------------------------------------------------------------- convertChemPaste
{
  const converted = convertChemPaste('Nc1ccc(Br)cc1>O>Oc1ccc2ccccc2c1')
  ok('reaction-SMILES paste converts to a reaction fence', typeof converted === 'string' && converted.startsWith('```reaction\n'))
  const inner = /^```reaction\n([\s\S]*)\n```$/.exec(converted)[1]
  const parsed = parseReactionBlock(inner)
  ok('converted paste block parses back successfully', parsed.ok)
  check('converted paste has empty conditionsAbove (documented gap)', parsed.ok && parsed.steps[0].conditionsAbove, [])
}

ok('non-reaction-SMILES paste text converts to null', convertChemPaste('just some prose') === null)
ok('a MOL block is not (falsely) treated as reaction SMILES by convertChemPaste',
  convertChemPaste(REAL_MOLFILE) === null)

// ---------------------------------------------------------------- report
console.log(`noteChem: ${passed} passed, ${failures.length} failed`)
for (const { name, expected, actual } of failures) {
  console.log(`\nFAIL ${name}`)
  console.log(`  expected: ${expected}`)
  console.log(`  actual:   ${actual}`)
}
if (failures.length) process.exitCode = 1
