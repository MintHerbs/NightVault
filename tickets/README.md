# Tickets

Local, file-based tracking for individual bugs and small features — one
markdown file per ticket. This is separate from GitHub Issues: GitHub
Issues (via the `create-lt-issue` skill, `LT-NNN` IDs) are for
externally-visible, discussion-driven work; this folder is for tracking
work discovered or planned during development sessions (e.g. an audit)
before or instead of filing it upstream. A ticket here can graduate to a
GitHub issue later — reference the `LT-NNN` id back in the ticket file
when that happens.

## Format

- **ID:** `T-NNN`, three-digit zero-padded, sequential, never reused.
- **Filename:** `T-NNN-short-slug.md` (e.g. `T-001-admin-rls-recursion.md`).
- **One ticket = one file.** If a fix naturally splits into several
  independent pieces, file several tickets and link them under one
  [epic](../epics/) instead of cramming them into one file.

Use [TEMPLATE.md](TEMPLATE.md) for new tickets.

## Finding the next free ID

```bash
ls tickets/T-*.md 2>/dev/null | grep -oE 'T-[0-9]+' | sort -V | tail -1
```

Increment the number from that result. If the folder is empty, start at
`T-001`.

## Status values

| Status | Meaning |
|---|---|
| `backlog` | Identified, not yet started |
| `in-progress` | Actively being worked |
| `blocked` | Can't proceed — see the ticket's "Blocked by" field |
| `done` | Fixed and verified — keep the file for history, don't delete |
| `wontfix` | Deliberately not doing this — note why in the ticket |

## Severity values

`critical` (data loss / security / broken core flow) · `high` (broken
feature, no workaround) · `medium` (broken edge case, has a workaround) ·
`low` (cosmetic, tech debt, nice-to-have).

## Relationship to epics

If a ticket is one piece of a larger effort, set its `Epic:` field to the
epic's ID (`E-NNN`) and add the ticket to that epic's checklist in
[epics/](../epics/). Not every ticket needs an epic — a standalone bug fix
doesn't need one invented for it.
