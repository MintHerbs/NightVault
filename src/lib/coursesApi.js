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
