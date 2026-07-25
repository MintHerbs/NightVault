// src/lib/coursesApi.js
//
// Data-access layer for `courses` (T-051). Only the primary owner ever
// writes here (RLS: is_primary_owner(), 0024) — this module exposes both
// directions but non-primary-owner callers will only ever hit listCourses.

import { supabase } from './supabaseClient'

/** Every course, alphabetically — used by the primary owner's course switcher
 * and the "create course" flow's existing-slug check. */
export async function listCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, slug, created_at')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.created_at,
  }))
}

/** Create a new course. Primary-owner-only server-side (RLS + the
 * admin-create-user Edge Function that provisions its first owner). */
export async function createCourse({ name, slug }) {
  const { data, error } = await supabase
    .from('courses')
    .insert({ name, slug })
    .select('id, name, slug, created_at')
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id, name: data.name, slug: data.slug, createdAt: data.created_at }
}
