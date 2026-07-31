-- 0052_analytics.sql
--
-- T-086: usage analytics for the admin panel.
--
-- Nothing in the app recorded navigation or tool use before this. The existing
-- counters (api_calls 0003, rate_limits 0035, erd_rate_limits 0051) are all
-- single-purpose quota rows, not reporting.
--
-- SHAPE: daily aggregate counters, not an append-only event log. Row count is
-- bounded by routes x sessions x days rather than growing per navigation, and
-- the tables cannot accumulate a per-person browsing trail — the same privacy
-- posture 0051 took when it chose to store a salted hash instead of the caller
-- IP. Nothing here holds an address, a user agent, or note content.
--
-- WRITE PATH: api/analytics.js with the service role, never the browser.
-- api_calls (0003) shipped with fully open insert/update RLS for want of
-- exactly this and had to be closed in 0048; these tables accept caller-named
-- text keys, so open insert would be strictly worse — a free write-anything
-- store for anyone holding the anon key. Every table below therefore has RLS
-- enabled, no policies, and no anon/authenticated grants.
--
-- The route and tool-event allowlist lives in src/lib/analytics/eventSchema.js
-- and is enforced in api/analytics.js before analytics_record() is called. It is
-- deliberately NOT restated here: one allowlist, in the one module both the
-- browser and the serverless function import, so the two cannot drift.
-- analytics_record() is reachable only by the service role, so the API layer is
-- the only caller there is to validate.
--
-- NOT APPLIED YET to prod. db:migrate is still blocked on the 0024 drift, so
-- apply by hand (psql or the Supabase SQL editor) as 0051 was.

BEGIN;

-- ─── sessions.first_seen ─────────────────────────────────────────────────────
-- sessions (0002) tracks only last_seen, so "new vs returning visitors" was not
-- derivable at all. Backfilled from last_seen rather than now(): for a row that
-- already exists we have no better lower bound on when it first appeared, and
-- stamping now() would report the entire historical population as brand new on
-- the day this migration runs. The DEFAULT is added only after the backfill so
-- existing rows keep the derived value.
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS first_seen timestamptz;
UPDATE public.sessions SET first_seen = last_seen WHERE first_seen IS NULL;
ALTER TABLE public.sessions ALTER COLUMN first_seen SET DEFAULT now();

COMMENT ON COLUMN public.sessions.first_seen IS 'First time this session id was seen. Backfilled from last_seen in 0052 for pre-existing rows, so values at or before that migration are a lower bound, not exact.';

-- ─── page_hits ───────────────────────────────────────────────────────────────
-- One row per (day, route, session). Carrying session_id in the key is what
-- makes "how many people" answerable separately from "how many views"; ranking
-- on raw views alone systematically overrates the tools, which one person
-- reloads repeatedly, against notes, which are read once.
--
-- route_key is canonical, not the literal pathname. Aliases must collapse or a
-- single page's traffic splits across several keys and under-ranks: the
-- tableaux page alone answers to /logic/tableaux, /logic/truth-tree and
-- /logic/semantic-tableaux (src/routes/academiaRoutes.jsx). Redirect sources
-- (/, /notes-browser, /tools/cpa-calculator, /tools/lazy-grades) are recorded
-- under an 'alias:' prefix instead — they are entry points, not pages, and
-- counting them as pages both invents pages that do not exist and inflates
-- whatever they redirect to.
CREATE TABLE IF NOT EXISTS public.page_hits (
  day        date    NOT NULL,
  route_key  text    NOT NULL CHECK (length(route_key) BETWEEN 1 AND 160),
  session_id text    NOT NULL CHECK (length(session_id) BETWEEN 1 AND 64),
  hits       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, route_key, session_id)
);

COMMENT ON TABLE  public.page_hits           IS 'Per-day, per-route, per-session view counter. Written only by analytics_record().';
COMMENT ON COLUMN public.page_hits.route_key IS 'Canonical route key from canonicalRouteKey() in src/lib/analytics/eventSchema.js. Redirect sources carry an alias: prefix and are excluded from page rankings.';
COMMENT ON COLUMN public.page_hits.session_id IS 'Anonymous localStorage session id (matches sessions.id). No FK, same reasoning as api_calls (0003): the two are populated by independent code paths and a hit can land before the session row exists.';

CREATE INDEX IF NOT EXISTS idx_page_hits_day ON public.page_hits (day DESC);

-- ─── note_reads ──────────────────────────────────────────────────────────────
-- Notes are the entire long tail of /notes/:section/*. Keyed by route pattern
-- they would collapse into one meaningless row, so they get their own table
-- keyed by note identity. Separate from page_hits rather than a nullable
-- discriminator column on it, because a PRIMARY KEY column cannot be NULL, and
-- because the FK below then gives free cleanup: deleting a note takes its read
-- counts with it instead of leaving rows keyed on a note nobody can name.
CREATE TABLE IF NOT EXISTS public.note_reads (
  day        date    NOT NULL,
  note_id    uuid    NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  session_id text    NOT NULL CHECK (length(session_id) BETWEEN 1 AND 64),
  hits       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, note_id, session_id)
);

COMMENT ON TABLE public.note_reads IS 'Per-day, per-note, per-session read counter. Joins to notes for title/updated_at so a heavily-read stale note is visible. Written only by analytics_record().';

CREATE INDEX IF NOT EXISTS idx_note_reads_day ON public.note_reads (day DESC);

-- ─── route_transitions ──────────────────────────────────────────────────────
-- "Where do people go from here", which top-pages cannot answer. Deliberately
-- has NO session_id: the aggregate answers the question, and without it these
-- rows cannot be walked back into one person's path through the site.
-- from_route is the '(entry)' sentinel when the visitor arrived from outside,
-- which makes entry points queryable from the same table.
CREATE TABLE IF NOT EXISTS public.route_transitions (
  day        date    NOT NULL,
  from_route text    NOT NULL CHECK (length(from_route) BETWEEN 1 AND 160),
  to_route   text    NOT NULL CHECK (length(to_route) BETWEEN 1 AND 160),
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, from_route, to_route)
);

COMMENT ON TABLE  public.route_transitions            IS 'Per-day navigation edge counts, aggregate only — no session id, so no browsing trail is reconstructable. Written only by analytics_record().';
COMMENT ON COLUMN public.route_transitions.from_route IS 'Canonical source route, or the literal ''(entry)'' when the visitor arrived from outside the app.';

CREATE INDEX IF NOT EXISTS idx_route_transitions_day ON public.route_transitions (day DESC);

-- ─── tool_events ─────────────────────────────────────────────────────────────
-- A pageview cannot tell someone who opened /tree and left from someone who ran
-- thirty inserts, and for a site whose tools are the point that is the question
-- worth answering. event_key 'open' is reserved and emitted on entry to a tool
-- route; every other key means the tool was actually driven. Keeping 'open'
-- here rather than deriving it from page_hits is what lets the reporting
-- function compute opened-vs-used without restating the tool -> route mapping
-- in SQL, where it would drift from eventSchema.js.
CREATE TABLE IF NOT EXISTS public.tool_events (
  day        date    NOT NULL,
  tool_key   text    NOT NULL CHECK (length(tool_key) BETWEEN 1 AND 40),
  event_key  text    NOT NULL CHECK (length(event_key) BETWEEN 1 AND 40),
  session_id text    NOT NULL CHECK (length(session_id) BETWEEN 1 AND 64),
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tool_key, event_key, session_id)
);

COMMENT ON TABLE  public.tool_events           IS 'Per-day, per-tool, per-event, per-session interaction counter. Written only by analytics_record().';
COMMENT ON COLUMN public.tool_events.event_key IS 'Interaction name from the allowlist in src/lib/analytics/eventSchema.js. ''open'' is reserved: it marks arrival, not use.';

CREATE INDEX IF NOT EXISTS idx_tool_events_day ON public.tool_events (day DESC);

-- ─── Lockdown ────────────────────────────────────────────────────────────────
-- RLS on with no policies: only the service key reaches these, same as
-- erd_rate_limits/erd_cache (0051). The dashboard reads through
-- analytics_dashboard() below, not through the REST API.
ALTER TABLE public.page_hits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_reads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_events       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.page_hits         FROM anon, authenticated;
REVOKE ALL ON public.note_reads        FROM anon, authenticated;
REVOKE ALL ON public.route_transitions FROM anon, authenticated;
REVOKE ALL ON public.tool_events       FROM anon, authenticated;

-- ─── analytics_record() ──────────────────────────────────────────────────────
-- Batched increment-upsert. supabase-js .upsert() replaces rather than adds, so
-- an accumulating counter cannot be expressed through the REST API at all; it
-- needs ON CONFLICT DO UPDATE with an expression, hence a function.
--
-- The per-section GROUP BY is not decoration: a batch legitimately contains
-- several entries for the same key (a visitor bouncing between two routes), and
-- ON CONFLICT cannot affect the same row twice in one statement — without
-- pre-aggregation Postgres raises "ON CONFLICT DO UPDATE command cannot affect
-- row a second time" and the whole batch is lost.
--
-- `day` is always current_date on the server. A client-supplied date would let
-- a wrong clock, or a caller, file traffic under any day it liked.
CREATE OR REPLACE FUNCTION public.analytics_record(p_batch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.page_hits AS t (day, route_key, session_id, hits)
  SELECT current_date, e.route_key, e.session_id, sum(least(greatest(coalesce(e.hits, 1), 1), 1000))
  -- jsonb_to_recordset() raises on anything that is not an array, which would
  -- abort the whole batch. Only api/analytics.js can reach this, and it always
  -- sends arrays, but a hard error on malformed input is a poor trade for a
  -- counter: the CASE degrades to "record nothing" instead.
  FROM jsonb_to_recordset(
         CASE WHEN jsonb_typeof(p_batch -> 'pages') = 'array'
              THEN p_batch -> 'pages' ELSE '[]'::jsonb END)
       AS e(route_key text, session_id text, hits integer)
  WHERE e.route_key IS NOT NULL AND e.session_id IS NOT NULL
  GROUP BY e.route_key, e.session_id
  ON CONFLICT (day, route_key, session_id) DO UPDATE
    SET hits = t.hits + excluded.hits;

  -- A note id that no longer resolves is dropped rather than raising: the FK
  -- would abort the entire batch, losing every unrelated event in it, and a
  -- stale id in a queued beacon is expected after a note is deleted.
  INSERT INTO public.note_reads AS t (day, note_id, session_id, hits)
  SELECT current_date, e.note_id, e.session_id, sum(least(greatest(coalesce(e.hits, 1), 1), 1000))
  FROM jsonb_to_recordset(
         CASE WHEN jsonb_typeof(p_batch -> 'notes') = 'array'
              THEN p_batch -> 'notes' ELSE '[]'::jsonb END)
       AS e(note_id uuid, session_id text, hits integer)
  WHERE e.note_id IS NOT NULL
    AND e.session_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.notes n WHERE n.id = e.note_id)
  GROUP BY e.note_id, e.session_id
  ON CONFLICT (day, note_id, session_id) DO UPDATE
    SET hits = t.hits + excluded.hits;

  INSERT INTO public.route_transitions AS t (day, from_route, to_route, count)
  SELECT current_date, e.from_route, e.to_route, sum(least(greatest(coalesce(e.count, 1), 1), 1000))
  FROM jsonb_to_recordset(
         CASE WHEN jsonb_typeof(p_batch -> 'transitions') = 'array'
              THEN p_batch -> 'transitions' ELSE '[]'::jsonb END)
       AS e(from_route text, to_route text, count integer)
  WHERE e.from_route IS NOT NULL AND e.to_route IS NOT NULL
  GROUP BY e.from_route, e.to_route
  ON CONFLICT (day, from_route, to_route) DO UPDATE
    SET count = t.count + excluded.count;

  INSERT INTO public.tool_events AS t (day, tool_key, event_key, session_id, count)
  SELECT current_date, e.tool_key, e.event_key, e.session_id, sum(least(greatest(coalesce(e.count, 1), 1), 1000))
  FROM jsonb_to_recordset(
         CASE WHEN jsonb_typeof(p_batch -> 'tools') = 'array'
              THEN p_batch -> 'tools' ELSE '[]'::jsonb END)
       AS e(tool_key text, event_key text, session_id text, count integer)
  WHERE e.tool_key IS NOT NULL AND e.event_key IS NOT NULL AND e.session_id IS NOT NULL
  GROUP BY e.tool_key, e.event_key, e.session_id
  ON CONFLICT (day, tool_key, event_key, session_id) DO UPDATE
    SET count = t.count + excluded.count;
END;
$$;

-- Service role only. Revoking from PUBLIC alone does not block anon on new
-- functions in this project (the grant gotcha noted against 0048/0051), so anon
-- and authenticated are revoked explicitly.
REVOKE ALL ON FUNCTION public.analytics_record(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_record(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.analytics_record(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_record(jsonb) TO service_role;

-- ─── analytics_rate_limits ───────────────────────────────────────────────────
-- Its own counter rather than reusing erd_rate_limits (0051). Sharing that table
-- would make analytics depend on the ERD feature's schema being applied first,
-- and would put two unrelated features' abuse controls in one place where a
-- change to either moves the other.
--
-- Keyed on a salted hash of the caller IP, never the address, and never a session
-- id: session ids come from the client and can be regenerated per request, so
-- they cannot bound anything.
CREATE TABLE IF NOT EXISTS public.analytics_rate_limits (
  client_key   text PRIMARY KEY,
  call_count   integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.analytics_rate_limits            IS 'Per-caller analytics flush counter, sliding window. Written only by analytics_check_and_increment().';
COMMENT ON COLUMN public.analytics_rate_limits.client_key IS 'SHA-256 of the caller IP plus a server-side salt. Never the raw address.';

ALTER TABLE public.analytics_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_rate_limits FROM anon, authenticated;

-- The check and the increment have to be one statement, or two requests landing
-- together both read the old count and both pass. Same pattern as
-- check_and_increment_rate_limit() in 0037.
CREATE OR REPLACE FUNCTION public.analytics_check_and_increment(
  p_client_key text,
  p_limit      integer,
  p_window     interval
)
RETURNS TABLE (allowed boolean, remaining integer, resets_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_start timestamptz;
BEGIN
  INSERT INTO public.analytics_rate_limits AS r (client_key, call_count, window_start)
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

REVOKE ALL ON FUNCTION public.analytics_check_and_increment(text, integer, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_check_and_increment(text, integer, interval) FROM anon;
REVOKE ALL ON FUNCTION public.analytics_check_and_increment(text, integer, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_check_and_increment(text, integer, interval) TO service_role;

-- ─── analytics_can_view() ────────────────────────────────────────────────────
-- Site-wide usage is an owner/admin concern, matching the gate already on the
-- Manage users button (isOwner || isAdmin, AdminBrowser.jsx). Contributors see
-- their own contribution counts via note_authors (0042) and do not need the
-- whole site's traffic. SECURITY DEFINER so it can read admin_users without the
-- caller needing row access to it — same pattern as is_owner (0017).
CREATE OR REPLACE FUNCTION public.analytics_can_view()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT public.is_primary_owner()
      OR EXISTS (
           SELECT 1 FROM public.admin_users
           WHERE id = auth.uid() AND role IN ('owner', 'admin')
         );
$$;

REVOKE ALL ON FUNCTION public.analytics_can_view() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_can_view() FROM anon;
GRANT EXECUTE ON FUNCTION public.analytics_can_view() TO authenticated;

-- ─── analytics_dashboard() ───────────────────────────────────────────────────
-- One call returning every panel as jsonb, rather than six functions and six
-- round trips: the dashboard is a fixed layout, so a fixed payload fits it, and
-- one query means every panel describes the same instant instead of drifting
-- apart across separate requests.
--
-- Aggregation happens here because the raw tables are unreadable by design —
-- the caller has no grant on them — and because shipping raw per-session rows
-- to a browser to be summed there would both be slower and hand the client a
-- browsing trail this schema went out of its way not to keep.
CREATE OR REPLACE FUNCTION public.analytics_dashboard(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_days  integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from  date;
  v_result jsonb;
BEGIN
  IF NOT public.analytics_can_view() THEN
    RAISE EXCEPTION 'analytics_dashboard: not authorised';
  END IF;

  v_from := current_date - (v_days - 1);

  WITH pages AS (
    SELECT route_key,
           count(DISTINCT session_id) AS sessions,
           sum(hits)                  AS hits
    FROM public.page_hits
    WHERE day >= v_from
      AND route_key NOT LIKE 'alias:%'
    GROUP BY route_key
  ),
  -- Outgoing edges per route, so a dead end (arrivals but nowhere onward) is
  -- visible in the same table as the arrivals themselves.
  onward AS (
    SELECT from_route, sum(count) AS moves
    FROM public.route_transitions
    WHERE day >= v_from AND from_route <> '(entry)'
    GROUP BY from_route
  ),
  tools AS (
    SELECT tool_key,
           count(DISTINCT session_id)                                        AS opened,
           count(DISTINCT session_id) FILTER (WHERE event_key <> 'open')      AS used,
           coalesce(sum(count) FILTER (WHERE event_key <> 'open'), 0)         AS uses
    FROM public.tool_events
    WHERE day >= v_from
    GROUP BY tool_key
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object(
      'days', v_days,
      'from', v_from,
      'to',   current_date
    ),

    'totals', jsonb_build_object(
      'visitors',   (SELECT count(DISTINCT session_id) FROM public.page_hits WHERE day >= v_from),
      'new_visitors', (SELECT count(*) FROM public.sessions WHERE first_seen >= v_from),
      'pageviews',  (SELECT coalesce(sum(hits), 0) FROM public.page_hits WHERE day >= v_from AND route_key NOT LIKE 'alias:%'),
      'note_reads', (SELECT coalesce(sum(hits), 0) FROM public.note_reads WHERE day >= v_from),
      'tool_uses',  (SELECT coalesce(sum(count), 0) FROM public.tool_events WHERE day >= v_from AND event_key <> 'open'),
      'tool_users', (SELECT count(DISTINCT session_id) FROM public.tool_events WHERE day >= v_from AND event_key <> 'open')
    ),

    -- Zero-filled from generate_series so a quiet day reads as a zero rather
    -- than closing the gap and flattering the trend.
    'daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'day', d.day::date,
               'sessions', coalesce(s.sessions, 0),
               'hits', coalesce(s.hits, 0)
             ) ORDER BY d.day), '[]'::jsonb)
      -- Cast to timestamp explicitly rather than passing dates. Bare dates make
      -- the call ambiguous between the timestamp and timestamptz overloads, and
      -- the timestamptz one would then resolve each series entry through the
      -- session's time zone — which can land a row on the wrong calendar day and
      -- silently break the join to page_hits.day below.
      FROM generate_series(v_from::timestamp, current_date::timestamp, interval '1 day') AS d(day)
      LEFT JOIN (
        SELECT day, count(DISTINCT session_id) AS sessions, sum(hits) AS hits
        FROM public.page_hits
        WHERE day >= v_from AND route_key NOT LIKE 'alias:%'
        GROUP BY day
      ) s ON s.day = d.day::date
    ),

    'top_pages', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'route_key', p.route_key,
               'sessions',  p.sessions,
               'hits',      p.hits,
               'onward',    coalesce(o.moves, 0)
             ) ORDER BY p.sessions DESC, p.hits DESC, p.route_key), '[]'::jsonb)
      FROM pages p
      LEFT JOIN onward o ON o.from_route = p.route_key
    ),

    'top_notes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'note_id',    top.id,
               'title',      top.title,
               'module_id',  top.module_id,
               'path',       top.path,
               'sessions',   top.sessions,
               'hits',       top.hits,
               'updated_at', top.updated_at
             ) ORDER BY top.sessions DESC, top.hits DESC, top.title), '[]'::jsonb)
      FROM (
        SELECT n.id, n.title, n.module_id, n.path, n.updated_at,
               count(DISTINCT r.session_id) AS sessions,
               sum(r.hits)                  AS hits
        FROM public.note_reads r
        JOIN public.notes n ON n.id = r.note_id
        WHERE r.day >= v_from
        GROUP BY n.id, n.title, n.module_id, n.path, n.updated_at
        -- Ties broken all the way down to the title. Without a total order the
        -- row order is whatever the plan happens to emit, so a reload reshuffles
        -- tied rows and the ranking reads as broken rather than as a tie.
        ORDER BY count(DISTINCT r.session_id) DESC, sum(r.hits) DESC, n.title
        LIMIT 20
      ) top
    ),

    'tools', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'tool_key', tool_key,
               'opened',   opened,
               'used',     used,
               'uses',     uses
             ) ORDER BY used DESC, opened DESC, tool_key), '[]'::jsonb)
      FROM tools
    ),

    -- Which interaction inside a tool people actually reach for. 'open' is
    -- excluded: it is arrival, not use.
    'tool_breakdown', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'tool_key',  tool_key,
               'event_key', event_key,
               'sessions',  sessions,
               'count',     total
             ) ORDER BY total DESC, tool_key, event_key), '[]'::jsonb)
      FROM (
        SELECT tool_key, event_key,
               count(DISTINCT session_id) AS sessions,
               sum(count)                 AS total
        FROM public.tool_events
        WHERE day >= v_from AND event_key <> 'open'
        GROUP BY tool_key, event_key
        ORDER BY sum(count) DESC, tool_key, event_key
      ) b
    ),

    'entry_points', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'route_key', to_route,
               'count',     total
             ) ORDER BY total DESC, to_route), '[]'::jsonb)
      FROM (
        SELECT to_route, sum(count) AS total
        FROM public.route_transitions
        WHERE day >= v_from AND from_route = '(entry)'
        GROUP BY to_route
        ORDER BY sum(count) DESC, to_route
        LIMIT 10
      ) e
    ),

    'flow', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'from_route', from_route,
               'to_route',   to_route,
               'count',      total
             ) ORDER BY total DESC, from_route, to_route), '[]'::jsonb)
      FROM (
        SELECT from_route, to_route, sum(count) AS total
        FROM public.route_transitions
        WHERE day >= v_from AND from_route <> '(entry)'
        GROUP BY from_route, to_route
        ORDER BY sum(count) DESC, from_route, to_route
        LIMIT 25
      ) f
    ),

    -- Kept alongside the traffic panels because it answers the neighbouring
    -- question ("is anyone writing?") from data that already existed before
    -- this migration, with no instrumentation of its own (0042, 0046).
    'contributors', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'display_name',  p.display_name,
               'avatar_url',    p.avatar_url,
               'notes_touched', c.notes_touched,
               'contributions', c.contributions,
               'last_at',       c.last_at
             ) ORDER BY c.contributions DESC, c.user_id), '[]'::jsonb)
      FROM (
        SELECT user_id,
               count(*)                     AS notes_touched,
               sum(contribution_count)      AS contributions,
               max(last_contributed_at)     AS last_at
        FROM public.note_authors
        GROUP BY user_id
        ORDER BY sum(contribution_count) DESC, user_id
        LIMIT 10
      ) c
      LEFT JOIN public.admin_profiles_public p ON p.id = c.user_id
    ),

    'recent_notes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'note_id',    id,
               'title',      title,
               'module_id',  module_id,
               'path',       path,
               'updated_at', updated_at
             ) ORDER BY updated_at DESC, id), '[]'::jsonb)
      FROM (
        SELECT id, title, module_id, path, updated_at
        FROM public.notes
        ORDER BY updated_at DESC, id
        LIMIT 10
      ) rn
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_dashboard(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_dashboard(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard(integer) TO authenticated;

-- ─── analytics_prune() ───────────────────────────────────────────────────────
-- Retention is a deliberate act, not an assumption: there is no pg_cron in this
-- project, so this exists to be run by hand (or from a future scheduled job)
-- rather than pretending old rows expire on their own.
CREATE OR REPLACE FUNCTION public.analytics_prune(p_keep_days integer DEFAULT 90)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff date := current_date - greatest(coalesce(p_keep_days, 90), 1);
BEGIN
  DELETE FROM public.page_hits         WHERE day < v_cutoff;
  DELETE FROM public.note_reads        WHERE day < v_cutoff;
  DELETE FROM public.route_transitions WHERE day < v_cutoff;
  DELETE FROM public.tool_events       WHERE day < v_cutoff;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_prune(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.analytics_prune(integer) FROM anon;
REVOKE ALL ON FUNCTION public.analytics_prune(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_prune(integer) TO service_role;

COMMIT;
