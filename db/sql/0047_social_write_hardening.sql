-- 0048_social_write_hardening.sql
-- T-078 (security hardening audit).
--
-- Closes the two critical findings on the anonymous social/chat feature:
--
-- 1. `session_id` was returned in every bulk read of posts/comments/votes/
--    flags (`select('*')` and friends), and is the ONLY ownership check the
--    vote/flag/edit/delete RPCs (0041) trust. Reading a stranger's session_id
--    off any feed/thread response is enough to impersonate them into those
--    RPCs — edit or delete their post/comment, or flip their vote. Column-
--    level GRANTs (tested locally: PostgREST returns 42501 for both
--    `select=session_id` and `.eq('session_id', ...)` once the column grant
--    is gone) now keep that column out of every anon/authenticated read on
--    posts, comments, post_votes, comment_votes, poll_votes and post_flags.
--    "Is this mine" now goes through get_my_* SECURITY DEFINER RPCs that take
--    the caller's claimed session_id as a parameter instead of a column they
--    can read off someone else's row.
--
--    Deliberately NOT applied to `messages`: chat has no edit/delete/vote
--    surface at all (0001 only ever defined INSERT/SELECT), so there is
--    nothing for a leaked session_id to be replayed into, and ChatAvatar
--    (src/features/chat/components/ChatBubble/ChatBubble.jsx) uses it as a
--    deliberate pseudonymous-avatar seed — locking that column would remove
--    a feature to fix a vulnerability that doesn't exist on this table.
--
-- 2. `insert_posts`/`insert_comments`/`insert_votes`/`insert_comment_votes`/
--    `insert_poll_votes`/`insert_flags`/`insert_blacklist` and the messages
--    insert policy (0036, 0001) are all `WITH CHECK (true)`. check_bot_
--    blacklist() and check_and_increment_rate_limit() (0037) are calls the
--    CLIENT chooses to make before inserting — a direct `POST /rest/v1/...`
--    skips both. Every write that creates new content now goes through a
--    SECURITY DEFINER RPC (create_post, create_comment, send_message,
--    vote_poll) that performs those checks itself before writing, and the
--    matching table-level INSERT grant is revoked from anon/authenticated so
--    the direct-REST path is gone, not just discouraged. vote_post/
--    vote_comment (0041) gain the same rate-limit call they were missing
--    (votes had no rate limit at all until now).
--
-- Residual, known limitations (real fixes need real per-browser identity —
-- see T-078's "Suggested fix"):
--   * session_id is still a client-generated, unauthenticated value. Rate
--     limiting and bot-blacklisting are keyed to it, so an attacker who
--     mints a fresh UUID per request is still only slowed by check_bot_
--     blacklist's content-based heuristics (duplicate/rapid posting), not
--     stopped outright. This migration raises the cost of the attack in
--     finding #2 from "one curl loop" to "mint a session per request"; it
--     does not solve anonymous-identity abuse in general.
--   * Supabase Realtime's `postgres_changes` payloads are built from the
--     replication stream, not a PostgREST-authorized SELECT, so an actively
--     connected subscriber may still see `session_id` in `payload.new` for
--     posts/comments/votes/flags at the moment of the change even after this
--     migration. This closes the "browse the persisted feed at leisure and
--     pick any target" version of finding #1 (the practical, always-available
--     attack); it does not close a "sniff the realtime channel at the exact
--     moment a target posts" variant. Documented rather than silently
--     claimed as fully fixed.
--
-- Self-review fix (same pass, before this was applied anywhere but local
-- dev): the initial version of this migration missed two live consumers of
-- posts.session_id/comments.session_id beyond the vote/flag/edit/delete RPCs —
-- PostCard.jsx and CommentItem.jsx read it directly to decide "is this mine"
-- (edit/delete controls) and as the AgentAvatar seed. Locking the column
-- broke both: `select=*` on posts/comments (what src/hooks/usePosts.js and
-- useComments.js actually call) started 401ing outright since PostgREST
-- denies the whole projection if any requested column lacks a grant — not a
-- silent omission — so the entire feed and every comment thread stopped
-- loading. get_my_post_ids/get_my_comment_ids below fix "is this mine"; the
-- avatar seed falls back to the post/comment's own id (see the client-side
-- diff), which is a disclosed behaviour change — the same author's avatar is
-- no longer visually consistent across their different posts — rather than a
-- silent one, since restoring session_id as the seed would reopen exactly
-- the impersonation hole this migration exists to close.

BEGIN;

-- ─── Rate limiting added to the two write RPCs that never had it ──────────
-- vote_post/vote_comment (0041) had no rate limit at all — 50/hour, the same
-- config src/hooks/useRateLimit.js already defines for the 'vote' action, so
-- a client that does call checkLimit('vote') one day will not double-count
-- against this.

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
DECLARE
  v_limit jsonb;
BEGIN
  IF p_vote_type IS NOT NULL AND p_vote_type NOT IN ('up', 'down') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  v_limit := check_and_increment_rate_limit(p_session_id, 'vote', 50, 3600);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

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
DECLARE
  v_limit jsonb;
BEGIN
  IF p_vote_type IS NOT NULL AND p_vote_type NOT IN ('up', 'down') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid vote type');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  v_limit := check_and_increment_rate_limit(p_session_id, 'vote', 50, 3600);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

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

-- ─── New write RPCs: the only path onto their tables from here on ─────────

CREATE OR REPLACE FUNCTION public.is_session_blacklisted(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM bot_blacklist WHERE session_id = p_session_id);
$function$;

CREATE OR REPLACE FUNCTION public.create_post(
  p_session_id    uuid,
  p_title         text,
  p_content       text,
  p_code          text,
  p_code_language text,
  p_gif_url       text,
  p_poll_options  jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_bot   jsonb;
  v_limit jsonb;
  v_post  posts;
BEGIN
  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  v_bot := check_bot_blacklist(p_session_id);
  IF (v_bot->>'is_blacklisted')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to post at this time');
  END IF;

  v_limit := check_and_increment_rate_limit(p_session_id, 'post', 50, 3600);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

  INSERT INTO posts (session_id, title, content, code, code_language, gif_url)
  VALUES (p_session_id, p_title, p_content, p_code, p_code_language, p_gif_url)
  RETURNING * INTO v_post;

  IF p_poll_options IS NOT NULL THEN
    INSERT INTO polls (post_id, options) VALUES (v_post.id, p_poll_options);
  END IF;

  -- session_id deliberately excluded from the returned row — the client
  -- already knows its own session_id and has no legitimate reason to read it
  -- back off a table column (see this file's header).
  RETURN jsonb_build_object(
    'success', true,
    'post', jsonb_build_object(
      'id', v_post.id, 'title', v_post.title, 'content', v_post.content,
      'code', v_post.code, 'code_language', v_post.code_language, 'gif_url', v_post.gif_url,
      'upvotes', v_post.upvotes, 'downvotes', v_post.downvotes, 'flag_count', v_post.flag_count,
      'is_flagged', v_post.is_flagged, 'is_deleted', v_post.is_deleted, 'is_edited', v_post.is_edited,
      'created_at', v_post.created_at, 'updated_at', v_post.updated_at
    )
  );
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Content too long or invalid');
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_comment(
  p_session_id        uuid,
  p_post_id           uuid,
  p_parent_comment_id uuid,
  p_content           text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_bot     jsonb;
  v_limit   jsonb;
  v_parent  comments;
  v_comment comments;
BEGIN
  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  IF p_parent_comment_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM comments WHERE id = p_parent_comment_id;
    IF v_parent.id IS NULL OR v_parent.depth <> 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid parent comment');
    END IF;
  END IF;

  v_bot := check_bot_blacklist(p_session_id);
  IF (v_bot->>'is_blacklisted')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to post at this time');
  END IF;

  v_limit := check_and_increment_rate_limit(p_session_id, 'comment', 10, 3600);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

  INSERT INTO comments (post_id, parent_comment_id, session_id, content)
  VALUES (p_post_id, p_parent_comment_id, p_session_id, p_content)
  RETURNING * INTO v_comment;

  RETURN jsonb_build_object(
    'success', true,
    'comment', jsonb_build_object(
      'id', v_comment.id, 'post_id', v_comment.post_id, 'parent_comment_id', v_comment.parent_comment_id,
      'content', v_comment.content, 'upvotes', v_comment.upvotes, 'downvotes', v_comment.downvotes,
      'is_deleted', v_comment.is_deleted, 'depth', v_comment.depth, 'created_at', v_comment.created_at
    )
  );
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Comment too long, or thread too deep');
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_message(
  p_session_id     uuid,
  p_content        text,
  p_attachment_url text,
  p_attachment_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit   jsonb;
  v_message messages;
BEGIN
  IF p_attachment_type IS NOT NULL AND p_attachment_type NOT IN ('gif', 'sticker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid attachment type');
  END IF;
  -- KLIPY's CDN host isn't pinned down anywhere in this codebase (see
  -- supabase/functions/klipy/index.ts), so this can only reject obviously
  -- unsafe schemes (javascript:, data:), not enforce a specific host. Closes
  -- scheme-injection; does not fully close "any https image host" — see
  -- T-078 for the follow-up once KLIPY's actual CDN domain is confirmed.
  IF p_attachment_url IS NOT NULL AND p_attachment_url NOT LIKE 'https://%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid attachment URL');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  IF is_session_blacklisted(p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to send messages at this time');
  END IF;

  v_limit := check_and_increment_rate_limit(p_session_id, 'chat', 20, 300);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

  INSERT INTO messages (session_id, content, attachment_url, attachment_type)
  VALUES (p_session_id, coalesce(p_content, ''), p_attachment_url, p_attachment_type)
  RETURNING * INTO v_message;

  RETURN jsonb_build_object('success', true, 'message', to_jsonb(v_message));
EXCEPTION WHEN check_violation THEN
  RETURN jsonb_build_object('success', false, 'error', 'Invalid message');
END;
$function$;

CREATE OR REPLACE FUNCTION public.vote_poll(
  p_poll_id      uuid,
  p_session_id   uuid,
  p_option_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit   jsonb;
  v_options jsonb;
BEGIN
  SELECT options INTO v_options FROM polls WHERE id = p_poll_id;
  IF v_options IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poll not found');
  END IF;
  IF p_option_index < 0 OR p_option_index >= jsonb_array_length(v_options) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid option');
  END IF;

  INSERT INTO sessions (id) VALUES (p_session_id) ON CONFLICT (id) DO NOTHING;

  v_limit := check_and_increment_rate_limit(p_session_id, 'vote', 50, 3600);
  IF NOT (v_limit->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limited', 'retry_after_seconds', v_limit->'retry_after_seconds');
  END IF;

  INSERT INTO poll_votes (poll_id, session_id, option_index)
  VALUES (p_poll_id, p_session_id, p_option_index)
  ON CONFLICT (poll_id, session_id) DO UPDATE SET option_index = EXCLUDED.option_index;

  RETURN jsonb_build_object('success', true, 'option_index', p_option_index);
END;
$function$;

-- ─── "Is this mine" without a readable session_id column ──────────────────
-- Each takes the caller's claimed session_id as a parameter (same trust
-- model 0041 already established for vote_post/soft_delete_post) and returns
-- only the columns the client actually renders — never session_id itself.

CREATE OR REPLACE FUNCTION public.get_my_post_votes(p_post_ids uuid[], p_session_id uuid)
RETURNS TABLE(post_id uuid, vote_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT post_votes.post_id, post_votes.vote_type
  FROM post_votes
  WHERE post_votes.session_id = p_session_id AND post_votes.post_id = ANY(p_post_ids);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_comment_votes(p_comment_ids uuid[], p_session_id uuid)
RETURNS TABLE(comment_id uuid, vote_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT comment_votes.comment_id, comment_votes.vote_type
  FROM comment_votes
  WHERE comment_votes.session_id = p_session_id AND comment_votes.comment_id = ANY(p_comment_ids);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_poll_votes(p_poll_ids uuid[], p_session_id uuid)
RETURNS TABLE(poll_id uuid, option_index integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT poll_votes.poll_id, poll_votes.option_index
  FROM poll_votes
  WHERE poll_votes.session_id = p_session_id AND poll_votes.poll_id = ANY(p_poll_ids);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_post_flags(p_post_ids uuid[], p_session_id uuid)
RETURNS TABLE(post_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT post_flags.post_id
  FROM post_flags
  WHERE post_flags.session_id = p_session_id AND post_flags.post_id = ANY(p_post_ids);
$function$;

-- "Is this my post/comment" for the edit/delete UI — same shape as the vote
-- and flag lookups above. Locking session_id out of posts/comments' column
-- grants (below) means PostCard.jsx/CommentItem.jsx can no longer compute
-- this themselves by comparing `post.session_id === sessionId`; it has to
-- come from a query already scoped to the caller's own session.

CREATE OR REPLACE FUNCTION public.get_my_post_ids(p_post_ids uuid[], p_session_id uuid)
RETURNS TABLE(post_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT posts.id FROM posts WHERE posts.session_id = p_session_id AND posts.id = ANY(p_post_ids);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_comment_ids(p_comment_ids uuid[], p_session_id uuid)
RETURNS TABLE(comment_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT comments.id FROM comments WHERE comments.session_id = p_session_id AND comments.id = ANY(p_comment_ids);
$function$;

-- Trigger-only functions (mirrors the lockdown pattern 0020/0042/0045 already
-- use): nothing should call these directly over RPC.
REVOKE EXECUTE ON FUNCTION public.check_comment_depth() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_votes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_comment_votes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_post_flag() FROM PUBLIC, anon, authenticated;

-- ─── Lock the tables down to exactly what the RPCs above don't cover ──────
-- Starts from a clean slate on each table (REVOKE ALL) rather than trying to
-- enumerate every privilege Supabase's project-init default grant handed out
-- (it turned out to include DELETE and even TRUNCATE on every one of these,
-- confirmed against the local project — TRUNCATE isn't RLS-aware at all, so
-- that grant was never something a USING/WITH CHECK policy could contain).

REVOKE ALL ON public.posts, public.comments, public.post_votes, public.comment_votes,
  public.poll_votes, public.post_flags, public.polls, public.bot_blacklist, public.messages
  FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, title, content, code, code_language, gif_url, upvotes, downvotes,
  flag_count, is_flagged, is_deleted, is_edited, created_at, updated_at
) ON public.posts TO anon, authenticated;

GRANT SELECT (
  id, post_id, parent_comment_id, content, upvotes, downvotes, is_deleted, depth, created_at
) ON public.comments TO anon, authenticated;

GRANT SELECT (post_id, vote_type) ON public.post_votes TO anon, authenticated;
GRANT SELECT (comment_id, vote_type) ON public.comment_votes TO anon, authenticated;
GRANT SELECT (poll_id, option_index) ON public.poll_votes TO anon, authenticated;
GRANT SELECT ON public.polls TO anon, authenticated;

-- post_flags and bot_blacklist: no remaining public read need (flag_count is
-- already denormalised on posts; "did I flag this" is get_my_post_flags
-- above, "am I blacklisted" is is_session_blacklisted above) — no grant at
-- all, not even SELECT.

-- messages: full SELECT including session_id, deliberately — see header.
-- INSERT only reachable via send_message now; no direct write grant.
GRANT SELECT ON public.messages TO anon, authenticated;

-- Defense in depth even though send_message() already validates: a future
-- caller of the RPC (or a service-role script) can't slip a non-https or
-- javascript:/data: URL into a row that every chat participant's browser
-- will load as an <img src>.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_attachment_url_scheme;
ALTER TABLE public.messages ADD CONSTRAINT messages_attachment_url_scheme
  CHECK (attachment_url IS NULL OR attachment_url LIKE 'https://%');

COMMIT;
