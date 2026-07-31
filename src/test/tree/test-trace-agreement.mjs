// Does the animation land on exactly the tree the library builds?
//
// The narration comes from BPlusTree's own _emit hooks, so agreement should hold by
// construction. This proves it, and proves the hooks did not change behaviour: the same
// operations are run once traced and once plainly, and the final trees must be identical.
//
// It also guards the thing that made src/engine/AnimationEngine.js unusable: a second
// implementation drifting into a different data structure (min-degree t vs order m).

import { BPlusTree } from '../../lib/BPlusTree.js'
import { traceBuild, traceInsert, traceDelete } from '../../lib/treeTrace.js'

let failures = 0
const fail = (msg) => { failures++; if (failures <= 15) console.error(`  FAIL: ${msg}`) }

function shapeOf(node) {
  if (!node) return null
  const keys = node.keys.map(String)
  if (node.isLeaf) return { leaf: true, keys }
  return { leaf: false, keys, children: node.children.map(shapeOf) }
}

function leafChain(root) {
  if (!root) return []
  let node = root
  while (!node.isLeaf) node = node.children[0]
  const out = []
  while (node) { out.push(...node.keys.map(String)); node = node.next }
  return out
}

function check(label, expectedTree, steps) {
  const last = steps[steps.length - 1]
  if (!last || !last.treeSnapshot) { fail(`${label}: no final snapshot`); return }

  const want = JSON.stringify(shapeOf(expectedTree._root))
  const got = JSON.stringify(shapeOf(last.treeSnapshot))
  if (want !== got) {
    fail(`${label}: shape mismatch\n      library: ${want}\n      trace:   ${got}`)
    return
  }

  const wantChain = leafChain(expectedTree._root).join(',')
  const gotChain = leafChain(last.treeSnapshot).join(',')
  if (wantChain !== gotChain) fail(`${label}: leaf chain ${gotChain} != ${wantChain}`)

  steps.forEach((step, i) => {
    if (typeof step.description !== 'string' || !step.description.length) fail(`${label}: step ${i} has no description`)
    if (!step.treeSnapshot) fail(`${label}: step ${i} has no snapshot`)
    if (step.id !== i) fail(`${label}: step ${i} has id ${step.id}`)
  })
  if (steps[0].kind !== 'start') fail(`${label}: first step is not the starting tree`)
}

function mulberry32(seed) {
  let a = seed
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CASES = [
  { order: 3, values: ['4', 'c', 'r', 's', 't'] },
  { order: 3, values: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
  { order: 4, values: ['10', '20', '5', '6', '12', '30', '7', '17'] },
  { order: 5, values: 'abcdefghijklmnop'.split('') },
  { order: 3, values: ['banana', 'apple', 'cherry', 'date', 'elderberry'] }
]

for (const { order, values } of CASES) {
  const tree = new BPlusTree(order)
  for (const v of values) tree.insert(v)
  check(`build m=${order}`, tree, traceBuild(values, order).steps)

  const added = new BPlusTree(order)
  for (const v of values) added.insert(v)
  const insertSteps = traceInsert(added, 'zz').steps
  added.insert('zz')
  check(`insert m=${order} +zz`, added, insertSteps)

  for (const victim of values) {
    const t2 = new BPlusTree(order)
    for (const v of values) t2.insert(v)
    const delSteps = traceDelete(t2, victim).steps
    t2.delete(victim)
    check(`delete m=${order} -${victim}`, t2, delSteps)
  }
}

const rng = mulberry32(90210)
let trials = 0
for (let i = 0; i < 500; i++) {
  const order = 3 + Math.floor(rng() * 5)
  const count = 1 + Math.floor(rng() * 20)
  const values = []
  for (let k = 0; k < count; k++) values.push(String(1 + Math.floor(rng() * 80)))

  const tree = new BPlusTree(order)
  for (const v of values) tree.insert(v)
  check(`fuzz build m=${order} [${values.join(',')}]`, tree, traceBuild(values, order).steps)
  trials++

  const deleting = rng() < 0.5
  const target = deleting ? values[Math.floor(rng() * values.length)] : String(1 + Math.floor(rng() * 80))
  const steps = deleting ? traceDelete(tree, target).steps : traceInsert(tree, target).steps
  if (deleting) tree.delete(target); else tree.insert(target)
  check(`fuzz ${deleting ? 'delete' : 'insert'} m=${order} ${target}`, tree, steps)
  trials++
}

if (failures > 0) {
  console.error(`\n[trace-agreement] ${failures} failure(s)`)
  process.exit(1)
}
console.log(`[trace-agreement] all passed (${CASES.length} curated builds, every single-key delete, ${trials} fuzz comparisons)`)
