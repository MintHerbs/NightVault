-- 0028_reconcile_session_id_types.sql
--
-- T-067 prerequisite.
--
-- `0002_init_sessions.sql` declares `sessions.id` as TEXT, with a comment
-- justifying the choice ("to match messages.session_id and avoid an implicit
-- cast on join"). The deployed project has it as `uuid`, and
-- `messages.session_id` as `uuid` too. Verified 2026-07-27 against the live
-- project, so the drift is not limited to the empty 0006-0015 stubs: it
-- reaches into migrations that do have content.
--
-- This matters here because every social table's `session_id` is a `uuid` FK
-- to `sessions(id)`. On a database built from 0001-0002 as written, those FKs
-- cannot be created at all, since Postgres will not reference a text column
-- from a uuid one. The social migrations that follow are unusable until this
-- is reconciled.
--
-- Guarded on the current type, so this is a true no-op against the deployed
-- project (already uuid) and a one-time correction on a fresh local database
-- (tables empty, so the cast cannot fail on data).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'sessions'
       AND column_name  = 'id'
       AND data_type   <> 'uuid'
  ) THEN
    -- `messages` has no FK to `sessions` in 0001, but drop defensively in
    -- case an environment grew one, then convert both sides together.
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_session_id_fkey;

    ALTER TABLE public.sessions
      ALTER COLUMN id TYPE uuid USING id::uuid;

    ALTER TABLE public.messages
      ALTER COLUMN session_id TYPE uuid USING session_id::uuid;
  END IF;
END $$;

COMMIT;
