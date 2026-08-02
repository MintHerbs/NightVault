import { useSyncExternalStore } from 'react'

/**
 * "Let Sentinel react to what I do" - the visitor's switch for the whole quip
 * and idle-face system, in the Appearance dialog beside the interrupt toggle.
 *
 * Separate from `island-notifications` on purpose. That switch is about *being
 * interrupted* by things other people did (a chat message, a post); this one is
 * about *personality*. Somebody can reasonably want to be told about a message
 * and not want a remark about the folder they opened, and folding both into one
 * toggle would make either choice impossible to express.
 *
 * Same module-level store as useIslandNotifications, and for the same reason:
 * the writer (AppearanceDialog) and the readers (the island, App's signal
 * hooks) sit on opposite branches with App between them.
 */

const STORAGE_KEY = 'sentinel-personality'

// Default on: the feature is the point, and it is self-limiting by design (see
// the budget in src/lib/sentinel/quips.js). Only an explicit 'off' opts out.
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

export function setSentinelPersonalityEnabled(next) {
  if (next === enabled) return
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // Private mode and friends: the choice still holds for this page load, it
    // just won't be remembered. Same trade-off useTheme takes.
  }
  listeners.forEach((fn) => fn())
}

/**
 * Read the switch outside React.
 *
 * The emitter is a plain module, not a component, so it cannot use the hook;
 * this is how fireQuip checks the preference before doing anything.
 */
export function isSentinelPersonalityEnabled() {
  return enabled
}

export default function useSentinelPersonality() {
  return useSyncExternalStore(subscribe, () => enabled, () => true)
}
