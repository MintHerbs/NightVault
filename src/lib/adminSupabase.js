import { supabase } from './supabaseClient'

// The one account that can create courses and 'owner'-role accounts (spec:
// docs/specs/course-roles-and-user-management.md §5). This client-side check
// is a UX short-circuit only — is_primary_owner() (0024) against the
// verified JWT email is the actual security boundary, same pattern as the
// pre-existing delete lockdown (T-045 §6).
export const PRIMARY_OWNER_EMAIL = 'moon@mooner.dev'

export async function getAdminProfile(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}
