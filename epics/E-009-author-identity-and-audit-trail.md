---
id: E-009
title: Author identity and audit trail — note authorship, admin profiles, contributor cards
status: in-progress
created: 2026-07-28
---

## Goal

Notes in this app have no reliable authorship record. `notes.updated_by` exists
and is auto-stamped by a DB trigger, but it only ever holds the *last* editor
— there's no `created_by`, no multi-author history, and nothing renders it
anywhere: the admin Drive browser's "Owner" column is a hardcoded stub
(`username.charAt(0)` for whoever is currently logged in, not the row's real
author — [AdminBrowser.jsx:775-777](../src/pages/admin/AdminBrowser.jsx#L775-L777)),
and the public site shows no attribution at all.

The goal is for juniors on the live site to see which mentor(s) wrote or
contributed to a given note, and for admins to manage their own public
identity (photo, name, contributor card) instead of that being hardcoded in
`AboutPage.jsx`.

This was scoped as two tickets rather than one because they split naturally
along the project's own convention
([tickets/README.md](../tickets/README.md): "if a fix naturally splits into
several independent pieces, file several tickets"): T-071 is the audit-trail
data model and where it's displayed (works with initials/fallback avatars on
day one), T-072 is the self-serve profile UI that lets people set a real
photo and name. T-072 depends on the two `admin_users` columns T-071 adds,
but the reverse isn't true — T-071 is independently shippable.

## Tickets

- [ ] T-071 — Note authorship audit trail: `created_by`, multi-author
      `note_authors`, verified backfill for pre-existing notes, admin Owner
      column, public author avatars on the notes browser and reader (high)
- [ ] T-072 — Admin Settings page: profile photo (crop + WebP), password,
      display name, and self-serve contributor cards mapped onto the
      existing hardcoded `AboutPage.jsx` roster (medium)

## Non-goals

- Not a redesign of `AboutPage.jsx`'s visual layout — T-072 moves its data
  source from hardcoded arrays to the DB, but the M3 card look stays as-is.
- Not a change to who can *write* which notes — `admin_can_write_module`
  and the existing role/course model (T-051) are untouched; this only adds
  *who wrote it* on top of the existing *who's allowed to write it*.
- Not real-time presence ("who's editing this note right now") — this is
  historical attribution only.

## References

- [db/sql/0020_init_notes.sql](../db/sql/0020_init_notes.sql) — existing
  `notes.updated_by` + `notes_set_metadata` trigger this epic extends
- [db/sql/0016_init_admin_users.sql](../db/sql/0016_init_admin_users.sql) —
  `admin_users`, RLS-locked to owner/self, why a public view is needed
- [src/pages/about/AboutPage.jsx](../src/pages/about/AboutPage.jsx) —
  hardcoded contributor roster T-072 migrates onto the DB
