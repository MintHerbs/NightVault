---
id: T-072
title: Admin Settings page — profile photo, password, name, and self-serve contributor cards
status: in-progress
severity: medium
area: admin
epic: E-009
created: 2026-07-28
---

## Implementation status (2026-07-28)

Code-complete per the Suggested fix below:

- `db/sql/0043_contributor_settings.sql` — `contributor_cards` table (self-row
  RLS, public read), `admin_update_own_profile` SECURITY DEFINER RPC,
  `avatars` storage bucket + insert/update policies (registered in
  `db/migrations.yaml` as id `0043`).
- `src/lib/encodeCanvasToWebp.js` — extracted from `imageToWebp.js`'s private
  `encodeWebp()`, now shared by both it and the cropper.
- `src/components/admin/AvatarCropper/` — hand-rolled drag-to-reposition,
  scroll/pinch-to-zoom canvas cropper (no library added), outputs a 512x512
  WebP.
- `src/lib/contributorCardsApi.js` — upload/RPC/CRUD helpers.
- `src/pages/admin/AdminSettingsPage.jsx` (+ `.module.css`) — the four
  sections from the Suggested fix; routed at `/admin/settings`.
- `AdminBrowser.jsx` / `EditorNavbar.jsx` — "Settings" added to both avatar
  dropdowns; `EditorNavbar`'s old "Change password" entry removed (and
  `AdminEditor.jsx`'s now-dead `ChangePasswordModal`/`changePasswordOpen`
  wiring removed with it) — Settings owns that flow now, matching the
  acceptance criterion.
- `AboutPage.jsx` — rewritten to query `contributor_cards` instead of the
  hardcoded `FOUNDERS`/`CONTRIBUTORS` arrays; renders an initials fallback
  for a card with no photo yet.
- `scripts/migrate-team-to-contributor-cards.mjs` — one-off migration for the
  7 already-hardcoded people, transcribed from `AboutPage.jsx`'s pre-rewrite
  arrays. **Not yet run against any environment.**

**DB verification (2026-07-28)**: unlike T-071's session, this one had
Docker running with the project's local Supabase stack already up — but
local dev is only migrated through `0024` (0025+ blocked by pre-existing,
unrelated drift on `0024`; T-071's own `0042` backfill also hardcodes prod
`auth.users` UUIDs that don't exist locally). So `0042`'s DDL prefix (its
schema, not its data backfill) plus `0043` in full were applied and tested
inside a transaction that was always rolled back — zero lasting footprint,
but real verification: `admin_update_own_profile` called end-to-end as an
authenticated user via `SET ROLE`/JWT-claim impersonation, confirmed it
touches only `display_name`/`avatar_url`; `contributor_cards` RLS confirmed
to block cross-user insert/update and allow public read/no-anon-write;
`avatars` bucket + both storage policies confirmed present. This caught and
fixed a real bug: `revoke execute ... from public` alone did NOT block
`anon` from calling the RPC, because this project's Supabase grants EXECUTE
on new functions directly to `anon` (not via `PUBLIC`) — fixed by also
revoking from `anon` explicitly. `npm run build` passes; a headless-Chromium
check confirmed `/about` renders correctly with zero cards (graceful
degrade, not a crash) and `/admin` / `/admin/settings` (unauth redirect) show
no console errors.

**Not verified**: the actual authenticated Settings-page UI (cropper, save
flows) in a real browser — no admin credentials were available this
session. The migration script has not been run. Acceptance criteria below
are unchecked pending a real `npm run db:migrate` (once the `0024` drift is
resolved) and a manual walkthrough as a logged-in admin.

One exception worth noting rather than leaving under that blanket reason:
the `admin_update_own_profile` criterion (no `role` / `allowed_directories`
reachable) does already have its evidence — the function body was read back
via `pg_get_functiondef` confirming neither column is referenced and there is
no dynamic SQL, and the RPC was called end-to-end as an authenticated caller
with `role`/`username` confirmed untouched afterwards. It is left unchecked
only because nothing here has been applied to a persistent database yet.

## Self-review (2026-07-28)

Caught and fixed five real defects in the above, plus re-tested two claims
that had been asserted rather than exercised:

1. **The profile-photo flow silently persisted the display-name text field's
   unsaved buffer.** `confirmProfilePhoto` passed the live `displayName`
   state into `admin_update_own_profile`, which assigns both columns rather
   than coalescing. Clearing the name field and then changing the photo wrote
   `''` — and because `admin_profiles_public` is
   `coalesce(display_name, username)`, which only falls back on NULL, an
   empty string is *worse* than never having set one: T-071's author avatars
   would render a blank name and a `'?'` initial, breaking this ticket's own
   "changing display name updates what T-071 shows" criterion. Fixed by
   tracking `savedDisplayName` separately from the editing buffer; the photo
   path writes the saved value, so it can no longer commit a half-typed name.
2. **`AvatarCropper` failed silently on a browser that can't encode WebP.**
   `encodeCanvasToWebp` throws there — `imageToWebp.js` documents this as a
   real branch (Safari only gained WebP encoding in 16.x), and unlike the
   note-image path there is no fall-back-to-the-original here. The rejection
   escaped an un-`catch`ed `async` click handler, so "Save photo" just
   flicked back with no explanation. Now caught and surfaced via a new
   `onError` prop wired to the page's toast; `getContext('2d')` is
   null-checked too, matching `imageToWebp.js`.
3. **A 0-dimension decode was accepted as valid.** `{w: 0, h: 0}` is truthy,
   so it passed the Save button's `!naturalSize` guard while making
   `baseScale` Infinity and every derived width NaN — the result would have
   been a blank 512x512 square. Now rejected with the same `!w || !h` check
   `imageToWebp.js` makes, and an `<img onError>` handles formats that never
   decode at all (HEIC being the realistic one), which previously left the
   dialog stuck with Save permanently disabled and no message.
4. **`contributor_cards_set_updated_at` left an advisor lint open.** It had
   no pinned `search_path` (Supabase lint 0011, `function_search_path_mutable`
   — the exact lint `0039`/`0040` were written to clear) and was still
   grantable as an RPC. Now pinned and revoked, matching what `0042` does for
   `notes_track_author` one migration earlier.
5. **`AboutPage` keyed its cards on `member.name`.** Safe while those were
   developer-authored literals; now that a card's name is typed by its owner,
   two people can collide. Keyed on `admin_user_id` instead. Also disabled
   the avatar-expand button for a photoless card — a focusable control
   announcing "Expand photo of X" with nothing to expand, only reachable now
   that cards are self-served.

Re-tested rather than trusted: `storage.foldername(...)[2]` really is the
`admin_user_id` for both path prefixes (and is NULL for a too-shallow path,
so it can't be used to sidestep the policy); and the `updated_at` trigger
really does fire — a first-pass check had printed `false` and been dropped
from the test rather than explained, but the cause was the test itself
(`now()` is frozen for the whole of a transaction, so an in-transaction
before/after timestamp comparison can never move). Re-tested by having the
`UPDATE` try to write an explicit year-2000 value and confirming the trigger
overrode it.

`npm run build` and `stylelint` re-run clean after the fixes. **The two SQL
edits in item 4 are not themselves DB-verified** — Docker Desktop stopped
partway through the review, after the earlier in-transaction run. They are
verbatim copies of `0042`'s already-shipped pattern, but re-running
`.selfreview-verify.mjs` (deleted; trivially recreated) once Docker is back
would confirm them.

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
