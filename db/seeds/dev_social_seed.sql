-- dev_social_seed.sql
--
-- LOCAL DEVELOPMENT ONLY. Sample feed + chat content so the social pages,
-- the chat panel and the notes reader are non-empty when reviewing UI work
-- (added while verifying the T-062 light/dark themes).
--
-- Requires db/seeds/dev_social_schema.sql to have been loaded first.
-- Idempotent: every row has a stable id and upserts on re-run.
--
-- Deliberately covers every PostCard variant, because a theme only really
-- gets tested by the widest content:
--   plain text · titled · long body (read-more) · code block · poll · GIF
--   · flagged/edited states · comments with replies and votes
--
-- Load with:
--   docker exec -i supabase_db_b-tree psql -U postgres -d postgres \
--     < db/seeds/dev_social_seed.sql

BEGIN;

-- --- Sessions (avatar seeds; each renders a distinct identicon) --------
INSERT INTO sessions (id, last_seen) VALUES
  ('dev-seed-alice',  now()),
  ('dev-seed-bob',    now()),
  ('dev-seed-carol',  now()),
  ('dev-seed-dave',   now()),
  ('dev-seed-erin',   now())
ON CONFLICT (id) DO UPDATE SET last_seen = EXCLUDED.last_seen;

-- --- Posts ------------------------------------------------------------
INSERT INTO posts (id, session_id, title, content, code, code_language, gif_url,
                   is_edited, created_at, updated_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'dev-seed-alice',
   NULL,
   'Anyone else find B+ trees way easier once you actually watch the splits happen? The visualiser here finally made it click for me.',
   NULL, NULL, NULL, false, now() - interval '4 minutes', NULL),

  ('a0000000-0000-4000-8000-000000000002', 'dev-seed-bob',
   'Master theorem cheat sheet',
   E'Case 1: f(n) = O(n^(log_b(a) - e))  ->  T(n) = Theta(n^log_b(a))\nCase 2: f(n) = Theta(n^log_b(a))     ->  T(n) = Theta(n^log_b(a) * log n)\nCase 3: f(n) = Omega(n^(log_b(a) + e)) and regularity holds  ->  T(n) = Theta(f(n))\n\nCase 3 is the one everyone forgets the regularity condition on.',
   NULL, NULL, NULL, false, now() - interval '22 minutes', NULL),

  -- Long body: exercises the "read more" collapse at 4 lines
  ('a0000000-0000-4000-8000-000000000003', 'dev-seed-carol',
   'How I finally understood recurrence trees',
   E'Started by drawing the tree for T(n) = 2T(n/2) + n by hand.\nLevel 0 costs n. Level 1 costs 2 * (n/2) = n. Level 2 costs 4 * (n/4) = n.\nSo every level costs n, and there are log n levels.\nTotal: n log n. That is the whole trick.\nOnce you see that the per-level cost is constant you stop memorising cases.\nThe substitution view in the recurrence tool shows the same thing numerically.\nHighly recommend stepping through it once with a non-obvious example.',
   NULL, NULL, NULL, true, now() - interval '1 hour 5 minutes', now() - interval '58 minutes'),

  -- Code post: exercises the syntax-highlighted block + language pill
  ('a0000000-0000-4000-8000-000000000004', 'dev-seed-dave',
   'Iterative binary search, no off-by-one',
   'Using lo < hi with hi = mid avoids the classic infinite loop.',
   E'function search(arr, target) {\n  let lo = 0\n  let hi = arr.length\n  while (lo < hi) {\n    const mid = (lo + hi) >> 1\n    if (arr[mid] < target) lo = mid + 1\n    else hi = mid\n  }\n  return arr[lo] === target ? lo : -1\n}',
   'javascript', NULL, false, now() - interval '2 hours 10 minutes', NULL),

  ('a0000000-0000-4000-8000-000000000005', 'dev-seed-erin',
   NULL,
   E'SELECT s.name, COUNT(e.id) AS enrolments\nFROM students s\nLEFT JOIN enrolments e ON e.student_id = s.id\nGROUP BY s.name\nHAVING COUNT(e.id) > 3\nORDER BY enrolments DESC;',
   E'SELECT s.name, COUNT(e.id) AS enrolments\nFROM students s\nLEFT JOIN enrolments e ON e.student_id = s.id\nGROUP BY s.name\nHAVING COUNT(e.id) > 3\nORDER BY enrolments DESC;',
   'sql', NULL, false, now() - interval '5 hours', NULL),

  -- Poll post
  ('a0000000-0000-4000-8000-000000000006', 'dev-seed-alice',
   'Which visualiser should get mobile support first?',
   'Curious what people actually use on their phones.',
   NULL, NULL, NULL, false, now() - interval '8 hours', NULL),

  -- Binary (Yes/No) poll
  ('a0000000-0000-4000-8000-000000000007', 'dev-seed-bob',
   NULL,
   'Should the feed default to newest-first?',
   NULL, NULL, NULL, false, now() - interval '1 day 2 hours', NULL),

  -- GIF post: exercises the media embed path
  ('a0000000-0000-4000-8000-000000000008', 'dev-seed-carol',
   NULL,
   'me after finally getting the ERD parser to accept my schema',
   NULL, NULL,
   'https://media.tenor.com/qUZfKrLPQ_kAAAAC/cat-typing.gif',
   false, now() - interval '1 day 6 hours', NULL),

  ('a0000000-0000-4000-8000-000000000009', 'dev-seed-dave',
   'Reminder: the notes are open source',
   'If you spot a mistake in a note you can just say so here and it gets fixed. No need to sit on it.',
   NULL, NULL, NULL, false, now() - interval '2 days', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, content = EXCLUDED.content, code = EXCLUDED.code,
  code_language = EXCLUDED.code_language, gif_url = EXCLUDED.gif_url,
  is_edited = EXCLUDED.is_edited, created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

-- --- Polls ------------------------------------------------------------
INSERT INTO polls (id, post_id, options) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006',
   '["B+ Tree", "ERD", "Recurrence", "Complexity"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007',
   '["Yes", "No"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET options = EXCLUDED.options;

INSERT INTO poll_votes (id, poll_id, session_id, option_index) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'dev-seed-bob',   0),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'dev-seed-carol', 0),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'dev-seed-dave',  2),
  ('b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'dev-seed-erin',  1),
  ('b1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'dev-seed-alice', 0),
  ('b1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'dev-seed-carol', 0),
  ('b1000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'dev-seed-dave',  1)
ON CONFLICT (id) DO NOTHING;

-- --- Votes (varied counts so the score column isn't uniform) ----------
INSERT INTO post_votes (id, post_id, session_id, vote_type) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'dev-seed-bob',   'up'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'dev-seed-carol', 'up'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'dev-seed-dave',  'up'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'dev-seed-alice', 'up'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'dev-seed-carol', 'up'),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002', 'dev-seed-dave',  'up'),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'dev-seed-erin',  'up'),
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003', 'dev-seed-alice', 'up'),
  ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000003', 'dev-seed-bob',   'down'),
  ('c0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000004', 'dev-seed-alice', 'up'),
  ('c0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000004', 'dev-seed-carol', 'up'),
  ('c0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000004', 'dev-seed-erin',  'up'),
  ('c0000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000005', 'dev-seed-bob',   'up'),
  ('c0000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-000000000008', 'dev-seed-alice', 'up'),
  ('c0000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-000000000008', 'dev-seed-bob',   'up'),
  ('c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000008', 'dev-seed-dave',  'up'),
  ('c0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000008', 'dev-seed-erin',  'up'),
  ('c0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000009', 'dev-seed-carol', 'up')
ON CONFLICT (id) DO NOTHING;

-- --- Comments (top level + one level of replies) ----------------------
INSERT INTO comments (id, post_id, parent_comment_id, session_id, content, depth, created_at) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', NULL,
   'dev-seed-bob', 'Same. Watching a node split beats reading the invariant ten times.', 0,
   now() - interval '3 minutes'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001',
   'dev-seed-alice', 'The step controls are what did it for me — being able to go back a step.', 1,
   now() - interval '2 minutes'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', NULL,
   'dev-seed-erin', 'Try inserting a sorted sequence, the splits get very regular.', 0,
   now() - interval '1 minute'),

  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', NULL,
   'dev-seed-carol', 'Worth adding that case 3 needs a*f(n/b) <= c*f(n) for some c < 1.', 0,
   now() - interval '18 minutes'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'd0000000-0000-4000-8000-000000000004',
   'dev-seed-bob', 'Good catch, that is exactly the regularity bit I meant.', 1,
   now() - interval '15 minutes'),

  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000004', NULL,
   'dev-seed-erin', 'The >> 1 instead of /2 also avoids the overflow version of this bug.', 0,
   now() - interval '2 hours'),

  ('d0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003', NULL,
   'dev-seed-dave', 'Saving this. The per-level cost framing is much better than memorising.', 0,
   now() - interval '50 minutes')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO comment_votes (id, comment_id, session_id, vote_type) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'dev-seed-alice', 'up'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'dev-seed-carol', 'up'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 'dev-seed-alice', 'up'),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'dev-seed-bob',   'up'),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'dev-seed-dave',  'up'),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'dev-seed-dave',  'up')
ON CONFLICT (id) DO NOTHING;

-- --- Chat messages ----------------------------------------------------
-- Mixed lengths and senders so both bubble colours (own vs other), the
-- scroll fade mask and the long-message wrap all get exercised.
INSERT INTO messages (id, session_id, content, created_at) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'dev-seed-alice', 'morning', now() - interval '40 minutes'),
  ('f0000000-0000-4000-8000-000000000002', 'dev-seed-bob',   'morning! did the light theme land yet?', now() - interval '39 minutes'),
  ('f0000000-0000-4000-8000-000000000003', 'dev-seed-alice', 'yeah just pushed it, avatar menu bottom left', now() - interval '38 minutes'),
  ('f0000000-0000-4000-8000-000000000004', 'dev-seed-carol', 'oh nice, there are 9 themes in there', now() - interval '36 minutes'),
  ('f0000000-0000-4000-8000-000000000005', 'dev-seed-carol', 'supabase green is very good', now() - interval '35 minutes'),
  ('f0000000-0000-4000-8000-000000000006', 'dev-seed-bob',   'the custom colour wheel is the fun part, you can put in any hex and it derives the whole tonal set', now() - interval '33 minutes'),
  ('f0000000-0000-4000-8000-000000000007', 'dev-seed-dave',  'does it remember the choice?', now() - interval '30 minutes'),
  ('f0000000-0000-4000-8000-000000000008', 'dev-seed-alice', 'localStorage, so per browser. survives a refresh', now() - interval '29 minutes'),
  ('f0000000-0000-4000-8000-000000000009', 'dev-seed-erin',  'checking the notes reader in light mode now', now() - interval '20 minutes'),
  ('f0000000-0000-4000-8000-00000000000a', 'dev-seed-erin',  'body text is readable, that was the thing that was broken before', now() - interval '19 minutes'),
  ('f0000000-0000-4000-8000-00000000000b', 'dev-seed-dave',  'dynamic island still black in light mode which is what we wanted', now() - interval '12 minutes'),
  ('f0000000-0000-4000-8000-00000000000c', 'dev-seed-bob',   'and it drops the glow, looks much cleaner on white', now() - interval '10 minutes'),
  ('f0000000-0000-4000-8000-00000000000d', 'dev-seed-carol', 'ship it', now() - interval '4 minutes')
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, created_at = EXCLUDED.created_at;

COMMIT;
