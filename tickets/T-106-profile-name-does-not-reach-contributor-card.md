---
id: T-106
title: Propagate a profile display-name change to the public contributor card
status: done
severity: medium
area: admin
epic: none
created: 2026-08-06
---

## Summary

Changing "Display name" in the admin Settings page updated
`admin_users.display_name` but left the person's public "Meet the Team" card
showing the old name, indefinitely. The two names are separate columns and
nothing connected them.

## Evidence

- `/about` renders the card name from `contributor_cards.name` alone.
  [AboutPage.jsx:25](../src/pages/about/AboutPage.jsx#L25) maps `row.name`
  onto the card, and
  [AboutPage.jsx:207](../src/pages/about/AboutPage.jsx#L207) loads the roster
  through `listContributorCards` only. Nothing on that page reads
  `admin_users`.
- The only write path to `admin_users.display_name` is the
  `admin_update_own_profile` RPC
  ([0043:87-99](../db/sql/0043_contributor_settings.sql#L87-L99)), called from
  [AdminSettingsPage.jsx:141](../src/pages/admin/AdminSettingsPage.jsx#L141).
  It assigns `display_name` and `avatar_url` and nothing else; no trigger on
  `admin_users` touched `contributor_cards`.
- The only link between the two was a form seed for a card that does not
  exist yet:
  [AdminSettingsPage.jsx:108](../src/pages/admin/AdminSettingsPage.jsx#L108)
  prefills the field with `row?.name ?? profile.display_name ??
  profile.username`. Once a card exists, `row?.name` wins, so the card's
  stored name never moved again.
- Matches the spec as written: T-072 line 345 defines the card's name field as
  "defaults to `display_name`". A default at creation is what shipped; a later
  rename was never specified, so nothing handled it.
- Not the same as the photo behaviour. Photos are deliberately one
  directional, card to profile, and
  [0045:8-13](../db/sql/0045_contributor_photo_syncs_avatar.sql#L8-L13) states
  why. There was no equivalent decision recorded for names.

## Impact

An admin renames themselves in Settings (say `Old Name` to `New Name`), gets a
"Display name updated" toast, and the change lands everywhere that reads
`admin_users`: T-071's author avatars and popovers, and the admin panel's own
avatar dropdowns. The public `/about` roster keeps showing `Old Name` forever.
There is no admin-panel control that fixes it other than knowing to open the
separate "Contributor card" form and retype the name there, and no indication
on the page that the two are different fields.

## Fix

`db/sql/0053_profile_name_syncs_contributor_card.sql`. A SECURITY DEFINER
trigger, `after update of display_name on admin_users`, re-points
`contributor_cards.name`. Done in the database rather than in
`AdminSettingsPage.jsx` for the reason
[0045:15-20](../db/sql/0045_contributor_photo_syncs_avatar.sql#L15-L20) gives:
the invariant then holds for any write path, not just today's.

Conditional, not unconditional. It moves a card name that still equals the old
`display_name` (or, for a card seeded before `display_name` existed, the
`username`), and leaves any other name alone. Unconditional mirroring was
rejected because `scripts/migrate-team-to-contributor-cards.mjs` seeded the
roster with formal full names such as `Munazir Ramjhun`, while `display_name`
is free to be a short handle; it would have overwritten a public page with
login handles the first time anyone touched their profile. That is the same
principle 0045 states for photos.

No backfill. 0045 could fill gaps safely because `avatar_url is null`
identifies a genuine absence; a name that already differs is ambiguous between
"went stale before this fix" and "deliberately different", and guessing wrong
rewrites a public page. The migration header carries a query that lists the
diverging rows; each owner reconciles theirs once in Settings and it tracks
from then on.

`AdminSettingsPage.jsx` mirrors the trigger's condition for its optimistic
update, and separately declines to overwrite an unsaved card-name buffer. The
Display name card now says what it will and will not rename.

## Verification

Applied to local dev via `docker exec psql` (`npm run db:migrate` is still
blocked by 0024's drift) and exercised in rolled-back transactions:

- [x] A card whose name tracked the profile follows a rename
- [x] A card with a deliberately different name is not modified
- [x] A card seeded from `username` picks up a first-ever `display_name`
- [x] An admin with no contributor card does not error
- [x] A null or whitespace-only name is refused, so `contributor_cards.name`
      (`not null`, and `.charAt(0)` on the `/about` avatar fallback) is safe
- [x] A profile-photo-only save issues no write to `contributor_cards` at all,
      confirmed with a write-spy trigger rather than `updated_at` (which
      cannot move inside one transaction, since 0043's trigger uses `now()`)
- [x] Re-applying the file is clean, and no recursion with 0045's trigger
- [x] `SECURITY DEFINER`, `search_path` pinned, EXECUTE denied to both `anon`
      and `authenticated`

## Not done

- Prod. `applied_envs` for 0053 is `["dev"]`; prod has no migration tracking
  (see 0049/0052), so it needs applying by hand.
- The photo direction is unchanged. Profile photo still does not push onto a
  contributor card, per 0045's stated decision. Reversing that is a separate
  call, not part of this ticket.

## References

- T-072 — created the Settings page, contributor cards, and the "defaults to
  `display_name`" wording this ticket completes
- T-071 — added `admin_users.display_name` / `avatar_url`
- `db/sql/0045_contributor_photo_syncs_avatar.sql` — the counterpart sync
