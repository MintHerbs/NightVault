-- 0041_social_write_rpcs.sql
--
-- T-069. Makes vote, flag and edit writes actually possible.
--
-- The problem, in full: every "own row" RLS policy on the social tables tests
-- `session_id::text = current_setting('app.session_id', true)`. That setting is
-- populated by set_session_id(), which uses set_config(..., true) — local to
-- the transaction. PostgREST gives every HTTP request its own transaction, so
-- withSession() cannot carry the value into the next request and the predicate
-- is permanently false. On top of that, `post_votes` and `comment_votes` have
-- no UPDATE policy at all, and `post_flags` has no DELETE policy.
--
-- Net effect before this migration: switching a vote errored, un-voting and
-- un-flagging silently affected zero rows, and editing an own post failed.
-- Deleting a post or comment was the only ownership-scoped action that worked,
-- precisely because it already went through a SECURITY DEFINER RPC.
--
-- This extends that existing, working pattern rather than opening the tables
-- up. Each function takes the caller's claimed session id and filters on it
-- internally, exactly as soft_delete_post() does. That is the same trust model
-- the app already has (session_id is a client-generated localStorage value and
-- the INSERT policies are all `WITH CHECK (true)`), so nothing is weakened —
-- but it does not hand anon a blanket DELETE on every vote in the table, which
-- relaxing the policies to `USING (true)` would have done.
--
-- The RLS policies themselves are deliberately left as they are. They are now
-- inert rather than load-bearing, since all writes route through these
-- functions. Removing them is a separate cleanup.

BEGIN;

-- Every social table's session_id is a FK to sessions(id). A brand-new visitor
-- who votes before posting has no sessions row yet, so each function ensures
-- one first. Cheap, idempotent, and closes a latent FK violation that existed
-- on the direct-write path too.

CREATE OR REPLACE FUNCTION public.vote_post(
  p_post_id    uuid,
  p_session_id uuid,
  p_vote_type  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_vote_type IS NOT NULL AND p_vote_type NOT IN ('up', 'down') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  IF p_vote_type IS NULL THEN
    DELETE FROM post_votes
     WHERE post_id = p_post_id AND session_id = p_session_id;
    RETURN jsonb_build_object('success', true, 'vote_type', NULL);
  END IF;

  INSERT INTO post_votes (post_id, session_id, vote_type)
  VALUES (p_post_id, p_session_id, p_vote_type)
  ON CONFLICT (post_id, session_id)
  DO UPDATE SET vote_type = EXCLUDED.vote_type;

  RETURN jsonb_build_object('success', true, 'vote_type', p_vote_type);
END;
$function$;

CREATE OR REPLACE FUNCTION public.vote_comment(
  p_comment_id uuid,
  p_session_id uuid,
  p_vote_type  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_vote_type IS NOT NULL AND p_vote_type NOT IN ('up', 'down') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  IF p_vote_type IS NULL THEN
    DELETE FROM comment_votes
     WHERE comment_id = p_comment_id AND session_id = p_session_id;
    RETURN jsonb_build_object('success', true, 'vote_type', NULL);
  END IF;

  INSERT INTO comment_votes (comment_id, session_id, vote_type)
  VALUES (p_comment_id, p_session_id, p_vote_type)
  ON CONFLICT (comment_id, session_id)
  DO UPDATE SET vote_type = EXCLUDED.vote_type;

  RETURN jsonb_build_object('success', true, 'vote_type', p_vote_type);
END;
$function$;

CREATE OR REPLACE FUNCTION public.flag_post(
  p_post_id    uuid,
  p_session_id uuid,
  p_flagged    boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  IF p_flagged THEN
    -- DO NOTHING rather than an error, so double-flagging is a no-op instead
    -- of something the client has to special-case as a duplicate.
    INSERT INTO post_flags (post_id, session_id)
    VALUES (p_post_id, p_session_id)
    ON CONFLICT (post_id, session_id) DO NOTHING;
  ELSE
    DELETE FROM post_flags
     WHERE post_id = p_post_id AND session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'flagged', p_flagged);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_own_post(
  p_post_id    uuid,
  p_session_id uuid,
  p_patch      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows int;
BEGIN
  -- A jsonb patch rather than one parameter per column, so this keeps the
  -- flexible shape updatePost() already exposes. Only keys actually present
  -- are applied; absent keys are left alone, which a plain NULL parameter
  -- could not express.
  UPDATE posts
     SET title         = CASE WHEN p_patch ? 'title'         THEN nullif(trim(p_patch ->> 'title'), '') ELSE title END,
         content       = CASE WHEN p_patch ? 'content'       THEN p_patch ->> 'content'                 ELSE content END,
         code          = CASE WHEN p_patch ? 'code'          THEN p_patch ->> 'code'                    ELSE code END,
         code_language = CASE WHEN p_patch ? 'code_language' THEN p_patch ->> 'code_language'           ELSE code_language END,
         gif_url       = CASE WHEN p_patch ? 'gif_url'       THEN p_patch ->> 'gif_url'                 ELSE gif_url END,
         is_edited     = true,
         updated_at    = now()
   WHERE id = p_post_id
     AND session_id = p_session_id
     AND is_deleted = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found or not authorized');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

COMMIT;
