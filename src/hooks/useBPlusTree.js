// React hook that wraps BPlusTree.js with state management
// Manages: tree instance, insert/delete operations (no animation)

import { useState, useCallback, useMemo } from 'react'
import { BPlusTree } from '../lib/BPlusTree'

/**
 * Custom hook for managing B+ tree state and operations
 * @param {number} order - Tree order (m value)
 * @returns {Object} - Tree state and operations
 */
export function useBPlusTree(order = 3) {
  const [tree, setTree] = useState(() => new BPlusTree(order))

  // Initialize tree with initial values
  const initializeTree = useCallback((values, treeOrder) => {
    const newTree = new BPlusTree(treeOrder)
    values.forEach(value => newTree.insert(value))
    setTree(newTree)
  }, [])

  // Insert values into the tree.
  // Clone-then-mutate: the state updater must stay pure (StrictMode invokes it
  // twice), so we never touch `currentTree`. Cloning preserves the existing tree
  // structure, so the incremental shape is kept rather than rebuilt from keys.
  const insert = useCallback((values) => {
    if (!Array.isArray(values)) {
      values = [values]
    }

    setTree(currentTree => {
      const next = currentTree.clone()
      values.forEach(v => next.insert(v))
      return next
    })
  }, [])

  // Delete values from the tree.
  // Runs the structural delete (borrow/merge) on a clone. The tree normalizes
  // each key itself, so no separate normalization is needed here.
  const deleteValues = useCallback((values) => {
    if (!Array.isArray(values)) {
      values = [values]
    }

    setTree(currentTree => {
      const next = currentTree.clone()
      values.forEach(v => next.delete(v))
      return next
    })
  }, [])

  // Change one key's value. Keys are held in sorted order, so a new value usually
  // belongs in a different leaf: the only correct edit is remove-then-reinsert,
  // which also means it reuses the two operations the fuzz suite already covers.
  const replaceValue = useCallback((oldValue, newValue) => {
    setTree(currentTree => {
      const next = currentTree.clone()
      next.delete(oldValue)
      next.insert(newValue)
      return next
    })
  }, [])

  // Reset tree with new values
  const resetTree = useCallback((values, treeOrder) => {
    initializeTree(values, treeOrder)
  }, [initializeTree])

  // Get tree statistics
  const stats = useMemo(() => {
    return tree.getStats()
  }, [tree])

  return {
    tree,
    stats,
    initializeTree,
    insert,
    deleteValues,
    replaceValue,
    resetTree
  }
}
