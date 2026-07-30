// src/lib/coursesApi.js
//
// Data-access layer for `courses` (T-051). Only the primary owner ever
// writes here (RLS: is_primary_owner(), 0024) — this module exposes both
// directions but non-primary-owner callers will only ever hit listCourses.
//
// Targets the schema that's actually live (0025's discovery): `courses.id`
// is a human-readable text primary key (e.g. 'computer-science') — there's
// no separate uuid + slug pair, and the display name column is
// `display_name`, not `name`. This table pre-dates T-051 and already holds
// real data; this module conforms to it rather than the other way around.

import { supabase } from './supabaseClient'
import { sortCourses } from '../constants/courses'

/** Every course, in COURSE_ORDER — used by the primary owner's course switcher,
 * the Team page's course cards, and the public home page (T-077, filtered to
 * `!hidden` there).
 *
 * The curated order is applied here rather than at each call site so the home
 * grid and the admin course switcher can't disagree about it. `display_name`
 * ordering stays on the query as the tiebreak for courses COURSE_ORDER doesn't
 * rank — see src/constants/courses.js. */
//
// `*` rather than an explicit column list, deliberately. Naming
// `hidden`/`cover_*` here would make every read of this table a hard failure
// (PostgREST 400, `column courses.cover_ascii does not exist`) on any
// environment where migrations 0049/0050 haven't been applied yet — and since
// listCourses backs the public home page, that failure mode is "the site shows
// no courses at all" until the migration lands. `*` returns whatever the
// environment actually has and toCourse fills in the absent columns, so code
// and schema can deploy in either order.
//
// This is not a wider exposure than naming columns: the client can request any
// column its grants allow either way, so RLS and the grants in 0049 are what
// bound this, not the select list.
const COURSE_COLUMNS = '*'

export async function listCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .order('display_name', { ascending: true })
  if (error) throw new Error(error.message)
  return sortCourses((data ?? []).map(toCourse))
}

/** Row → the shape the app uses. `cover*` feed resolveCoverField()
 * (src/constants/coverPresets.js), which decides the card's animation.
 * Every T-077 column is optional here — see COURSE_COLUMNS on why a row may
 * legitimately arrive without them. */
function toCourse(r) {
  return {
    id: r.id,
    name: r.display_name,
    createdAt: r.created_at,
    hidden: !!r.hidden,
    coverPreset: r.cover_preset ?? null,
    coverAscii: r.cover_ascii ?? null,
    coverAnim: r.cover_anim ?? null,
  }
}

/** Hide/unhide a course from the public site (primary-owner-only, T-077).
 * Hiding does not delete anything — Subjects, notes, and admin_users rows
 * scoped to this course_id are untouched; it only removes the course from
 * the home page grid and its own landing/notes routes. */
export async function setCourseHidden(id, hidden) {
  const { error } = await supabase
    .from('courses')
    .update({ hidden })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Set a course card's ASCII cover (T-077, migration 0050).
 *
 * Exactly one of `preset` / `ascii` wins, so the two can't disagree — passing
 * an `ascii` grid clears any preset and vice versa, and `{}` clears both,
 * returning the card to the hashed default from pickPresetForId(). `anim` only
 * applies to an uploaded grid (the presets carry their own motion); its
 * allowed values are constrained by the DB, see 0050.
 */
export async function setCourseCover(id, { preset = null, ascii = null, anim = null } = {}) {
  const { error } = await supabase
    .from('courses')
    .update({
      cover_preset: ascii ? null : preset,
      cover_ascii: ascii,
      cover_anim: ascii ? anim || 'scanline' : null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Create a new course. `id` is the slug-shaped primary key (derived from
 * `name` by the caller). Primary-owner-only server-side (RLS + the
 * admin-create-user Edge Function that provisions its first owner). */
export async function createCourse({ id, name }) {
  const { data, error } = await supabase
    .from('courses')
    .insert({ id, display_name: name })
    .select(COURSE_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toCourse(data)
}

/** Rename a course (display name only — `id` is a stable key referenced by
 * sidebar_modules.course_id and admin_users.course_id, so it's never
 * rewritten here). Primary-owner-only server-side (RLS, 0026). */
export async function updateCourse({ id, name }) {
  const { data, error } = await supabase
    .from('courses')
    .update({ display_name: name })
    .eq('id', id)
    .select(COURSE_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toCourse(data)
}

/** Delete a course. Primary-owner-only server-side (RLS, 0026). The DB
 * itself refuses this while any sidebar_modules row still references the
 * course (fk default NO ACTION) or any admin_users row still does (fk
 * tightened from SET NULL to NO ACTION in 0026, specifically so this never
 * silently orphans a person's course_id) — callers should still check and
 * surface a friendlier message before calling this, rather than relying on
 * the raw FK-violation error text. */
export async function deleteCourse(id) {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
