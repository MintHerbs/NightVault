// A B+ tree that splits the way the Database Systems lectures split.
//
// Convention matters here, because two are in circulation and they produce
// different trees from the same input. Noorie's worked example (Semester 2
// lecture 5) copies up the LAST key of the left leaf on a leaf split, and
// pushes up the MIDDLE key on an internal split. Search goes left on <=.
//
// The other common convention copies up the FIRST key of the RIGHT leaf. It is
// equally correct and is what many textbooks print, but it yields a different
// separator at every level, so mixing the two would put this note at odds with
// the lecture the student is examined on. Her example is self-consistent
// throughout, so it is the one implemented here.
//
//   p      order: maximum pointers in an internal node, so at most p-1 keys
//   pleaf  maximum keys in a leaf

export function makeTree(p, pleaf) {
  return { p, pleaf, root: { leaf: true, keys: [], children: [] } }
}

const maxInternalKeys = (t) => t.p - 1

function findLeafPath(t, key) {
  const path = []
  let node = t.root
  while (!node.leaf) {
    // <= goes left, matching the "separator is the largest key on the left"
    // convention above.
    let i = 0
    while (i < node.keys.length && key > node.keys[i]) i += 1
    path.push({ node, index: i })
    node = node.children[i]
  }
  return { leaf: node, path }
}

/** Inserts one key, returning a description of what the insert had to do. */
export function insert(t, key) {
  const { leaf, path } = findLeafPath(t, key)
  const events = []

  let i = 0
  while (i < leaf.keys.length && leaf.keys[i] < key) i += 1
  leaf.keys.splice(i, 0, key)
  events.push({ type: 'place', key, into: [...leaf.keys] })

  if (leaf.keys.length <= t.pleaf) return { key, events, split: false }

  // Leaf overflow. Left keeps the larger half; its last key is copied up.
  const leftCount = Math.ceil(leaf.keys.length / 2)
  const rightKeys = leaf.keys.slice(leftCount)
  leaf.keys = leaf.keys.slice(0, leftCount)
  const right = { leaf: true, keys: rightKeys, children: [], next: leaf.next }
  leaf.next = right
  const separator = leaf.keys[leaf.keys.length - 1]
  events.push({ type: 'splitLeaf', left: [...leaf.keys], right: [...rightKeys], up: separator })

  promote(t, path, leaf, right, separator, events)
  return { key, events, split: true }
}

function promote(t, path, leftChild, rightChild, separator, events) {
  if (path.length === 0) {
    t.root = { leaf: false, keys: [separator], children: [leftChild, rightChild] }
    events.push({ type: 'newRoot', keys: [separator] })
    return
  }

  const { node, index } = path[path.length - 1]
  node.keys.splice(index, 0, separator)
  node.children.splice(index + 1, 0, rightChild)

  if (node.keys.length <= maxInternalKeys(t)) {
    events.push({ type: 'absorb', into: [...node.keys] })
    return
  }

  // Internal overflow. The middle key moves up and does NOT stay behind.
  const mid = Math.floor(node.keys.length / 2)
  const up = node.keys[mid]
  const right = {
    leaf: false,
    keys: node.keys.slice(mid + 1),
    children: node.children.slice(mid + 1),
  }
  node.keys = node.keys.slice(0, mid)
  node.children = node.children.slice(0, mid + 1)
  events.push({ type: 'splitInternal', left: [...node.keys], right: [...right.keys], up })

  promote(t, path.slice(0, -1), node, right, up, events)
}

/** Every key in the tree, left to right along the leaf chain. */
export function leafOrder(t) {
  let node = t.root
  while (!node.leaf) node = node.children[0]
  const out = []
  while (node) {
    out.push([...node.keys])
    node = node.next
  }
  return out
}

/** Levels of the tree, each a list of nodes, for drawing. */
export function levels(t) {
  const out = []
  let row = [t.root]
  while (row.length) {
    out.push(row.map((n) => ({ keys: [...n.keys], leaf: n.leaf, ref: n })))
    const next = []
    for (const n of row) if (!n.leaf) next.push(...n.children)
    row = next
  }
  return out
}

export function height(t) {
  let h = 0
  let node = t.root
  while (!node.leaf) {
    h += 1
    node = node.children[0]
  }
  return h
}

/** Builds a tree from a key sequence, keeping a snapshot after every insert. */
export function build(keys, p, pleaf) {
  const t = makeTree(p, pleaf)
  const steps = []
  for (const k of keys) {
    const r = insert(t, k)
    steps.push({ key: k, split: r.split, events: r.events, levels: levels(t), leaves: leafOrder(t) })
  }
  return { tree: t, steps }
}

/** Every key inserted must be findable, and the leaf chain must be sorted. */
export function check(keys, p, pleaf) {
  const { tree } = build(keys, p, pleaf)
  const flat = leafOrder(tree).flat()
  const sorted = [...new Set(keys)].sort((a, b) => a - b)
  if (flat.join(',') !== sorted.join(',')) {
    throw new Error(`leaf chain ${flat.join(',')} does not match sorted input ${sorted.join(',')}`)
  }
  for (const k of keys) {
    const { leaf } = findLeafPath(tree, k)
    if (!leaf.keys.includes(k)) throw new Error(`${k} was inserted but search does not reach its leaf`)
  }
  // every leaf at the same depth
  const depths = new Set()
  const walk = (n, d) => {
    if (n.leaf) return depths.add(d)
    for (const c of n.children) walk(c, d + 1)
  }
  walk(tree.root, 0)
  if (depths.size !== 1) throw new Error(`leaves sit at different depths: ${[...depths].join(', ')}`)
  return tree
}
