-- 0032_init_comments.sql
--
-- T-067: supersedes the 0-byte `0009_init_comments.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- The depth-enforcement trigger `db/README.md:41` describes does exist. Note
-- it enforces a two-level thread (depth 0 and 1) both as a CHECK and in the
-- trigger, which matches buildNestedComments() in src/hooks/useComments.js.

BEGIN;

CREATE TABLE IF NOT EXISTS public.comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  session_id        uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  content           text NOT NULL,
  upvotes           integer NOT NULL DEFAULT 0,
  downvotes         integer NOT NULL DEFAULT 0,
  is_deleted        boolean NOT NULL DEFAULT false,
  depth             integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT comments_content_length CHECK (char_length(content) <= 500),
  CONSTRAINT comments_max_depth      CHECK (depth <= 1)
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent  ON public.comments (parent_comment_id);

CREATE OR REPLACE FUNCTION public.check_comment_depth()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if new.parent_comment_id is not null then
    if (select depth from comments where id = new.parent_comment_id) >= 1 then
      raise exception 'Cannot reply deeper than 1 level';
    end if;
    new.depth := 1;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trigger_check_comment_depth ON public.comments;
CREATE TRIGGER trigger_check_comment_depth
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.check_comment_depth();

COMMIT;
