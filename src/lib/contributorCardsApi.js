// src/lib/contributorCardsApi.js
//
// T-072: the `avatars` Storage bucket (Settings-page profile photos and
// public contributor-card photos, sharing one bucket per 0043's comment) and
// the `contributor_cards` table backing AboutPage.jsx's "Meet the Team".
//
// admin_users.display_name/avatar_url go through the admin_update_own_profile
// RPC instead (0043) — that table mixes public-safe and sensitive columns, so
// it can't take a plain self-row RLS policy the way contributor_cards can.
import { supabase } from './supabaseClient'

export const AVATARS_BUCKET = 'avatars'

/**
 * Uploads an already-cropped WebP blob (see AvatarCropper) to
 * `avatars/{kind}/{adminUserId}/{uuid}.webp` and returns its public URL.
 * `kind` is 'profile' (Settings-page photo) or 'contributor-card' (team
 * card photo) — two prefixes in one bucket, since both need identical
 * public-read access.
 */
export async function uploadAvatarPhoto(blob, adminUserId, kind) {
  const path = `${kind}/${adminUserId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, blob, { contentType: 'image/webp' })
  if (error) throw new Error(error.message)
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Writes display_name/avatar_url via the admin_update_own_profile RPC (0043).
 * Pass the FULL current pair, not just the field being changed — the RPC does
 * a plain assignment, not a coalesce, so a null here blanks the other column.
 */
export async function updateOwnProfile({ displayName, avatarUrl }) {
  const { error } = await supabase.rpc('admin_update_own_profile', {
    p_display_name: displayName,
    p_avatar_url: avatarUrl,
  })
  if (error) throw new Error(error.message)
}

/** The caller's own contributor_cards row, or null if they haven't made one yet. */
export async function getOwnContributorCard(adminUserId) {
  const { data, error } = await supabase
    .from('contributor_cards')
    .select('*')
    .eq('admin_user_id', adminUserId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Insert-or-update the caller's own card in one call (self-row RLS covers both). */
export async function upsertContributorCard(card) {
  const { data, error } = await supabase
    .from('contributor_cards')
    .upsert(card, { onConflict: 'admin_user_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listContributorCards(section) {
  const { data, error } = await supabase
    .from('contributor_cards')
    .select('*')
    .eq('section', section)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
