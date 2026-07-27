-- 0038_social_realtime.sql
--
-- T-067: supersedes the 0-byte `0015_social_realtime.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- Deployed publication membership for `supabase_realtime`: posts, post_votes,
-- comments, comment_votes, poll_votes. `post_flags` is deliberately absent;
-- nothing subscribes to it.
--
-- Every one of these tables is at the DEFAULT replica identity (primary key),
-- which is what src/hooks/usePosts.js has to work around: for UPDATE and
-- DELETE, `payload.old` carries only the PK, so the previous vote_type is not
-- available and a DELETE does not even carry post_id. See T-064 for the
-- handler and its known gap. Widening to REPLICA IDENTITY FULL would close it
-- at the cost of WAL volume on every write, and is deliberately NOT done here.
--
-- NOTE for local development: db/seeds/dev_social_schema.sql publishes only
-- `posts`. A local database built from that seed will silently receive no
-- post_votes or comments events at all, so the realtime handlers look correct
-- while never running. This migration is the correct source for that.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts', 'post_votes', 'comments', 'comment_votes', 'poll_votes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
