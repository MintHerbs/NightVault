-- 0037_social_rpcs.sql
--
-- T-067: supersedes the 0-byte `0014_social_rpcs.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- Bodies are reproduced verbatim. Two things about set_session_id() are worth
-- knowing and are NOT corrected here (see T-069):
--   * set_config(..., true) is transaction-local, and PostgREST gives each
--     HTTP request its own transaction, so withSession() in
--     src/lib/supabaseClient.js cannot carry the value into the next request.
--     Every RLS predicate that reads app.session_id is therefore always false.
--   * All five are SECURITY DEFINER and executable by anon (advisor lints
--     0028/0029). soft_delete_post and soft_delete_comment take the caller's
--     claimed session_id as a parameter, so they are the ownership check;
--     they are safe only because they filter on it internally.
--
-- None of these set search_path, which the advisor flags as
-- 0011_function_search_path_mutable. Left as deployed.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_session_id(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM set_config('app.session_id', p_session_id::text, true); -- true = local to transaction
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_session_id uuid,
  p_action text,
  p_max_count integer,
  p_window_secs integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count         int;
  v_window_start  timestamptz;
  v_now           timestamptz := now();
  v_allowed       boolean;
  v_retry_after   int;
  v_count_col     text;
  v_window_col    text;
BEGIN
  -- Map action to column names
  CASE p_action
    WHEN 'post'    THEN v_count_col := 'post_count';    v_window_col := 'post_window_start';
    WHEN 'comment' THEN v_count_col := 'comment_count'; v_window_col := 'comment_window_start';
    WHEN 'chat'    THEN v_count_col := 'chat_count';    v_window_col := 'chat_window_start';
    WHEN 'vote'    THEN v_count_col := 'vote_count';    v_window_col := 'vote_window_start';
    ELSE RAISE EXCEPTION 'Unknown action: %', p_action;
  END CASE;

  -- Upsert the row (create if first action for this session)
  INSERT INTO rate_limits (session_id)
  VALUES (p_session_id)
  ON CONFLICT (session_id) DO NOTHING;

  -- Read current count + window start
  EXECUTE format(
    'SELECT %I, %I FROM rate_limits WHERE session_id = $1',
    v_count_col, v_window_col
  ) INTO v_count, v_window_start USING p_session_id;

  -- Reset window if expired
  IF v_now >= v_window_start + (p_window_secs || ' seconds')::interval THEN
    v_count        := 0;
    v_window_start := v_now;
  END IF;

  v_allowed := v_count < p_max_count;

  IF v_allowed THEN
    -- Increment atomically
    EXECUTE format(
      'UPDATE rate_limits SET %I = $1, %I = $2 WHERE session_id = $3',
      v_count_col, v_window_col
    ) USING v_count + 1, v_window_start, p_session_id;
  END IF;

  -- Seconds until window resets (for countdown UI)
  v_retry_after := GREATEST(0,
    EXTRACT(EPOCH FROM (v_window_start + (p_window_secs || ' seconds')::interval - v_now))::int
  );

  RETURN jsonb_build_object(
    'allowed',             v_allowed,
    'count',               v_count,
    'limit',               p_max_count,
    'retry_after_seconds', CASE WHEN v_allowed THEN 0 ELSE v_retry_after END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_bot_blacklist(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_reason text;
  v_recent_post_count int;
  v_duplicate_count   int;
BEGIN
  -- 1. Already blacklisted?
  SELECT reason INTO v_reason
  FROM bot_blacklist
  WHERE session_id = p_session_id;

  IF FOUND THEN
    RETURN jsonb_build_object('is_blacklisted', true, 'reason', v_reason);
  END IF;

  -- 2. More than 5 posts in the last 2 minutes?
  SELECT COUNT(*) INTO v_recent_post_count
  FROM posts
  WHERE session_id = p_session_id
    AND created_at >= now() - interval '2 minutes'
    AND is_deleted = false;

  IF v_recent_post_count >= 5 THEN
    INSERT INTO bot_blacklist (session_id, reason)
    VALUES (p_session_id, 'More than 5 posts in 2 minutes')
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('is_blacklisted', true, 'reason', 'Rate abuse detected');
  END IF;

  -- 3. More than 3 identical posts?
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT content
    FROM posts
    WHERE session_id = p_session_id
      AND is_deleted = false
    GROUP BY content
    HAVING COUNT(*) >= 3
  ) dupes;

  IF v_duplicate_count > 0 THEN
    INSERT INTO bot_blacklist (session_id, reason)
    VALUES (p_session_id, 'Duplicate post spam')
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('is_blacklisted', true, 'reason', 'Duplicate content detected');
  END IF;

  RETURN jsonb_build_object('is_blacklisted', false, 'reason', null);
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_rows int;
BEGIN
  UPDATE posts
  SET is_deleted = true, updated_at = now()
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

CREATE OR REPLACE FUNCTION public.soft_delete_comment(p_comment_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_rows int;
BEGIN
  UPDATE comments
  SET is_deleted = true
  WHERE id = p_comment_id
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
