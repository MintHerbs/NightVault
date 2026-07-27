-- 0033_init_comment_votes.sql
--
-- T-067: supersedes the 0-byte `0010_init_comment_votes.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- As with post_votes in 0030, the sync trigger is reproduced with its
-- deployed defect (INSERT OR DELETE, never UPDATE). Fixed in 0039.

BEGIN;

CREATE TABLE IF NOT EXISTS public.comment_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  vote_type  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comment_votes_vote_type_check CHECK (vote_type = ANY (ARRAY['up'::text, 'down'::text])),
  CONSTRAINT comment_votes_comment_id_session_id_key UNIQUE (comment_id, session_id)
);

-- Deployed has no index on comment_id, unlike post_votes. Recorded as-is;
-- adding one would be a change, not a transcription.

CREATE OR REPLACE FUNCTION public.sync_comment_votes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  update comments set
    upvotes = (select count(*) from comment_votes
               where comment_id = coalesce(new.comment_id, old.comment_id) and vote_type = 'up'),
    downvotes = (select count(*) from comment_votes
                 where comment_id = coalesce(new.comment_id, old.comment_id) and vote_type = 'down')
  where id = coalesce(new.comment_id, old.comment_id);
  return coalesce(new, old);
end;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_comment_votes ON public.comment_votes;
CREATE TRIGGER trigger_sync_comment_votes
  AFTER INSERT OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_votes();

COMMIT;
