import { useSyncExternalStore } from 'react'

/**
 * "Let the Dynamic Island interrupt me" — the visitor's own switch, in the
 * Appearance dialog behind the sidebar avatar.
 *
 * A module-level store rather than a context: the writer (AppearanceDialog)
 * and the reader (DynamicIsland) sit on opposite branches of the tree with
 * App between them, so a provider would mean threading state through App for
 * a single boolean. useSyncExternalStore keeps every reader in step without
 * one.
 *
 * Turning this off silences the pill only. The sidebar badge keeps counting,
 * because it is the lossless channel by design and nothing here should be able
 * to make a message disappear.
 */

const STORAGE_KEY = 'island-notifications'

// Default on: a visitor who has never touched the switch still gets told
// about chat. Only an explicit 'off' opts out.
function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = readStored()
const listeners = new Set()

function subscribe(onChange) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function setIslandNotificationsEnabled(next) {
  if (next === enabled) return
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Private mode and friends: the choice still holds for this page load,
    // it just won't be remembered. Same trade-off useTheme takes.
  }
  listeners.forEach((fn) => fn())
}

export default function useIslandNotifications() {
  return useSyncExternalStore(subscribe, () => enabled, () => true)
}
