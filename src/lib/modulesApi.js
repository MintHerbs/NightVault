// src/lib/modulesApi.js
//
// Data-access layer for Subject (module) STRUCTURE — id, label, icon, order,
// hidden — now sourced from the Supabase `sidebar_modules` table instead of
// committing regex-surgered JS source to modules.js on GitHub. Tool routes
// (built-in app features like the B+ Tree visualizer) stay code-defined in
// modules.js — they were never admin-editable and don't belong in the DB.

import { supabase } from './supabaseClient'

/** Every Subject, in display order. */
export async function listModules() {
  const { data, error } = await supabase
    .from('sidebar_modules')
    .select('id, label, icon_name, sort_order, hidden')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    iconName: r.icon_name,
    sortOrder: r.sort_order,
    hidden: !!r.hidden,
  }))
}

/** Create a new Subject, appended after the current highest sort_order. */
export async function createModule({ id, label, iconName }) {
  const { data: maxRows, error: maxErr } = await supabase
    .from('sidebar_modules')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  if (maxErr) throw new Error(maxErr.message)
  const nextOrder = (maxRows?.[0]?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from('sidebar_modules')
    .insert({ id, label, icon_name: iconName, sort_order: nextOrder })
  if (error) throw new Error(error.message)
}

/** Rename a Subject's display label. */
export async function renameModule(id, newLabel) {
  const { error } = await supabase
    .from('sidebar_modules')
    .update({ label: newLabel })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Delete a Subject. Owner-only, delete-locked server-side (RLS). Caller is
 * still responsible for purging its notes/folders (deleteModuleNotes). */
export async function deleteModule(id) {
  const { error } = await supabase.from('sidebar_modules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Hide/unhide a Subject from the live site. */
export async function setModuleHidden(id, hidden) {
  const { error } = await supabase
    .from('sidebar_modules')
    .update({ hidden })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Whether one Subject is hidden — for the public reader's direct-URL check
 * (a hidden Subject's notes must 404 even if the note row itself isn't
 * individually hidden). */
export async function isModuleHidden(id) {
  const { data, error } = await supabase
    .from('sidebar_modules')
    .select('hidden')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return !!data?.hidden
}
