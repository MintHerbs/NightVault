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

/** Every course, alphabetically — used by the primary owner's course switcher
 * and the Team page's course cards. */
export async function listCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, display_name, created_at')
    .order('display_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.display_name,
    createdAt: r.created_at,
  }))
}

/** Create a new course. `id` is the slug-shaped primary key (derived from
 * `name` by the caller). Primary-owner-only server-side (RLS + the
 * admin-create-user Edge Function that provisions its first owner). */
export async function createCourse({ id, name }) {
  const { data, error } = await supabase
    .from('courses')
    .insert({ id, display_name: name })
    .select('id, display_name, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, name: data.display_name, createdAt: data.created_at }
}

/** Rename a course (display name only — `id` is a stable key referenced by
 * sidebar_modules.course_id and admin_users.course_id, so it's never
 * rewritten here). Primary-owner-only server-side (RLS, 0026). */
export async function updateCourse({ id, name }) {
  const { data, error } = await supabase
    .from('courses')
    .update({ display_name: name })
    .eq('id', id)
    .select('id, display_name, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, name: data.display_name, createdAt: data.created_at }
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
