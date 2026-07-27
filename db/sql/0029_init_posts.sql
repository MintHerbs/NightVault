-- 0029_init_posts.sql
--
-- T-067: what `0006_init_posts.sql` should have contained. That file is 0
-- bytes and is already recorded as applied with the SHA of an empty string,
-- so it cannot be filled in without tripping the runner's drift check. This
-- supersedes it instead.
--
-- Transcribed from the deployed project on 2026-07-27, not written from
-- intent. Idempotent: a no-op against production, a full build on a fresh
-- database.

BEGIN;

CREATE TABLE IF NOT EXISTS public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  title         text,
  content       text NOT NULL,
  code          text,
  code_language text DEFAULT 'python',
  gif_url       text,
  upvotes       integer NOT NULL DEFAULT 0,
  downvotes     integer NOT NULL DEFAULT 0,
  flag_count    integer NOT NULL DEFAULT 0,
  is_flagged    boolean NOT NULL DEFAULT false,
  is_deleted    boolean NOT NULL DEFAULT false,
  is_edited     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT posts_title_length   CHECK (title IS NULL OR char_length(title) <= 100),
  CONSTRAINT posts_content_length CHECK (char_length(content) <= 1000),

  -- Reproduced exactly as deployed, including the quirk: with
  -- standard_conforming_strings on, '\n' is a literal backslash followed by
  -- n, not a newline, so this check does not actually count lines. Left
  -- as-is because this file records what exists; correcting it would be a
  -- behaviour change and belongs in its own migration.
  CONSTRAINT posts_code_lines     CHECK (code IS NULL OR array_length(string_to_array(code, '\n'::text), 1) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_session_id ON public.posts (session_id);
CREATE INDEX IF NOT EXISTS idx_posts_flagged    ON public.posts (is_flagged) WHERE (is_flagged = true);

COMMENT ON TABLE  public.posts           IS 'Anonymous feed posts, session-scoped. See E-008.';
COMMENT ON COLUMN public.posts.upvotes   IS 'Denormalised; maintained by trigger_sync_post_votes. See 0039.';
COMMENT ON COLUMN public.posts.downvotes IS 'Denormalised; maintained by trigger_sync_post_votes. See 0039.';

COMMIT;
