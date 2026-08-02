/**
 * What Sentinel notices about *when* you turned up, rather than about what you
 * clicked.
 *
 * Kept pure and separate from quips.js because the interesting part is the
 * arithmetic: which local day it is, whether that continues a run, and whether
 * a year has gone by. All of that is testable without a renderer or a clock,
 * given `now` is injected.
 *
 * The visit record is its own key rather than an extension of
 * `sentinel-visited` (src/hooks/useSentinelGreeting.js). That flag is a bare
 * 'true' with no timestamp in it, and rewriting its shape would make every
 * existing visitor read as brand new and re-trigger the one-time introduction.
 */

const STORAGE_KEY = 'sentinel-visits'

/** A run has to be worth remarking on before it is remarked on. */
export const STREAK_FLOOR = 3

/** Small hours: late enough that "you should sleep" is fair comment. */
export const LATE_NIGHT_HOURS = [0, 1, 2, 3, 4]

/** Early enough to be worth noticing, without catching an ordinary commute. */
export const EARLY_HOURS = [5, 6]

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Local calendar day as a sortable string.
 *
 * Deliberately local rather than UTC: a streak is about the visitor's days, and
 * a UTC boundary would break the run of anyone studying late in a positive
 * offset. Built by hand rather than sliced off toISOString(), which is UTC.
 */
export function localDayKey(now) {
  const d = new Date(now)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Whole local days between two day keys, or null if either is unparseable. */
export function daysBetween(fromKey, toKey) {
  const from = Date.parse(`${fromKey}T00:00:00`)
  const to = Date.parse(`${toKey}T00:00:00`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

/**
 * Fold this visit into the record.
 *
 * @param {object|null} record - previous record, or null for a first visit
 * @param {number} now
 * @returns {{ firstAt: number, lastDay: string, streak: number }}
 */
export function nextRecord(record, now) {
  const today = localDayKey(now)
  const firstAt = Number.isFinite(record?.firstAt) ? record.firstAt : now

  if (!record?.lastDay) return { firstAt, lastDay: today, streak: 1 }
  if (record.lastDay === today) {
    // Same day, second page load: the run does not advance, and must not be
    // reset either.
    return { firstAt, lastDay: today, streak: Math.max(1, record.streak || 1) }
  }

  const gap = daysBetween(record.lastDay, today)
  // A clock that moved backwards, or a corrupt day string, restarts the run
  // rather than producing a negative or absurd one.
  if (gap === null || gap < 0) return { firstAt, lastDay: today, streak: 1 }
  if (gap === 1) return { firstAt, lastDay: today, streak: (record.streak || 0) + 1 }
  return { firstAt, lastDay: today, streak: 1 }
}

/**
 * The one thing worth saying about this visit's timing, if anything.
 *
 * One at most, and in priority order. Firing several would mean the emitter's
 * floor silently dropped all but the first anyway, so the choice is made here
 * where it can be read and tested rather than falling out of a race.
 *
 * @param {object} args
 * @param {number} args.now
 * @param {object} args.record - the record AFTER this visit is folded in
 * @param {boolean} [args.wasFirstEver] - suppresses everything: a brand new
 *   visitor is already getting the one-time introduction
 * @returns {{ kind: 'moment', id: string, count?: number } | null}
 */
export function sessionMomentFor({ now, record, wasFirstEver = false }) {
  if (wasFirstEver || !record) return null

  // A year of this site is a bigger deal than the hour of day.
  if (Number.isFinite(record.firstAt) && now - record.firstAt >= YEAR_MS) {
    return { kind: 'moment', id: 'anniversary' }
  }

  if ((record.streak || 0) >= STREAK_FLOOR) {
    return { kind: 'moment', id: 'streak', count: record.streak }
  }

  const hour = new Date(now).getHours()
  if (LATE_NIGHT_HOURS.includes(hour)) return { kind: 'moment', id: 'late-night' }
  if (EARLY_HOURS.includes(hour)) return { kind: 'moment', id: 'early-start' }

  return null
}

/** Whether the hour is late enough that a post about it is fair game. */
export function isLateHour(now) {
  return LATE_NIGHT_HOURS.includes(new Date(now).getHours())
}

// Storage access is split from the arithmetic above so the arithmetic stays
// testable in node. Same failure stance as the rest of Sentinel: a flourish
// never throws out of the code that hosts it.
export function readVisitRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeVisitRecord(record) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // The streak resets next time. Nothing else depends on it.
  }
}
