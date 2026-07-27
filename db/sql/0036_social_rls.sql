-- 0036_social_rls.sql
--
-- T-067: supersedes the 0-byte `0013_social_rls.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- READ THIS BEFORE COPYING ANY OF IT AS A PATTERN. These are the policies
-- that are live, not the policies that should be live. Three known problems
-- are reproduced here deliberately so this file stays a faithful record:
--
--  1. No UPDATE policy on post_votes or comment_votes. The client switches a
--     vote with INSERT ... ON CONFLICT DO UPDATE, and Postgres checks the
--     UPDATE policy for the conflicting row, so switching a vote cannot
--     succeed under RLS.
--  2. No DELETE policy on post_flags, so unflagging matches zero rows and
--     fails silently (a DELETE filtered by RLS is not an error).
--  3. Every `session_id::text = current_setting('app.session_id', true)`
--     predicate is effectively always false. set_session_id() (0037) uses
--     set_config(..., true), which is transaction-local, and PostgREST runs
--     each HTTP request in its own transaction, so the GUC is gone by the
--     time the next request arrives.
--
-- flagged_posts_review has RLS DISABLED in production (advisor lint
-- 0013_rls_disabled_in_public). Not enabling it here, because doing so would
-- change production behaviour rather than record it.
--
-- All of the above is filed as T-069.

BEGIN;

ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_blacklist ENABLE ROW LEVEL SECURITY;

-- posts
DROP POLICY IF EXISTS read_posts ON public.posts;
CREATE POLICY read_posts ON public.posts
  FOR SELECT TO public USING (is_deleted = false AND is_flagged = false);

DROP POLICY IF EXISTS insert_posts ON public.posts;
CREATE POLICY insert_posts ON public.posts
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS update_own_posts ON public.posts;
CREATE POLICY update_own_posts ON public.posts
  FOR UPDATE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true))
  WITH CHECK (session_id::text = current_setting('app.session_id'::text, true));

DROP POLICY IF EXISTS delete_own_posts ON public.posts;
CREATE POLICY delete_own_posts ON public.posts
  FOR DELETE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true));

-- post_votes
DROP POLICY IF EXISTS read_votes ON public.post_votes;
CREATE POLICY read_votes ON public.post_votes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_votes ON public.post_votes;
CREATE POLICY insert_votes ON public.post_votes
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS delete_own_votes ON public.post_votes;
CREATE POLICY delete_own_votes ON public.post_votes
  FOR DELETE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true));

-- post_flags
DROP POLICY IF EXISTS read_flags ON public.post_flags;
CREATE POLICY read_flags ON public.post_flags
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_flags ON public.post_flags;
CREATE POLICY insert_flags ON public.post_flags
  FOR INSERT TO public WITH CHECK (true);

-- comments
DROP POLICY IF EXISTS read_comments ON public.comments;
CREATE POLICY read_comments ON public.comments
  FOR SELECT TO public USING (is_deleted = false);

DROP POLICY IF EXISTS insert_comments ON public.comments;
CREATE POLICY insert_comments ON public.comments
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS update_own_comments ON public.comments;
CREATE POLICY update_own_comments ON public.comments
  FOR UPDATE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true))
  WITH CHECK (session_id::text = current_setting('app.session_id'::text, true));

DROP POLICY IF EXISTS delete_own_comments ON public.comments;
CREATE POLICY delete_own_comments ON public.comments
  FOR DELETE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true));

-- comment_votes
DROP POLICY IF EXISTS read_comment_votes ON public.comment_votes;
CREATE POLICY read_comment_votes ON public.comment_votes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_comment_votes ON public.comment_votes;
CREATE POLICY insert_comment_votes ON public.comment_votes
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS delete_comment_votes ON public.comment_votes;
CREATE POLICY delete_comment_votes ON public.comment_votes
  FOR DELETE TO public
  USING (session_id::text = current_setting('app.session_id'::text, true));

-- polls
DROP POLICY IF EXISTS read_polls ON public.polls;
CREATE POLICY read_polls ON public.polls
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_polls ON public.polls;
CREATE POLICY insert_polls ON public.polls
  FOR INSERT TO public WITH CHECK (true);

-- poll_votes
DROP POLICY IF EXISTS read_poll_votes ON public.poll_votes;
CREATE POLICY read_poll_votes ON public.poll_votes
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_poll_votes ON public.poll_votes;
CREATE POLICY insert_poll_votes ON public.poll_votes
  FOR INSERT TO public WITH CHECK (true);

-- rate_limits
DROP POLICY IF EXISTS rate_limits_select_own ON public.rate_limits;
CREATE POLICY rate_limits_select_own ON public.rate_limits
  FOR SELECT TO public
  USING (session_id::text = current_setting('app.session_id'::text, true));

-- bot_blacklist
DROP POLICY IF EXISTS read_blacklist ON public.bot_blacklist;
CREATE POLICY read_blacklist ON public.bot_blacklist
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS insert_blacklist ON public.bot_blacklist;
CREATE POLICY insert_blacklist ON public.bot_blacklist
  FOR INSERT TO public WITH CHECK (true);

COMMIT;
