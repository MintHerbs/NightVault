-- 0035_init_rate_limits.sql
--
-- T-067: supersedes the 0-byte `0012_init_rate_limits.sql`.
-- Transcribed from the deployed project on 2026-07-27.
--
-- One row per session, four independent sliding windows. The counters are
-- only ever moved by check_and_increment_rate_limit() (0037), which is
-- SECURITY DEFINER and so bypasses the SELECT-only RLS in 0036.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  session_id           uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  post_count           integer NOT NULL DEFAULT 0,
  post_window_start    timestamptz NOT NULL DEFAULT now(),
  chat_count           integer NOT NULL DEFAULT 0,
  chat_window_start    timestamptz NOT NULL DEFAULT now(),
  comment_count        integer NOT NULL DEFAULT 0,
  comment_window_start timestamptz NOT NULL DEFAULT now(),
  vote_count           integer NOT NULL DEFAULT 0,
  vote_window_start    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_blacklist (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  flagged_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
