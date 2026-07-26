---
name: create-ticket
description: Use whenever you create a local ticket (tickets/T-NNN-*.md) or epic (epics/E-NNN-*.md) in this project — e.g. after a bug scan, code review, or audit. Computes the next unique T-NNN or E-NNN id from the folder contents and writes the file from the template. This is for local, file-based tracking — not GitHub Issues (see the create-lt-issue skill for those).
---

# Create a local ticket or epic

[tickets/](../../../tickets/) and [epics/](../../../epics/) are file-based
tracking for work discovered during development (audits, bug scans, code
review) — distinct from GitHub Issues, which use the `create-lt-issue`
skill and are for externally-visible, discussion-driven work. A ticket can
graduate to a GitHub issue later; when it does, note the resulting
`LT-NNN` id back in the ticket file rather than deleting the ticket.

## Step 1 — Find the next free ID

```bash
# Tickets
NEXT_T=$(ls tickets/T-*.md 2>/dev/null | grep -oE 'T-[0-9]+' | grep -oE '[0-9]+' | sort -n | tail -1)
NEXT_T=$((${NEXT_T:-0} + 1))
TICKET_ID=$(printf "T-%03d" "$NEXT_T")

# Epics
NEXT_E=$(ls epics/E-*.md 2>/dev/null | grep -oE 'E-[0-9]+' | grep -oE '[0-9]+' | sort -n | tail -1)
NEXT_E=$((${NEXT_E:-0} + 1))
EPIC_ID=$(printf "E-%03d" "$NEXT_E")
```

**Batch creation:** if creating several tickets in one pass (e.g. all
findings from one audit), increment the counter locally between files —
don't re-scan the folder each time, since earlier files in the same batch
may not be written yet when you compute the next one mentally.

## Step 2 — Write the file from the template

Tickets: copy [tickets/TEMPLATE.md](../../../tickets/TEMPLATE.md) to
`tickets/T-NNN-short-slug.md`, fill in `id`, `title`, `status` (usually
`backlog`), `severity`, `area`, `epic` (or `none`), `created` (today's
date), and the body sections. Every claim in "Evidence" and "Impact" must
trace to something actually read in the code — no speculative findings.

Epics: copy [epics/TEMPLATE.md](../../../epics/TEMPLATE.md) to
`epics/E-NNN-short-slug.md`, fill in the frontmatter and list the
tickets it groups.

## Step 3 — Cross-link

If the ticket belongs to an epic: add a checklist row to that epic's
`## Tickets` section, and set the ticket's `epic:` field to the epic's id.
Don't invent an epic for a single standalone ticket.

## Filename and ID rules

- Three-digit zero-padded, sequential, never reused — same convention as
  `LT-NNN` in `create-lt-issue`, just a separate namespace (`T-`/`E-`
  instead of `LT-`).
- Filename mirrors the id: `T-003-image-cleanup-race.md`, not
  `image-cleanup-bug.md`.
- See [tickets/README.md](../../../tickets/README.md) and
  [epics/README.md](../../../epics/README.md) for status/severity value
  definitions.
