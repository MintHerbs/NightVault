-- 0039_fix_vote_sync_triggers.sql
--
-- T-068. The first migration in the 0028-0039 range that changes production
-- behaviour rather than recording it.
--
-- Two independent defects made posts.upvotes / posts.downvotes (and the
-- comment equivalents) permanently wrong. Either alone is enough to break
-- them, which is why fixing only the obvious one would have looked like a
-- fix and changed nothing.
--
-- 1. The trigger never fired on UPDATE. The client switches a vote with
--    `.upsert(..., { onConflict: 'post_id,session_id' })`, which becomes
--    INSERT ... ON CONFLICT DO UPDATE, so switching up to down never
--    re-synced.
--
-- 2. The trigger function was not SECURITY DEFINER. Trigger functions run as
--    the invoking role, which for the feed is `anon`. `posts` has RLS enabled
--    and its only UPDATE policy is
--    `session_id::text = current_setting('app.session_id', true)`, which is
--    always false because set_session_id() sets a transaction-local GUC and
--    PostgREST gives each request its own transaction. So the trigger's
--    `update posts` matched zero rows and failed silently, since an UPDATE
--    filtered out by RLS is not an error.
--
--    Verified 2026-07-27: all 2 of 2 vote rows in the project had
--    stored counts of 0 against real counts of 1.
--
-- SECURITY DEFINER is safe here: the function takes no caller-supplied input
-- beyond the trigger row, only ever recounts from the vote table and writes
-- the two integer columns on the matching parent row, and pins search_path so
-- it cannot be redirected. Pinning search_path also clears advisor lint
-- 0011_function_search_path_mutable for both functions.
--
-- Also recounts every existing row once, to clear the drift already on disk.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_post_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  target uuid;
begin
  -- Both sides, deduplicated: on UPDATE the parent could in principle change,
  -- which would leave the old parent stale if only the new one were counted.
  for target in
    select distinct t
      from unnest(array[old.post_id, new.post_id]) as t
     where t is not null
  loop
    update posts set
      upvotes   = (select count(*) from post_votes where post_id = target and vote_type = 'up'),
      downvotes = (select count(*) from post_votes where post_id = target and vote_type = 'down')
    where id = target;
  end loop;
  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_comment_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  target uuid;
begin
  for target in
    select distinct t
      from unnest(array[old.comment_id, new.comment_id]) as t
     where t is not null
  loop
    update comments set
      upvotes   = (select count(*) from comment_votes where comment_id = target and vote_type = 'up'),
      downvotes = (select count(*) from comment_votes where comment_id = target and vote_type = 'down')
    where id = target;
  end loop;
  return coalesce(new, old);
end;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_post_votes ON public.post_votes;
CREATE TRIGGER trigger_sync_post_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.post_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_votes();

DROP TRIGGER IF EXISTS trigger_sync_comment_votes ON public.comment_votes;
CREATE TRIGGER trigger_sync_comment_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_votes();

-- One-time backfill. Only touches rows that actually disagree, so re-running
-- this migration is a no-op.
UPDATE posts p
   SET upvotes   = t.real_up,
       downvotes = t.real_down
  FROM (
    SELECT p2.id,
           count(*) FILTER (WHERE v.vote_type = 'up')   AS real_up,
           count(*) FILTER (WHERE v.vote_type = 'down') AS real_down
      FROM posts p2
      LEFT JOIN post_votes v ON v.post_id = p2.id
     GROUP BY p2.id
  ) t
 WHERE p.id = t.id
   AND (p.upvotes IS DISTINCT FROM t.real_up OR p.downvotes IS DISTINCT FROM t.real_down);

UPDATE comments c
   SET upvotes   = t.real_up,
       downvotes = t.real_down
  FROM (
    SELECT c2.id,
           count(*) FILTER (WHERE v.vote_type = 'up')   AS real_up,
           count(*) FILTER (WHERE v.vote_type = 'down') AS real_down
      FROM comments c2
      LEFT JOIN comment_votes v ON v.comment_id = c2.id
     GROUP BY c2.id
  ) t
 WHERE c.id = t.id
   AND (c.upvotes IS DISTINCT FROM t.real_up OR c.downvotes IS DISTINCT FROM t.real_down);

COMMIT;
