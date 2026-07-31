// Independent deep review of BPlusTree (T-085).
//
// Run with `node src/test/tree/test-deep-review.mjs`, or via `npm run test:tree`.
//
// Deliberately does NOT reuse the project's own test helpers: it rebuilds every
// invariant from the B+ tree definition and checks the tree against a plain
// sorted array acting as the oracle. If both the implementation and its existing
// suite shared a wrong assumption, this is what would catch it.

import { BPlusTree, normalizeKey } from '../../lib/BPlusTree.js'
import { traceInsert, traceDelete, traceReplace } from '../../lib/treeTrace.js'

let checks = 0
const failures = []
function fail(msg) { failures.push(msg) }
function check(cond, msg) { checks++; if (!cond) fail(msg) }

function cmp(a, b) {
  const an = typeof a === 'number', bn = typeof b === 'number'
  if (an && bn) return a - b
  if (an) return -1
  if (bn) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

// ---- invariants rebuilt from the definition -------------------------------

function auditTree(tree, expectedSet, label) {
  const root = tree.root
  const order = tree.order
  const maxKeys = order - 1
  const minKeys = Math.ceil(order / 2) - 1
  const where = (m) => fail(`[${label}] ${m}`)

  // 1. Every leaf at the same depth.
  const depths = new Set()
  ;(function walk(n, d) {
    if (n.isLeaf) { depths.add(d); return }
    n.children.forEach(c => walk(c, d + 1))
  })(root, 0)
  checks++
  if (depths.size !== 1) where(`leaves at differing depths: ${[...depths]}`)

  // 2. Occupancy. Root is exempt from the minimum; an internal root still needs
  //    at least one separator, or it has a single child and should have shrunk.
  ;(function walk(n, isRoot) {
    checks++
    if (n.keys.length > maxKeys) where(`node ${n.id} holds ${n.keys.length} keys, max ${maxKeys}`)
    if (!isRoot && n.keys.length < minKeys) where(`node ${n.id} holds ${n.keys.length} keys, min ${minKeys}`)
    if (isRoot && !n.isLeaf && n.keys.length < 1) where(`internal root ${n.id} has no separator`)
    if (!n.isLeaf) {
      checks++
      if (n.children.length !== n.keys.length + 1) {
        where(`node ${n.id} has ${n.children.length} children for ${n.keys.length} keys`)
      }
      n.children.forEach(c => walk(c, false))
    }
  })(root, true)

  // 3. Keys sorted within every node, and parent pointers intact.
  ;(function walk(n) {
    for (let i = 1; i < n.keys.length; i++) {
      checks++
      if (cmp(n.keys[i - 1], n.keys[i]) >= 0) where(`node ${n.id} keys out of order: ${n.keys}`)
    }
    if (!n.isLeaf) n.children.forEach(c => {
      checks++
      if (c.parent !== n) where(`node ${c.id} has a wrong parent link`)
      walk(c)
    })
  })(root)

  // 4. Strict separator law: keys[i] is exactly min(subtree(children[i+1])),
  //    and everything in children[i] is strictly below it.
  const subtreeKeys = (n) => n.isLeaf ? [...n.keys] : n.children.flatMap(subtreeKeys)
  ;(function walk(n) {
    if (n.isLeaf) return
    n.keys.forEach((sep, i) => {
      const rightMin = subtreeKeys(n.children[i + 1]).reduce((a, b) => cmp(a, b) <= 0 ? a : b)
      checks++
      if (cmp(sep, rightMin) !== 0) where(`separator ${sep} in ${n.id} should equal right-subtree min ${rightMin}`)
      const leftMax = subtreeKeys(n.children[i]).reduce((a, b) => cmp(a, b) >= 0 ? a : b)
      checks++
      if (cmp(leftMax, sep) >= 0) where(`left subtree max ${leftMax} not below separator ${sep} in ${n.id}`)
    })
    n.children.forEach(walk)
  })(root)

  // 5. The leaf chain visits every record once, in sorted order, and terminates.
  let leaf = root
  while (!leaf.isLeaf) leaf = leaf.children[0]
  const chained = []
  const seen = new Set()
  for (let cur = leaf; cur; cur = cur.next) {
    checks++
    if (seen.has(cur.id)) { where('cycle in the leaf chain'); break }
    seen.add(cur.id)
    chained.push(...cur.keys)
  }
  const sortedExpected = [...expectedSet].sort(cmp)
  checks++
  if (chained.length !== sortedExpected.length || chained.some((k, i) => cmp(k, sortedExpected[i]) !== 0)) {
    where(`leaf chain ${JSON.stringify(chained)} != expected ${JSON.stringify(sortedExpected)}`)
  }

  // 6. The tree agrees with the oracle about membership, both ways.
  for (const k of sortedExpected) { checks++; if (!tree.search(k)) where(`search miss for present key ${k}`) }
  checks++
  const stored = [...tree.getAllKeys()].sort(cmp)
  if (stored.length !== sortedExpected.length || stored.some((k, i) => cmp(k, sortedExpected[i]) !== 0)) {
    where('getAllKeys disagrees with the oracle')
  }

  // 7. The library's own validate() must agree that it is well formed.
  checks++
  if (!tree.validate().valid) where(`validate(): ${tree.validate().errors.join('; ')}`)

  // 8. Reported stats match a recount.
  let nodeCount = 0, height = 0
  ;(function walk(n, d) { nodeCount++; height = Math.max(height, d); if (!n.isLeaf) n.children.forEach(c => walk(c, d + 1)) })(root, 1)
  const stats = tree.getStats()
  checks++
  if (stats.nodeCount !== nodeCount || stats.height !== height || stats.keyCount !== expectedSet.size) {
    where(`stats ${JSON.stringify(stats)} != recount {nodeCount:${nodeCount},height:${height},keyCount:${expectedSet.size}}`)
  }
}

// ---- randomized campaign ---------------------------------------------------

let seed = 20260731
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
function ri(n) { return Math.floor(rnd() * n) }

console.log('=== Campaign A: random insert/delete against a sorted-array oracle ===')
for (let order = 3; order <= 8; order++) {
  for (let trial = 0; trial < 220; trial++) {
    const tree = new BPlusTree(order)
    const oracle = new Set()
    const universe = 60
    for (let op = 0; op < 160; op++) {
      const k = ri(universe)
      if (rnd() < 0.58) { tree.insert(k); oracle.add(normalizeKey(k)) }
      else { tree.delete(k); oracle.delete(normalizeKey(k)) }
    }
    auditTree(tree, oracle, `order=${order} trial=${trial}`)
    if (failures.length) break
  }
  if (failures.length) break
}
console.log(failures.length ? `  FAILED: ${failures[0]}` : '  passed')

console.log('=== Campaign B: delete every key, one at a time, auditing after each ===')
for (let order = 3; order <= 6; order++) {
  const keys = Array.from({ length: 40 }, (_, i) => i + 1)
  const tree = new BPlusTree(order)
  const oracle = new Set()
  keys.forEach(k => { tree.insert(k); oracle.add(k) })
  // Delete in a shuffled order so this is not just the reverse-build path.
  const shuffled = [...keys].sort(() => rnd() - 0.5)
  for (const k of shuffled) {
    tree.delete(k); oracle.delete(k)
    auditTree(tree, oracle, `drain order=${order} after deleting ${k}`)
    if (failures.length) break
  }
  if (failures.length) break
}
console.log(failures.length ? `  FAILED: ${failures[0]}` : '  passed (tree drained to empty and stayed legal throughout)')

console.log('=== Campaign C: mixed-type and edge-case keys ===')
{
  const tree = new BPlusTree(3)
  const oracle = new Set()
  const odd = ['banana', 'Apple', '007', '7', '-5', '1.5', '1e3', 'apple', '  spaced  ', '0', '-0']
  for (const k of odd) { tree.insert(k); oracle.add(normalizeKey(k)) }
  auditTree(tree, oracle, 'mixed types')
  // "007" and "7" must be the same key; "Apple"/"apple" likewise.
  check(tree.search('7') && tree.search('007'), 'C: 007 and 7 should be the same key')
  check(tree.search('APPLE'), 'C: key lookup should be case-insensitive')
  check(normalizeKey('-0') === normalizeKey('0'), 'C: -0 and 0 normalise together')
  for (const k of [...oracle]) { tree.delete(k); oracle.delete(k); auditTree(tree, oracle, `mixed drain ${k}`) }
}
console.log(failures.length ? `  FAILED: ${failures[0]}` : '  passed')

console.log('=== Campaign D: no-ops must not disturb the tree ===')
{
  const tree = new BPlusTree(4)
  const oracle = new Set()
  for (let i = 0; i < 25; i++) { tree.insert(i); oracle.add(i) }
  const before = JSON.stringify(tree.getAllKeys().sort(cmp))
  tree.insert(7)          // already present
  tree.delete(999)        // absent
  tree.delete('nope')     // absent, different type
  check(JSON.stringify(tree.getAllKeys().sort(cmp)) === before, 'D: a no-op changed the key set')
  auditTree(tree, oracle, 'after no-ops')
}
console.log(failures.length ? `  FAILED: ${failures[0]}` : '  passed')

console.log('=== Campaign E: the animation ends on exactly the tree the library builds ===')
{
  for (let order = 3; order <= 6; order++) {
    for (let trial = 0; trial < 120; trial++) {
      const tree = new BPlusTree(order)
      const oracle = new Set()
      for (let i = 0; i < 30; i++) { const k = ri(50); tree.insert(k); oracle.add(normalizeKey(k)) }

      const k = ri(50)
      // Insert
      const ins = traceInsert(tree, k)
      const insExpect = new Set(oracle); insExpect.add(normalizeKey(k))
      auditTree(ins.tree, insExpect, `traceInsert order=${order}`)
      check(
        JSON.stringify(flatten(ins.steps.at(-1).treeSnapshot)) === JSON.stringify(flatten(ins.tree.root)),
        `E: last insert frame != resulting tree (order=${order}, trial=${trial})`
      )
      // Delete
      const victim = [...oracle][ri(oracle.size)]
      const del = traceDelete(tree, victim)
      const delExpect = new Set(oracle); delExpect.delete(normalizeKey(victim))
      auditTree(del.tree, delExpect, `traceDelete order=${order}`)
      check(
        JSON.stringify(flatten(del.steps.at(-1).treeSnapshot)) === JSON.stringify(flatten(del.tree.root)),
        `E: last delete frame != resulting tree (order=${order}, trial=${trial})`
      )
      // Replace (the popover's edit path)
      const from = [...oracle][ri(oracle.size)]
      let to = ri(200) + 500  // outside the universe, so it cannot collide
      const rep = traceReplace(tree, from, to)
      const repExpect = new Set(oracle); repExpect.delete(normalizeKey(from)); repExpect.add(normalizeKey(to))
      auditTree(rep.tree, repExpect, `traceReplace order=${order}`)

      // Every intermediate frame must itself be a structurally sane tree shape.
      for (const s of del.steps) {
        checks++
        if (!frameIsSane(s.treeSnapshot)) fail(`E: malformed intermediate frame at step ${s.kind}`)
      }
      if (failures.length) break
    }
    if (failures.length) break
  }
}
function flatten(n) {
  return n.isLeaf ? { L: n.keys } : { I: n.keys, c: n.children.map(flatten) }
}
function frameIsSane(n) {
  if (!n || !Array.isArray(n.keys)) return false
  if (n.isLeaf) return true
  if (n.children.length !== n.keys.length + 1) return false
  return n.children.every(frameIsSane)
}
console.log(failures.length ? `  FAILED: ${failures[0]}` : '  passed')

console.log('\n' + '-'.repeat(60))
console.log(`${checks} assertions, ${failures.length} failures`)
if (failures.length) {
  failures.slice(0, 10).forEach(f => console.log('  ! ' + f))
  process.exit(1)
}
console.log('B+ tree deep review: clean.')
