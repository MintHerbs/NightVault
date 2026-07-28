---
id: T-072
title: Admin Settings page — profile photo, password, name, and self-serve contributor cards
status: backlog
severity: medium
area: admin
epic: E-009
created: 2026-07-28
---

## Summary

Admins have no way to manage their own public identity. The avatar dropdown
only offers sign-out (and, separately, a change-password action in one of
the two navbars) — no page exists for setting a profile photo or display
name, and the public "Meet the Team" roster is a hardcoded JS array that
only the developer can edit. Add a Settings page reachable from both
navbar avatar dropdowns, and move `AboutPage.jsx`'s contributor roster onto
the DB so admins can self-serve their own card.

## Evidence

- [src/pages/admin/AdminBrowser.jsx:546-566](../src/pages/admin/AdminBrowser.jsx#L546-L566) —
  avatar Popover, currently just a user-info block + "Sign out"
  ([:561-563](../src/pages/admin/AdminBrowser.jsx#L561-L563)).
- [src/components/admin/EditorNavbar.jsx:193-216](../src/components/admin/EditorNavbar.jsx#L193-L216) —
  the *other* avatar Popover (different page, `EditorNavbar` inside
  `AdminEditor`), which already has "Change password" wired to
  `onChangePassword` (line 206) alongside "Sign out" — two separate
  dropdowns with inconsistent contents is itself part of what this ticket
  cleans up.
- `src/components/admin/ChangePasswordModal.jsx` — already a complete,
  correct flow (re-auth via `signInWithPassword`, `updateUser({password})`,
  `signOut({scope:'others'})`); reuse as-is, just relocate the entry point.
- [db/sql/0016_init_admin_users.sql:4-12](../db/sql/0016_init_admin_users.sql#L4-L12) —
  `admin_users` has no writable-by-self columns and no self-UPDATE RLS
  policy at all (inserts/updates are documented as Edge-Function-only,
  lines 36-43); a plain `using (id = auth.uid())` UPDATE policy on the raw
  table would also let a caller touch `role`/`allowed_directories`/
  `course_id`, which must stay locked down.
- [src/lib/imageToWebp.js](../src/lib/imageToWebp.js) — the existing
  note-image pipeline: canvas decode → scale to `MAX_WIDTH` → `canvas.toBlob(...,'image/webp', QUALITY)`
  ([:19-23](../src/lib/imageToWebp.js#L19-L23),
  [:58-72](../src/lib/imageToWebp.js#L58-L72)), falls back to the original
  file if conversion doesn't win on size. No cropping step — it letterboxes
  to the source aspect ratio, which is fine for note screenshots but wrong
  for a circular avatar that needs a specific center/zoom.
- [src/lib/noteImageSrc.js:22](../src/lib/noteImageSrc.js#L22) /
  [src/lib/noteImagesApi.js:19-30](../src/lib/noteImagesApi.js#L19-L30) —
  existing bucket + upload pattern (`NOTE_IMAGES_BUCKET = 'note-images'`,
  `supabase.storage.from(bucket).upload(...)`) to mirror for avatars.
- [src/pages/about/AboutPage.jsx:55-91](../src/pages/about/AboutPage.jsx#L55-L91) —
  `CONTRIBUTORS` array, hardcoded. Verbatim name matches against the admin
  roster: **Noorie** (line 57, `noorie` admin account), **Nusaibah** (line
  67, `nusaibah`), **Nahla** (line 75, `nahla` — has an admin account,
  role `admin`, though not one of the 6 people named in the original
  request), **Ismail** (line 84, `Ismail`). `FOUNDERS`
  ([:21-53](../src/pages/about/AboutPage.jsx#L21-L53)) similarly matches
  Munazir/`moon`, Tanoo/`tanoo`, Atish/`atish`. Rheva, Maisara, Zakiyyah
  have admin accounts but no existing card.
- Package check: no cropping library (`react-easy-crop`,
  `react-image-crop`, etc.) is installed — confirmed via `package.json`.
  `@radix-ui/react-popover`, `radix-ui`, and `motion` (Framer Motion,
  renamed) are already dependencies.

## Impact

There's no way for the 6+ contributors to set a real profile photo or name
without a developer editing code, and no way for new contributors (Rheva,
Maisara, Zakiyyah) to get a public team card without the same. This blocks
T-071's avatar display from ever showing real photos — it'll show
initials-fallback indefinitely without this ticket.

## Suggested fix

**Depends on T-071** having already added `admin_users.display_name` and
`admin_users.avatar_url` — this ticket writes to those columns, doesn't
create them.

**Schema** (new migration):

```sql
create table public.contributor_cards (
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
create policy "contributor_cards public read" on public.contributor_cards for select using (true);
create policy "contributor_cards self write" on public.contributor_cards
  for insert with check (admin_user_id = auth.uid());
create policy "contributor_cards self update" on public.contributor_cards
  for update using (admin_user_id = auth.uid()) with check (admin_user_id = auth.uid());
```

No RPC needed here (unlike `admin_users`) — every column in this table is
already public-safe, so a plain self-row RLS policy is sufficient.

For the `display_name`/`avatar_url` write path on `admin_users` (which
*does* mix public-safe and sensitive columns), add a `security definer`
RPC rather than an RLS policy on the raw table:

```sql
create function public.admin_update_own_profile(p_display_name text, p_avatar_url text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.admin_users
    set display_name = p_display_name, avatar_url = p_avatar_url
    where id = auth.uid();
end $$;
```

**Storage**: one bucket, `avatars` (public read), two path prefixes —
`profile/{admin_user_id}/{uuid}.webp` for Settings-page photos,
`contributor-card/{admin_user_id}/{uuid}.webp` for team-card photos. One
bucket rather than two since both have identical public-read access needs;
splitting them would be unused structure.

**Crop + WebP**: the user explicitly chose interactive crop over a plain
resize, even though no cropping library exists in this repo. Build a small
hand-rolled canvas cropper (drag to reposition, scroll/pinch to zoom
within a fixed circular viewport) matching this codebase's existing
no-dependency style in `imageToWebp.js`, rather than adding a new package.
On confirm, draw the visible viewport region onto a 512×512 canvas (avatars
never need more — note images use 1440px because they're full-width
screenshots, this is a small circular thumbnail) and encode via the same
canvas-to-WebP approach `imageToWebp.js` already uses. Pull `encodeWebp()`
(currently private to that file) out into a small shared
`encodeCanvasToWebp(canvas, quality)` helper so the cropper reuses it
instead of duplicating the `canvas.toBlob(..., 'image/webp', quality)` +
null-check logic.

**Settings page** (`/admin/settings`), Material You styled using the
existing `--md-*` tokens (already used by `AdminBrowser`/`Card` — no MUI,
forbidden per `docs/rules.md §5.2`):
1. Profile picture — crop-and-upload flow above, writes `avatar_url` via
   `admin_update_own_profile`.
2. Password — relocate `ChangePasswordModal.jsx`'s trigger here; remove
   the duplicate "Change password" entry from `EditorNavbar`'s dropdown
   once this exists, so there's one place to do it, not two inconsistent
   ones.
3. Display name — plain text field, writes `display_name` via the same RPC.
4. Contributor card — form for `name` (defaults to `display_name`),
   `role_text`, photo (same crop+WebP flow as #1, separate storage path),
   and `socials` (instagram/github/linkedin, matching
   `AboutPage.jsx`'s existing `SOCIALS` order — no new platforms unless
   asked for). Writes to `contributor_cards` directly (self-row RLS, no
   RPC needed).

**Navbar entry point**: add "Settings" to both
`AdminBrowser.jsx`'s (line ~561-563) and `EditorNavbar.jsx`'s (line
~206-213) avatar Popovers, above "Sign out."

**`AboutPage.jsx` migration**: one-time data migration inserts
`contributor_cards` rows for the 7 people who already have a hardcoded
card (Munazir, Tanoo, Atish as `section='founder'`; Noorie, Nusaibah,
Nahla, Ismail as `section='contributor'`), matched to their `admin_users`
row by username, uploading their existing `src/img/team/*.png` files to
the new `avatars` bucket to populate `photo_url`. Rheva, Maisara, Zakiyyah
get no row — they create their own via Settings, per the original request.
`AboutPage.jsx` itself changes from the hardcoded `FOUNDERS`/`CONTRIBUTORS`
arrays to a `select * from contributor_cards where section = $1 order by
sort_order` query; `MemberCard` stays the same, just fed DB rows instead
of array literals.

## Acceptance criteria

- [ ] "Settings" reachable from both admin avatar dropdowns
- [ ] Uploading a profile photo lets the user reposition/zoom before
      saving, and the stored result is WebP, ≤512px, uploaded to
      `avatars/profile/{id}/...`
- [ ] Password change works identically to today's `ChangePasswordModal`
      flow, now surfaced from Settings; `EditorNavbar`'s duplicate entry
      is removed
- [ ] Changing display name updates what T-071's author avatars/popovers
      show, without needing the `username` (login handle) to change
- [ ] `admin_update_own_profile` cannot be used to modify `role` or
      `allowed_directories` (only 2 columns are touched, verified by
      reading the function body — no dynamic SQL)
- [ ] A contributor with no card yet sees a "create your card" empty state
      in Settings; one with an existing mapped card (Noorie, Nusaibah,
      Nahla, Ismail, and the 3 founders) sees it pre-filled
- [ ] `AboutPage.jsx` renders identically to today for the 7 already-mapped
      people (same photos, names, roles, socials) after the migration, now
      sourced from `contributor_cards` instead of the hardcoded arrays
- [ ] Rheva, Maisara, and Zakiyyah do not appear on `/about` until they
      create a card themselves

## References

- E-009 — parent epic
- T-071 — creates `admin_users.display_name`/`avatar_url`, which this
  ticket's RPC writes to
