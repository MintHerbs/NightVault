-- 0043_contributor_settings.sql
-- T-072: self-serve admin profile (photo, display name) and public
-- contributor cards ("Meet the Team"), replacing the hardcoded arrays in
-- AboutPage.jsx.
--
-- Depends on 0042 (T-071), which added admin_users.display_name/avatar_url —
-- this migration writes to those columns via RPC, it does not create them.

-- ─── contributor_cards ───────────────────────────────────────────────────────
-- Every column here is already public-safe (it's what /about renders), so a
-- plain self-row RLS policy is enough — unlike admin_users, which mixes
-- public-safe and sensitive columns and needs a SECURITY DEFINER RPC instead.
create table if not exists public.contributor_cards (
  admin_user_id uuid primary key references public.admin_users(id) on delete cascade,
  name          text not null,
  role_text     text,
  photo_url     text,
  photo_focus   text,
  socials       jsonb not null default '{}'::jsonb,
  section       text not null check (section in ('founder','contributor')) default 'contributor',
  sort_order    int,
  updated_at    timestamptz not null default now()
);

alter table public.contributor_cards enable row level security;

drop policy if exists "contributor_cards public read" on public.contributor_cards;
create policy "contributor_cards public read"
  on public.contributor_cards for select
  using ( true );

drop policy if exists "contributor_cards self write" on public.contributor_cards;
create policy "contributor_cards self write"
  on public.contributor_cards for insert
  with check ( admin_user_id = auth.uid() );

drop policy if exists "contributor_cards self update" on public.contributor_cards;
create policy "contributor_cards self update"
  on public.contributor_cards for update
  using ( admin_user_id = auth.uid() )
  with check ( admin_user_id = auth.uid() );

grant select, insert, update on public.contributor_cards to authenticated;
grant select on public.contributor_cards to anon;

-- Keeps updated_at meaningful after edits, same pattern admin_users already
-- uses (0016's update_admin_users_updated_at) — without it the column would
-- only ever reflect row creation, never a later edit.
-- search_path is pinned even though this is SECURITY INVOKER, matching every
-- other function this project has added since 0039 — an unpinned search_path
-- is Supabase advisor lint 0011 (function_search_path_mutable), which 0039
-- and 0040 were explicitly written to clear. Leaving a new one behind would
-- re-open a lint those migrations closed.
create or replace function public.contributor_cards_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contributor_cards_set_updated_at_trg on public.contributor_cards;
create trigger contributor_cards_set_updated_at_trg
  before update on public.contributor_cards
  for each row execute function public.contributor_cards_set_updated_at();

-- Same lockdown 0042 applies to notes_track_author, for the same reason: a
-- trigger function has no business being reachable as a PostgREST RPC.
revoke execute on function public.contributor_cards_set_updated_at() from public;
revoke execute on function public.contributor_cards_set_updated_at() from anon, authenticated;

-- ─── admin_update_own_profile ────────────────────────────────────────────────
-- admin_users mixes public-safe columns (display_name, avatar_url) with
-- sensitive ones (role, allowed_directories, course_id) that must stay
-- Edge-Function-only, so a plain self-row UPDATE policy on the raw table is
-- unsafe — it would hand the caller a path to every column, not just these
-- two. A SECURITY DEFINER RPC with a fixed, non-dynamic column list is the
-- same pattern 0042 already uses for note_authors.
--
-- Callers must pass both values on every call (the Settings page keeps both
-- in one profile object and saves the pair together) — passing null for an
-- untouched field would blank it, since this does a plain assignment rather
-- than a coalesce.
create or replace function public.admin_update_own_profile(p_display_name text, p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.admin_users
    set display_name = p_display_name,
        avatar_url = p_avatar_url
    where id = auth.uid();
end;
$$;

-- Both revokes are needed, not just the PUBLIC one: this project's default
-- privileges (verified against the local Supabase stack) grant EXECUTE on
-- every new public-schema function directly to anon/authenticated/
-- service_role, not by inheriting from PUBLIC — so `revoke ... from public`
-- alone leaves anon still able to call this. Confirmed by testing both ways
-- against a local Supabase instance.
revoke execute on function public.admin_update_own_profile(text, text) from public;
revoke execute on function public.admin_update_own_profile(text, text) from anon;
grant execute on function public.admin_update_own_profile(text, text) to authenticated;

-- ─── avatars Storage bucket ──────────────────────────────────────────────────
-- Public bucket, two path prefixes sharing it rather than two buckets (both
-- have identical public-read needs, so splitting them would be unused
-- structure): profile/{admin_user_id}/{uuid}.webp for Settings-page photos,
-- contributor-card/{admin_user_id}/{uuid}.webp for team-card photos.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Scoped on the SECOND path segment (the admin_user_id), not the first (the
-- profile/contributor-card prefix) — mirrors note-images' scoping on
-- foldername()[1] (0023), just one level deeper since this bucket's first
-- segment is a fixed prefix rather than the variable part.
drop policy if exists "avatars self insert" on storage.objects;
create policy "avatars self insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "avatars self update" on storage.objects;
create policy "avatars self update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
