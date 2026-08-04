// src/constants/courses.js
//
// Presentation order for course cards (T-077 follow-up).
//
// `courses` has no sort_order column, and adding one would mean a third
// migration queued behind 0049/0050 (both still unapplied) plus admin UI to
// maintain it — for an ordering that changes about once a year. A curated list
// keyed by `courses.id` gets the same result today, and it's the same pattern
// COURSE_PRESET_KEYS in coverPresets.js already uses to map a course id to its
// cover motif.
//
// Alphabetical was the previous order and read badly: prod's display names sort
// to Chemistry, Computer Science, Data Science, Mathematics with CS, so the
// course the site is actually about came second.

// Ids in the order their cards should appear. A course NOT listed here is not
// an error — it sorts after every listed one, keeping the alphabetical order
// listCourses() already asked the database for. So a newly created course
// appears predictably at the end until someone decides where it belongs.
export const COURSE_ORDER = [
  'computer-science',
  'computer-with-mathematics',
  'data-science',
]

const RANK = new Map(COURSE_ORDER.map((id, i) => [id, i]))

/**
 * Order course rows for display. Pure, and stable for unlisted courses —
 * relies on Array.prototype.sort being stable (guaranteed since ES2019), so
 * rows this doesn't rank keep the order they arrived in.
 */
export function sortCourses(rows) {
  const rank = (c) => (RANK.has(c.id) ? RANK.get(c.id) : RANK.size)
  return [...rows].sort((a, b) => rank(a) - rank(b))
}

/**
 * A readable name for a course id, without asking the database.
 *
 * Only ever used when `courses` is unreachable and no cached row is on hand
 * (see cachedCourses() in src/lib/coursesApi.js): a course landing page still
 * has to be titled something, and every id in this table is already a
 * hyphenated version of its own display name. 'computer-science' →
 * 'Computer Science'.
 *
 * Deliberately derived rather than a second hardcoded id → name map: a map
 * would be one more thing to keep in step with `display_name`, and it would be
 * wrong in a way nobody notices until the database is already down. This is
 * approximate for a course whose display name is not its id (prod's
 * 'computer-with-mathematics' is shown as "Mathematics with CS"), which is the
 * right trade for a label that only appears mid-outage.
 */
export function fallbackCourseName(id) {
  return String(id ?? '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
