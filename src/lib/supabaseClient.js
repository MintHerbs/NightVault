// Centralized Supabase client configuration
import { createClient } from '@supabase/supabase-js'

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrlRaw && supabaseAnonKey)

const supabaseUrl = supabaseUrlRaw
  ? supabaseUrlRaw.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '')
  : null

const createDisabledQuery = () => {
  const result = {
    data: null,
    error: {
      message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
    },
  }

  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    single: () => builder,
    maybeSingle: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (cb) => Promise.resolve(result).finally(cb),
  }

  return builder
}

const createDisabledChannel = () => {
  const channel = {
    on: () => channel,
    subscribe: (cb) => {
      cb?.('CHANNEL_ERROR')
      return channel
    },
    track: async () => {},
    presenceState: () => ({}),
  }
  return channel
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      from: () => createDisabledQuery(),
      channel: () => createDisabledChannel(),
      removeChannel: () => {},
    }

// `withSession()` used to live here, calling the `set_session_id` RPC so that
// RLS policies could read `current_setting('app.session_id')`. It never worked:
// the RPC uses `set_config(..., true)`, which is transaction-local, and
// PostgREST runs every HTTP request in its own transaction, so the value was
// always gone by the time the next request arrived. Every policy depending on
// it silently evaluated false, which is why editing a post, switching a vote,
// un-voting and un-flagging all failed.
//
// Ownership is now enforced inside SECURITY DEFINER RPCs that take the session
// id as a parameter and filter on it (`vote_post`, `vote_comment`,
// `flag_post`, `update_own_post`, and the pre-existing `soft_delete_*`), so
// nothing needs the GUC. Removed rather than left in place, because a helper
// that appears to establish identity but does not is worse than none. See
// T-069 and db/sql/0041.
