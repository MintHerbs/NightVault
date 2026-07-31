-- 0051_erd_generation_quota.sql
--
-- Spam/quota protection for the server-side ERD generator (api/gemini.js).
--
-- The Gemini free tier is a small, shared, daily-replenished budget. One student
-- holding down enter can drain it for everyone, so the endpoint needs a counter
-- that survives across serverless invocations.
--
-- Keyed on a hash of the caller's IP rather than a session id: session ids come
-- from the client and can be regenerated per request, so they cannot bound
-- anything. The hash is stored instead of the address so the table holds no
-- directly identifying data.
--
-- Counting and the limit test have to happen in one statement, or two requests
-- landing together both read the old count and both pass. That is what the
-- SECURITY DEFINER function below is for — same pattern as
-- check_and_increment_rate_limit() in 0037.
--
-- NOT APPLIED YET. db:migrate is blocked on the 0024 drift, so apply this by
-- hand (psql or the Supabase SQL editor) until the runner is unblocked.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erd_rate_limits (
  client_key   text PRIMARY KEY,
  call_count   integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.erd_rate_limits            IS 'Per-caller ERD generation counter, sliding window. Written only by erd_check_and_increment().';
COMMENT ON COLUMN public.erd_rate_limits.client_key IS 'SHA-256 of the caller IP plus a server-side salt. Never the raw address.';

-- Identical scenarios are common: a cohort works the same past paper, and people
-- retry. Serving those from here costs no quota at all.
CREATE TABLE IF NOT EXISTS public.erd_cache (
  cache_key     text PRIMARY KEY,
  response_text text NOT NULL,
  model         text NOT NULL,
  hit_count     integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.erd_cache           IS 'Generated ERD JSON keyed by normalised scenario text, so repeats cost no API call.';
COMMENT ON COLUMN public.erd_cache.cache_key IS 'SHA-256 of scenarioCacheKey() output from src/lib/erdScenarioGuard.js.';

-- Neither table is ever read by the browser; only the service key touches them.
ALTER TABLE public.erd_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erd_cache       ENABLE ROW LEVEL SECURITY;

-- Atomically roll the window if it has expired, increment, and report whether
-- the caller is still inside their allowance.
CREATE OR REPLACE FUNCTION public.erd_check_and_increment(
  p_client_key text,
  p_limit      integer,
  p_window     interval
)
RETURNS TABLE (allowed boolean, remaining integer, resets_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
BEGIN
  INSERT INTO public.erd_rate_limits AS r (client_key, call_count, window_start)
  VALUES (p_client_key, 1, now())
  ON CONFLICT (client_key) DO UPDATE
    SET call_count = CASE
          WHEN now() - r.window_start >= p_window THEN 1
          ELSE r.call_count + 1
        END,
        window_start = CASE
          WHEN now() - r.window_start >= p_window THEN now()
          ELSE r.window_start
        END
  RETURNING r.call_count, r.window_start INTO v_count, v_start;

  RETURN QUERY SELECT
    v_count <= p_limit,
    GREATEST(p_limit - v_count, 0),
    v_start + p_window;
END;
$$;

-- Callable only by the service role. anon must not be able to move the counter,
-- and revoking from PUBLIC alone does not achieve that here (see the grant
-- gotcha noted against 0048).
REVOKE ALL ON FUNCTION public.erd_check_and_increment(text, integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erd_check_and_increment(text, integer, interval) FROM anon;
REVOKE ALL ON FUNCTION public.erd_check_and_increment(text, integer, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.erd_check_and_increment(text, integer, interval) TO service_role;

COMMIT;
