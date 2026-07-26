-- dev_social_schema.sql
--
-- LOCAL DEVELOPMENT ONLY. NOT A MIGRATION. NOT AUTHORITATIVE.
--
-- Why this file exists
-- -------------------
-- The social feature's migrations (db/sql/0006_init_posts.sql through
-- 0015_social_realtime.sql) are all **0 bytes** in this repo, yet they are
-- recorded as applied in `schema_migrations` with hash
-- e3b0c44298fc1c14 — the SHA of an empty string. In other words the social
-- schema was created directly against the remote project and never
-- captured as SQL, so a fresh `supabase start` gives you a database with
-- no posts/comments/polls tables at all and the social pages render empty.
--
-- This file is a best-effort reconstruction of *just enough* schema to run
-- and look at the social UI locally. It was derived by reading the app's
-- own queries, not from the real database:
--   src/hooks/usePosts.js, src/hooks/useComments.js,
--   src/hooks/useRateLimit.js, src/components/social/PostCard/PostCard.jsx
--
-- Consequences you must know before using it:
--   * Column types, defaults, constraints and indexes are guesses that
--     satisfy the client code — they will differ from production.
--   * The RLS policies here are permissive stubs for local anon access.
--     They are NOT the production policies. Never copy this file into
--     db/sql/ or apply it to a remote project.
--   * Capturing the real schema (via `supabase db dump` against the remote
--     project, backfilled into 0006–0015) is its own task and should be
--     tracked separately.
--
-- Load with:
--   docker exec -i supabase_db_b-tree psql -U postgres -d postgres \
--     < db/seeds/dev_social_schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS posts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title         text,
  content       text,
  code          text,
  code_language text,
  gif_url       text,
  is_deleted    boolean NOT NULL DEFAULT false,
  is_flagged    boolean NOT NULL DEFAULT false,
  is_edited     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_votes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  vote_type  text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, session_id)
);

CREATE TABLE IF NOT EXISTS post_flags (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, session_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id           uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  session_id        text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  content           text NOT NULL,
  -- The client only ever allows depth 0 or 1 (one level of replies).
  depth             integer NOT NULL DEFAULT 0 CHECK (depth IN (0, 1)),
  is_deleted        boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS comment_votes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  vote_type  text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, session_id)
);

CREATE TABLE IF NOT EXISTS polls (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    uuid NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  -- PollBuilder emits either ['Yes','No'] or up to 4 free-text options.
  options    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id      uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  session_id   text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, session_id)
);

CREATE TABLE IF NOT EXISTS bot_blacklist (
  session_id text PRIMARY KEY,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   text NOT NULL,
  action       text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0,
  UNIQUE (session_id, action)
);

-- --- RPCs the client calls -------------------------------------------

CREATE OR REPLACE FUNCTION check_bot_blacklist(p_session_id text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'is_blacklisted',
    EXISTS (SELECT 1 FROM bot_blacklist WHERE session_id = p_session_id)
  );
$$;

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_session_id text, p_action text, p_max_count integer, p_window_secs integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r rate_limits;
BEGIN
  SELECT * INTO r FROM rate_limits
   WHERE session_id = p_session_id AND action = p_action FOR UPDATE;

  IF r.id IS NULL THEN
    INSERT INTO rate_limits (session_id, action, count) VALUES (p_session_id, p_action, 1);
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_count - 1);
  END IF;

  IF r.window_start < now() - make_interval(secs => p_window_secs) THEN
    UPDATE rate_limits SET window_start = now(), count = 1 WHERE id = r.id;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_count - 1);
  END IF;

  IF r.count >= p_max_count THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0);
  END IF;

  UPDATE rate_limits SET count = r.count + 1 WHERE id = r.id;
  RETURN jsonb_build_object('allowed', true, 'remaining', p_max_count - r.count - 1);
END;
$$;

CREATE OR REPLACE FUNCTION soft_delete_post(p_post_id uuid, p_session_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE posts SET is_deleted = true
   WHERE id = p_post_id AND session_id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION soft_delete_comment(p_comment_id uuid, p_session_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE comments SET is_deleted = true
   WHERE id = p_comment_id AND session_id = p_session_id;
$$;

-- --- Local-only permissive access ------------------------------------
-- Stubs so the anon key can read/write while developing. These are NOT
-- the production policies; see the header.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','post_votes','post_flags','comments',
                           'comment_votes','polls','poll_votes',
                           'bot_blacklist','rate_limits']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS dev_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY dev_all ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT ALL ON %I TO anon, authenticated', t);
  END LOOP;
END $$;

-- --- Realtime ---------------------------------------------------------
-- usePosts.js subscribes to INSERT/UPDATE/DELETE on `posts`, so the table
-- has to be in the realtime publication or the feed never updates live.
-- REPLICA IDENTITY FULL is required for DELETE payloads to carry the old
-- row (otherwise the client can't tell which post was removed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
  END IF;
END $$;
ALTER TABLE posts REPLICA IDENTITY FULL;

COMMIT;
