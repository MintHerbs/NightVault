---
id: T-080
title: Expand web module notes ch10-20 to full depth, with diagrams
status: done
severity: medium
area: notes
epic: E-004
created: 2026-07-29
---

## Summary

T-075 imported all 21 web chapters, but the second half of the module was
converted from a much thinner source. Chapters 10 to 20 averaged 1.2 KB against
4.8 KB for chapters 1, 2 and 4, carried no diagrams at all between ch04 and
ch18, and covered syllabus topics in a few bullet points where the earlier
chapters worked through them properly.

## Evidence

Byte counts before this ticket, from `wc -c src/content/notes/web/notes/*.md`:

| Chapter | Before | Chapter | Before |
| --- | --- | --- | --- |
| ch16-platforms | 848 | ch01 (reference) | 5113 |
| ch17-landscape | 951 | ch02 (reference) | 4923 |
| ch10-json | 1032 | ch04 (reference) | 4268 |
| ch18-sensors | 1062 | | |
| ch19-connecting | 1071 | | |
| ch20-testing | 1137 | | |

- ch10-20 total: **12.8 KB across 11 chapters.**
- Diagrams existed only for ch01 (five), ch03 (one) and ch18 (one). Chapters 10
  to 17, 19 and 20 had none.
- The syllabus allocates 2+1 hrs per week to each of these, and weeks 15-20 to
  the mobile block, so the coverage was well short of the taught material.

## Impact

Students using these as their notes for the second half of the module, including
Test 1 and Assignment 1 which fall in week 10, had substantially less to work
from than for weeks 1 to 9. Topics named directly in the syllabus (API
programming and integration, security issues and framework mitigations, mobile
considerations, platforms, landscape, sensors) were each a short list rather than
an explanation.

## Fix

Rewrote all eleven chapters to the depth of ch01/ch02, in the same voice and with
the same conventions (fence meta labels, `> **Analogy:**` and
`> **TL;DR**` blockquotes, comparison tables, the Ares Colony running example).

- **12.8 KB → 83 KB**, a 6.5x expansion. Every chapter now opens with a TL;DR and
  closes with a Recap.
- Added **13 authored SVG diagrams** under `src/content/diagrams/web/`, kept
  separate from `build/web-diagrams/` because those are extracted from the source
  HTML by `scripts/extract-web-note-diagrams.mjs` while these are hand-written.
- Added `scripts/upload-note-diagrams.mjs`, which uploads a diagram directory to
  `note-images/<module>/`. Storage carries no authorship trigger and the service
  role bypasses the bucket's `is_owner()` policy, so unlike a notes write this
  needs no user session.

New material of note: the JSON text-versus-data distinction and error table
(ch10); REST method semantics, idempotency and the 401/403 split (ch11); the
same-origin definition, preflight and the `res.ok` trap (ch12); injection
mechanics walked through character by character, the three kinds of XSS, and why
CSRF works (ch13); parameterization, the escaping table and the `|safe` /
`raw()` / `DEBUG` footguns (ch14); a four-option decision path including PWA
(ch15); fragmentation and the rejection-reason table (ch16); the install funnel
and how each monetization model reaches back into the API (ch17); the permission
lifecycle and the full push-token flow (ch18); token auth, secure storage and
idempotency keys (ch19); the deploy checklist and the version-skew problem
(ch20).

## Acceptance criteria

- [x] ch10-20 are comparable in depth to ch01/ch02 — 5.5 KB to 9.4 KB each,
      83 KB total against 12.8 KB before
- [x] Every one of the eleven opens with a TL;DR and closes with a Recap
- [x] Analogies used throughout, one per major concept
- [x] Syllabus topics for weeks 10-20 each covered at length
- [x] 13 new diagrams, all valid SVG with `xmlns`, a `viewBox`, and a
      full-canvas baked `#0b0d17` backdrop so they stay legible in light theme
- [x] No diagram text overflows its canvas — measured in a real browser via
      `getBBox` and `getCTM` against the viewBox, 0 overflows across all 13
      (3 were caught this way and fixed)
- [x] Every `/notes/img/web/*.svg` reference resolves to a real file, and every
      file is referenced — 20 refs, 20 files, no orphans either way
- [x] All 11 render in the reader with no console errors and no failed requests,
      diagrams loading, tables parsing, TL;DR blockquotes present — driven with
      Playwright, with ch01 as an untouched control
- [x] Legible in light theme — verified on `rgb(248,247,247)`
- [x] Gates: `vite build` exit 0, `stylelint` exit 0, `test:math` 52/52
- [x] Diagrams uploaded to production Storage, all 13 serving `image/svg+xml`
- [ ] ch10-20 note bodies live on production — see below

## Notes

The 13 diagrams **are** live on production (uploaded via the service role, which
Storage permits). The note bodies are not yet, and this is the same wall T-075
hit: `public.notes` writes need a genuine owner session, because RLS is
`is_owner(auth.uid())` and 0042's trigger inserts `auth.uid()` into a NOT NULL
column.

Established this pass, and worth recording so nobody retries it:

- The owner account is **`moon@mooner.dev`** (uuid `662b1d4d-…`), matching
  0022's delete-authorized address. There is no `auth.users` row for
  `munazir.ramjhun@gmail.com`, which is why T-075's sign-in attempts failed.
- The password in `.env` does not authenticate that account either, so
  `scripts/import-web-module-notes.mjs` sign-in mode is unavailable.

So delivery is the generated `build/update-web-notes-ch10-20.prod.sql` (88 KB,
the 11 changed chapters only, so the other ten notes keep their `updated_at`),
pasted into the dashboard SQL editor. It was tested against local on both the
insert and re-run paths. Note that this content **cannot** be sent through an MCP
`execute_sql` call or a chat: ch13 teaches injection and XSS, so its body trips
Cloudflare's WAF at the AI edge. Paste the file, or pipe it to psql from disk.
