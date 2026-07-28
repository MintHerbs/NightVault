---
id: T-066
title: Add KLIPY GIF/sticker picker behind an Edge Function proxy, and a chat typing indicator
status: done
severity: medium
area: social
epic: E-008
created: 2026-07-27
---

## Summary

Two requested features that did not exist. GIF attachment was half-scaffolded
and dead; typing presence had no infrastructure at all. Code for both is
written and building. The GIF half additionally needed a secret set and the
Edge Function deployed before it could work at all; both are done and
verified against the live project (see `Blocked by`).

## Evidence

**GIF support was dead code.** `src/components/social/PostComposer/TenorSearch/`
exists but `grep -rn "TenorSearch" src/` matches only the file's own import
of its stylesheet. Nothing imports the component. It reads
`import.meta.env.VITE_TENOR_API_KEY`, which is not in `.env` either.

The plumbing on the other end was already there and unused:
`usePosts.createPost` writes `gif_url` (`usePosts.js:253`, old), `PostCard`
renders `post.gif_url` (`PostCard.jsx:376`, old), and
`db/seeds/dev_social_schema.sql:44` declares the column. Only the picker was
missing.

**KLIPY's key cannot go in the browser.** Their API embeds it in the URL
path (`https://api.klipy.com/api/v1/{API_KEY}/gifs/search`), so a
`VITE_`-prefixed variable would ship it in the JS bundle to every visitor.
`.env` currently holds only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
and `SUPABASE_SECRET_KEY`; there is no KLIPY key yet.

**No typing presence.** `src/hooks/useChat.js:50-70` subscribes to exactly
one thing, `INSERT` on `messages`. There is no presence or broadcast channel
anywhere in the chat feature.

## Impact

Users cannot attach GIFs or stickers despite the database column, the post
renderer, and a whole component directory implying they can. In chat there
is no signal that anyone is composing a reply, so short exchanges feel dead.

## Fix applied

**KLIPY proxy** — `supabase/functions/klipy/index.ts`, matching the pattern
of the three existing Edge Functions. Accepts
`{ kind: 'gifs' | 'stickers', q, page, perPage, customerId }`, clamps
`perPage` to KLIPY's documented 8-50, and returns a normalised
`{ items: [{ id, title, previewUrl, fullUrl, width, height }], page, hasNext }`.
No admin check: the feed is anonymous, so the caller authenticates only as
the anon role through `supabase.functions.invoke`.

The rendition normaliser walks the payload for anything shaped like
`{ url, width, height }` rather than hardcoding a key path. This is
deliberate: `docs.klipy.com` returns HTTP 403 to non-browser clients, so the
exact nesting and size-tier names could not be confirmed. It picks the
smallest rendition for the grid thumbnail and a mid tier for the post, and
prefers `gif`/`webp` over `mp4` since `PostCard` renders GIFs with `<img>`.

**Picker** — `src/components/social/PostComposer/MediaPicker/`, with
GIF/Sticker segmented tabs, 350ms debounced search, skeleton grid, paging,
error and empty states, and a stale-response guard so a slow page-1 request
cannot overwrite newer results. Wired into `PostComposer` as a fourth
toggle chip, with a selected-GIF preview and a remove button;
`gifUrl` flows into the existing `createPost` field.

**Typing indicator** — `src/hooks/useTypingIndicator.js` on a Supabase
Realtime *broadcast* channel rather than a table, since the data is stale
within seconds and a row insert per keystroke burst would be pure waste.
Pings are throttled to one per 1.8s, peers expire after 4s, and a 1s sweep
handles peers that close the tab without sending `stopped`.
`src/features/chat/components/TypingIndicator/` renders up to 3 overlapping
avatars (reusing the existing `ChatAvatar`) next to a pill of three dots
bouncing on a stagger, per the requested design.

## Acceptance criteria

- [x] KLIPY key is never present in client-side code or the built bundle
- [x] Picker supports both GIFs and stickers, with search and paging
- [x] Selected GIF previews in the composer and can be removed before posting
- [x] Typing indicator shows at most 3 overlapped avatars plus an animated
      three-dot pill
- [x] Typing state expires on its own if a peer disappears
- [x] `npm run build` and `npm run lint:css` pass
- [x] `KLIPY_API_KEY` set via `supabase secrets set` on project
      `uidwarvgznzsutotuabv`
- [x] `supabase functions deploy klipy` run
- [x] Picker verified against real KLIPY responses, confirming the rendition
      normaliser picks sensible thumbnail and full URLs
- [x] Typing indicator verified across two live sessions

## Blocked by

Resolved 2026-07-28. The key had already been obtained but was placed as
`KLIPY_API` in the root `.env` (wrong name, and the wrong file — Edge
Function secrets read from `supabase/functions/.env` locally, not the root
`.env`). Moved it to `supabase/functions/.env` as `KLIPY_API_KEY`, removed
the stray entry from root `.env`, ran `supabase secrets set KLIPY_API_KEY=...`
on `uidwarvgznzsutotuabv`, and deployed the function (now `ACTIVE`, version 1).

Verification:
- Called the deployed function directly for `gifs` (trending + search
  `q=cat`), `stickers`, page 2, and an invalid `kind` — all returned
  normalised, sensibly-sized `previewUrl`/`fullUrl` pairs and the expected
  400 on the bad kind.
- Drove the app in a real browser (Playwright against a headless Chromium)
  against the `uidwarvgznzsutotuabv` project: opened the composer's GIF
  panel, confirmed 24 real KLIPY thumbnails render, selected one, confirmed
  the preview-with-remove-button appears, zero console errors.
- Opened `/social/chat` in two separate browser contexts with distinct
  session UUIDs; typing in one showed the avatar + three-dot pill in the
  other within the polling window, and it cleared after the field emptied.
- `npm run build` and `npm run lint:css` both pass (already true before
  this pass; re-confirmed).

## Addendum 2026-07-28: grid thumbnail overlap

User reported the GIF grid rendering as overlapping, non-square, filmstrip-like
images instead of a clean 3-column square grid, on their own machine. Could not
reproduce it in a fresh headless-Chromium pass against the same live data
(identical trending GIFs came back as clean 205×205 squares, computed styles
confirmed `aspect-ratio: 1/1` resolving correctly there).

The measurements the user's screenshot implies (short, non-square, directly
stacked rows) point at `.thumbBtn`'s `aspect-ratio: 1/1` not resolving in
their renderer — a grid item's `aspect-ratio` can be layout-order-dependent
in a way a percentage-padding box never is. Rather than leave that as a
maybe, replaced it with the classic `padding-bottom`-percentage square (a
`position: relative` box with `height: 0; padding-bottom: 100%`, and the
`<img>` absolutely positioned to fill it) in
`src/components/social/PostComposer/MediaPicker/MediaPicker.module.css`,
for both `.thumbBtn` and the `.skeleton` loading placeholder. This has no
dependency on `aspect-ratio` support at all, so it removes the failure mode
regardless of what exactly triggered it for that renderer.

Re-verified: `npm run build` and `npm run lint:css` pass; re-ran the same
browser check against the live project, grid still renders as clean
205×205 squares. Have not been able to confirm this against the reporter's
own original broken state (never reproduced it directly) — needs their
confirmation that a refresh resolves it.

## Follow-ups

- KLIPY's docs mention view/share tracking when a user selects an item. The
  endpoint could not be confirmed while `docs.klipy.com` was returning 403,
  so it is not implemented. Worth checking against their partner panel.
- `src/components/social/PostComposer/TenorSearch/` was superseded and has
  now been deleted (2026-07-28).
- Consider whether a GIF-only post (no text) should be allowed. Today
  `content` is required, so a GIF must accompany text.

## References

- E-008 — social feed and chat overhaul
- [KLIPY API docs](https://docs.klipy.com/) (403 to non-browser clients)
- [Exploring the KLIPY API](https://dev.to/zuplo/exploring-the-klipy-api-29po)
  — the source for the base URL, path-embedded key, and pagination bounds
- `supabase/functions/admin-github-write/index.ts` — the Edge Function
  pattern this follows
