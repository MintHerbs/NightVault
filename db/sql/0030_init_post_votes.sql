-- 0030_init_post_votes.sql
--
-- T-067: supersedes the 0-byte `0007_init_post_votes.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- `db/README.md:39` described this migration as "post_votes + vote-count sync
-- trigger". The trigger does exist, and is reproduced here exactly as
-- deployed, INCLUDING its defect: it fires on INSERT OR DELETE only, never on
-- UPDATE. The client switches a vote with an upsert, which conflicts and
-- becomes an UPDATE, so switching a vote never re-syncs posts.upvotes /
-- posts.downvotes. That is fixed in 0039, deliberately kept separate so this
-- file stays a faithful record and a true no-op against production.

BEGIN;

CREATE TABLE IF NOT EXISTS public.post_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  vote_type  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT post_votes_vote_type_check CHECK (vote_type = ANY (ARRAY['up'::text, 'down'::text])),
  CONSTRAINT post_votes_post_id_session_id_key UNIQUE (post_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_post_votes_post_id ON public.post_votes (post_id);

-- The UNIQUE above is what the client's
-- `.upsert(..., { onConflict: 'post_id,session_id' })` targets in
-- src/hooks/usePosts.js. Without it every vote write fails with 42P10.

CREATE OR REPLACE FUNCTION public.sync_post_votes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  update posts set
    upvotes = (select count(*) from post_votes
               where post_id = coalesce(new.post_id, old.post_id) and vote_type = 'up'),
    downvotes = (select count(*) from post_votes
                 where post_id = coalesce(new.post_id, old.post_id) and vote_type = 'down')
  where id = coalesce(new.post_id, old.post_id);
  return coalesce(new, old);
end;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_post_votes ON public.post_votes;
CREATE TRIGGER trigger_sync_post_votes
  AFTER INSERT OR DELETE ON public.post_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_votes();

COMMIT;
