// src/lib/treeTrace.js
// Turns a B+ tree operation into a list of replayable animation steps.
//
// The steps come from BPlusTree's own `_emit` hooks, so the narration is produced by the
// same code that builds the tree. src/engine/AnimationEngine.js took the other route, a
// second stepped implementation, and drifted into a different data structure entirely:
// it is parameterised by minimum degree t (max keys 2t, min keys t-1) where BPlusTree
// uses order m (max keys m-1, min keys ⌈m/2⌉-1), and it reads `tree.t`, a property
// BPlusTree does not have. Order 3 on [4,c,r,s,t] gives a three-leaf tree here and one
// unsplit five-key leaf there. Narrating from the real thing makes that class of drift
// impossible.

import { BPlusTree } from './BPlusTree.js'

/**
 * Plain, serialisable copy of a node subtree, in the shape calculateTreeLayout expects.
 * Leaf `next` links are restored afterwards by relinkLeaves.
 */
function copySubtree(node) {
  if (!node) return null
  const copy = {
    id: node.id,
    isLeaf: node.isLeaf,
    keys: [...node.keys],
    children: [],
    next: null,
    parent: null
  }
  if (!node.isLeaf) {
    copy.children = node.children.map(copySubtree)
    copy.children.forEach((child) => { child.parent = copy })
  }
  return copy
}

function collectLeaves(node, out = []) {
  if (!node) return out
  if (node.isLeaf) out.push(node)
  else node.children.forEach((child) => collectLeaves(child, out))
  return out
}

function snapshotRoot(root) {
  const copy = copySubtree(root)
  const leaves = collectLeaves(copy)
  for (let i = 0; i < leaves.length - 1; i++) leaves[i].next = leaves[i + 1]
  return copy
}

/**
 * Runs `operation` against a copy of `tree`, collecting a step per narrated event.
 *
 * @param {BPlusTree} tree
 * @param {(clone: BPlusTree) => void} operation
 * @returns {{steps: Array<{id, kind, description, treeSnapshot}>, tree: BPlusTree}}
 */
function trace(tree, operation) {
  const clone = tree.clone()

  // Step 0 is the tree before the operation, so stepping back from the first change
  // shows what it looked like beforehand.
  const steps = [{
    id: 0,
    kind: 'start',
    description: 'Starting tree.',
    nodes: [],
    keys: [],
    intent: null,
    treeSnapshot: snapshotRoot(clone._root)
  }]

  clone._observer = (kind, description, detail) => {
    steps.push({
      id: steps.length,
      kind,
      description,
      // Normalised here rather than at every call site, so the canvas can read
      // step.nodes/step.keys without null-checking a payload that most kinds omit.
      nodes: detail?.nodes ?? [],
      keys: detail?.keys ?? [],
      intent: detail?.intent ?? null,
      // Snapshot AFTER the mutation the emit describes, so a step shows its own result.
      treeSnapshot: snapshotRoot(clone._root)
    })
  }

  operation(clone)
  clone._observer = null

  return { steps, tree: clone }
}

/** Steps for inserting one key. */
export function traceInsert(tree, key) {
  return trace(tree, (clone) => clone.insert(key))
}

/** Steps for deleting one key. */
export function traceDelete(tree, key) {
  return trace(tree, (clone) => clone.delete(key))
}

/** Steps for a batch of inserts, narrated end to end. */
export function traceInsertMany(tree, keys) {
  return trace(tree, (clone) => { for (const key of keys) clone.insert(key) })
}

/** Steps for a batch of deletes, narrated end to end. */
export function traceDeleteMany(tree, keys) {
  return trace(tree, (clone) => { for (const key of keys) clone.delete(key) })
}

/**
 * Steps for changing one key's value.
 *
 * A B+ tree keeps keys in sorted order, so a different value usually belongs in a
 * different leaf — there is no in-place overwrite that preserves the invariants.
 * The edit is therefore a delete followed by an insert, and it is narrated as
 * exactly that rather than presented as a single mysterious mutation.
 */
export function traceReplace(tree, oldKey, newKey) {
  return trace(tree, (clone) => {
    clone.delete(oldKey)
    clone.insert(newKey)
  })
}

/** Steps for building a tree from scratch. */
export function traceBuild(values, order) {
  const empty = new BPlusTree(order)
  return trace(empty, (clone) => { for (const value of values) clone.insert(value) })
}
