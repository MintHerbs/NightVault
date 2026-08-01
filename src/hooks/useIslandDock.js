/**
 * useIslandDock - where the Dynamic Island sits (T-092 follow-up).
 *
 * The island is global chrome owned by App, but *where* it belongs is a
 * per-surface decision: a full-screen editor wants it out of the way in a
 * corner, every other page wants it centred at the top where it has always
 * been.
 *
 * A module-level store rather than a prop, because the alternative is threading
 * a second callback through `AppRoutes` and every page component that never
 * uses it — the same shape `onAIStateChange` already has, and one of those is
 * enough. Pages that dock the island must undock it on unmount; `dockIsland()`
 * returns the cleanup so an effect can just return it.
 */
import { useSyncExternalStore } from 'react'

export const DOCK_TOP = 'top'
export const DOCK_BOTTOM_RIGHT = 'bottom-right'

let current = DOCK_TOP
const listeners = new Set()

function emit(next) {
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => current

/**
 * Moves the island, and returns the undo.
 *
 * @param {string} dock
 * @returns {Function} restores the previous position
 */
export function dockIsland(dock) {
  const previous = current
  emit(dock)
  return () => emit(previous)
}

export default function useIslandDock() {
  // Server snapshot is the same constant: this is UI position, and there is
  // nothing to hydrate.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
