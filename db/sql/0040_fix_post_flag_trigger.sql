-- 0040_fix_post_flag_trigger.sql
--
-- T-069. Same defect as 0039, third instance, plus the missing other half.
--
-- `handle_post_flag()` was not SECURITY DEFINER, so its
-- `update posts set flag_count = flag_count + 1` ran as `anon` against the
-- always-false `update_own_posts` RLS policy and matched zero rows. Flagging a
-- post has therefore never incremented flag_count, never set is_flagged, and
-- never reached the `>= 10` branch that files a moderation row. All silently,
-- because an UPDATE filtered out by RLS is not an error. Verified 2026-07-27:
-- prosecdef = false on the deployed function.
--
-- The trigger also only ever fired on INSERT, so even had it worked,
-- unflagging could never bring the counter back down. Rewritten to recount
-- from `post_flags` on INSERT OR DELETE rather than increment, which handles
-- both directions and is idempotent: running it twice cannot double-count.
-- `is_flagged` now falls back to false if flags drop below the threshold,
-- which the increment-only version could never do.
--
-- Also enables RLS on `flagged_posts_review`, the only social table with it
-- switched off (advisor lint 0013_rls_disabled_in_public, ERROR). Left with no
-- policies deliberately: nothing in `src/` references the table, the trigger
-- above writes it as SECURITY DEFINER, and the service role bypasses RLS for
-- any future moderation UI. Enabling it closes anon read and write on a list
-- of which posts have been reported.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_post_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  target uuid;
  n      int;
begin
  target := coalesce(new.post_id, old.post_id);

  select count(*) into n from post_flags where post_id = target;

  update posts
     set flag_count = n,
         is_flagged = (n >= 10)
   where id = target;

  if n >= 10 then
    insert into flagged_posts_review (post_id)
    values (target)
    on conflict (post_id) do nothing;
  end if;

  return coalesce(new, old);
end;
$function$;

DROP TRIGGER IF EXISTS trigger_handle_post_flag ON public.post_flags;
CREATE TRIGGER trigger_handle_post_flag
  AFTER INSERT OR DELETE ON public.post_flags
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_flag();

ALTER TABLE public.flagged_posts_review ENABLE ROW LEVEL SECURITY;

-- Backfill from the flags that were actually recorded. post_flags rows were
-- always written correctly; only the derived counter on posts was missed.
UPDATE posts p
   SET flag_count = t.real_flags,
       is_flagged = (t.real_flags >= 10)
  FROM (
    SELECT p2.id, count(f.id) AS real_flags
      FROM posts p2
      LEFT JOIN post_flags f ON f.post_id = p2.id
     GROUP BY p2.id
  ) t
 WHERE p.id = t.id
   AND (p.flag_count IS DISTINCT FROM t.real_flags
        OR p.is_flagged IS DISTINCT FROM (t.real_flags >= 10));

COMMIT;
