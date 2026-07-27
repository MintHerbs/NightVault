-- 0034_init_polls.sql
--
-- T-067: supersedes the 0-byte `0011_init_polls.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- `polls.post_id` is UNIQUE, so a post carries at most one poll. That is what
-- lets loadFeedExtras() in src/hooks/usePosts.js key pollsByPostId directly.

BEGIN;

CREATE TABLE IF NOT EXISTS public.polls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  options    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT polls_post_id_key UNIQUE (post_id)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT poll_votes_poll_id_session_id_key UNIQUE (poll_id, session_id)
);

COMMIT;
