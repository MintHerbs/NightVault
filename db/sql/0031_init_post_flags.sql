-- 0031_init_post_flags.sql
--
-- T-067: supersedes the 0-byte `0008_init_post_flags.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- Two deployed defects are reproduced here rather than corrected, so this
-- file stays a faithful record. Both are filed separately:
--   * handle_post_flag() fires AFTER INSERT only, so flag_count only ever
--     grows; unflagging never decrements it.
--   * flagged_posts_review has RLS disabled entirely (confirmed by the
--     Supabase security advisor, lint 0013_rls_disabled_in_public), so it is
--     readable and writable by anyone holding the anon key.

BEGIN;

CREATE TABLE IF NOT EXISTS public.post_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT post_flags_post_id_session_id_key UNIQUE (post_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_post_flags_post_id ON public.post_flags (post_id);

CREATE TABLE IF NOT EXISTS public.flagged_posts_review (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  flagged_at    timestamptz NOT NULL DEFAULT now(),
  review_status text NOT NULL DEFAULT 'pending',

  CONSTRAINT flagged_posts_review_post_id_key UNIQUE (post_id),
  CONSTRAINT flagged_posts_review_review_status_check
    CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'removed'::text]))
);

CREATE OR REPLACE FUNCTION public.handle_post_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  update posts
  set flag_count = flag_count + 1,
      is_flagged = (flag_count + 1 >= 10)
  where id = new.post_id;

  if (select flag_count from posts where id = new.post_id) >= 10 then
    insert into flagged_posts_review (post_id)
    values (new.post_id)
    on conflict (post_id) do nothing;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trigger_handle_post_flag ON public.post_flags;
CREATE TRIGGER trigger_handle_post_flag
  AFTER INSERT ON public.post_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_flag();

COMMIT;
