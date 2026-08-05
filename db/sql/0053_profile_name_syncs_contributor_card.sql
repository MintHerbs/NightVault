-- 0053_profile_name_syncs_contributor_card.sql
-- T-106. Companion to 0045, which syncs the other direction and the other
-- column.
--
-- Settings' "Display name" writes admin_users.display_name through
-- admin_update_own_profile (0043). The public "Meet the Team" roster renders
-- contributor_cards.name: AboutPage.jsx maps row.name straight onto the card
-- and never reads admin_users at all. Nothing connected the two, so renaming
-- yourself in Settings left /about showing the old name indefinitely.
--
-- This was a gap, not a decision. T-072 specified the card's name field as
-- "defaults to display_name", and AdminSettingsPage.jsx implements exactly
-- that: a seed for a card that does not exist yet, via
-- `row?.name ?? profile.display_name ?? profile.username`. What should happen
-- on a LATER rename was never specified, so nothing happened.
--
-- CONDITIONAL, not unconditional. A card whose name still matches the profile
-- name is tracking it and keeps tracking it; a card whose name says something
-- else is left alone. That distinction is load-bearing here: the cards seeded
-- by scripts/migrate-team-to-contributor-cards.mjs carry formal full names
-- ("Munazir Ramjhun"), while display_name is free to be a short handle, and
-- admin_profiles_public already coalesces it down to username when unset.
-- Mirroring unconditionally would overwrite the public roster with login
-- handles the first time anyone touched their profile. It is the same
-- principle 0045 states for photos: never silently change something someone
-- chose to keep separate.
--
-- NO BACKFILL, unlike 0045's. 0045 could safely fill gaps because its
-- condition (`avatar_url is null`) identifies an absence. Here, a name that
-- already differs is ambiguous between "went stale before this migration" and
-- "deliberately different", and guessing wrong rewrites a public page. Cards
-- already out of step have to be reconciled once by their owner in Settings;
-- from then on they track. To list them:
--
--   select au.username, au.display_name, cc.name
--     from public.contributor_cards cc
--     join public.admin_users au on au.id = cc.admin_user_id
--    where cc.name is distinct from coalesce(au.display_name, au.username);

-- contributor_cards' RLS only lets a caller write their OWN row, and this
-- fires while the caller is updating admin_users rather than
-- contributor_cards. SECURITY DEFINER is what bridges that, exactly as 0045
-- does in reverse. It also means the invariant holds no matter which path
-- writes display_name: the RPC today, a future admin tool or a one-off script
-- tomorrow.
create or replace function public.admin_profile_syncs_card_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- `after update of display_name` fires whenever the column appears in the
  -- SET list, changed or not, and admin_update_own_profile assigns both of its
  -- columns on every call (0043) including the photo-only path. So the no-op
  -- case has to be filtered here, or every profile-photo change would
  -- pointlessly bump contributor_cards.updated_at through 0043's own trigger.
  if new.display_name is not distinct from old.display_name then
    return new;
  end if;

  -- Never propagate an empty name onto a public page. contributor_cards.name
  -- is `not null`, and AboutPage.jsx calls .charAt(0) on it for the avatar
  -- fallback, so '' would render a nameless card with a blank initial. The
  -- Settings page rejects an empty name too; this is the backstop for any
  -- other write path.
  if new.display_name is null or btrim(new.display_name) = '' then
    return new;
  end if;

  -- No recursion risk: this writes only `name`, so 0045's counterpart trigger
  -- sees photo_url unchanged and makes no write back to admin_users. Even if
  -- it did, it assigns avatar_url alone, which would not satisfy this
  -- trigger's `update of display_name` clause.
  update public.contributor_cards cc
     set name = new.display_name
   where cc.admin_user_id = new.id
     and (
       cc.name = old.display_name
       -- A card created while display_name was still null legitimately holds
       -- the username: that is what AdminSettingsPage.jsx seeds and what
       -- admin_profiles_public coalesces to, so it counts as tracking.
       or (old.display_name is null and cc.name = old.username)
     );

  return new;
end;
$$;

drop trigger if exists admin_profile_syncs_card_name_trg on public.admin_users;
create trigger admin_profile_syncs_card_name_trg
  after update of display_name on public.admin_users
  for each row execute function public.admin_profile_syncs_card_name();

-- Same lockdown 0042/0043/0045 apply to their own trigger functions: this has
-- no business being reachable as a PostgREST RPC. Both revokes are needed, not
-- just the PUBLIC one; this project's default privileges grant EXECUTE on new
-- public-schema functions directly to anon/authenticated rather than by
-- inheriting PUBLIC (see 0043's admin_update_own_profile comment).
revoke execute on function public.admin_profile_syncs_card_name() from public, anon, authenticated;
