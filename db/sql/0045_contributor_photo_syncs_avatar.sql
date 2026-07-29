-- 0045_contributor_photo_syncs_avatar.sql
-- T-072 follow-up: a contributor-card photo doubles as the admin's profile
-- picture (admin_users.avatar_url) — the same photo that shows on the public
-- "Meet the Team" card also shows next to their name on notes they've
-- contributed to (T-071's author avatars) and in the admin panel's own
-- avatar dropdowns, without them having to upload the same photo twice.
--
-- One-directional only: setting your contributor-card photo updates your
-- profile picture too, but setting your profile picture via Settings does
-- NOT touch your contributor card — a card's photo is meant for public
-- display and its absence/removal is a deliberate choice (see the "create
-- your card" empty state), so nothing here should push a photo onto a card
-- that doesn't exist or silently change one someone chose to keep separate.
--
-- Implemented as a trigger rather than app-code (contributorCardsApi.js /
-- AdminSettingsPage.jsx), matching this project's own precedent (0039/0040
-- exist specifically because a sync living only in app code missed a path)
-- — this way the invariant holds no matter how contributor_cards.photo_url
-- gets written: the Settings page today, a future admin tool, or a one-off
-- script like scripts/migrate-team-to-contributor-cards.mjs tomorrow.

-- contributor_cards' self-row RLS lets a caller write their OWN row, but
-- writing admin_users needs elevated privilege — regular authenticated users
-- have no grant on it at all outside admin_update_own_profile (0043). SECURITY
-- DEFINER is what bridges that, same as notes_track_author (0042) bridging
-- notes_authors' own RLS.
create or replace function public.contributor_cards_sync_avatar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- tg_op = 'INSERT' has no `old` to compare against — referencing OLD in an
  -- INSERT-trigger invocation is a parse-time error, not just wrong at
  -- runtime, so this has to branch on tg_op rather than a single
  -- `new.photo_url is distinct from old.photo_url` guard.
  if new.photo_url is not null
     and (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url) then
    update public.admin_users set avatar_url = new.photo_url where id = new.admin_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists contributor_cards_sync_avatar_trg on public.contributor_cards;
create trigger contributor_cards_sync_avatar_trg
  after insert or update on public.contributor_cards
  for each row execute function public.contributor_cards_sync_avatar();

-- Same lockdown 0042/0043 apply to their own trigger functions: this has no
-- business being reachable as a PostgREST RPC, and PUBLIC alone doesn't
-- cover it on this project (see 0043's admin_update_own_profile comment —
-- default privileges grant EXECUTE on new public-schema functions directly
-- to anon/authenticated, not by inheriting PUBLIC).
revoke execute on function public.contributor_cards_sync_avatar() from public, anon, authenticated;

-- ─── Backfill ─────────────────────────────────────────────────────────────
-- The trigger only fires on a future insert/update; the rows T-072's seed
-- script already wrote predate this migration, so they need the same sync
-- applied directly, once. `avatar_url is null` guard means this only ever
-- fills a gap — it can't clobber a profile picture someone has since set
-- deliberately through Settings' own "Profile photo" section.
update public.admin_users au
   set avatar_url = cc.photo_url
  from public.contributor_cards cc
 where au.id = cc.admin_user_id
   and cc.photo_url is not null
   and au.avatar_url is null;
