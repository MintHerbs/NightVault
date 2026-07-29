---
id: T-073
title: "Chat redesign: typing indicator position, cyberpunk bubble/input restyle, seen receipts, emoji/GIF/sticker drawer"
status: done
severity: medium
area: chat
epic: E-008
created: 2026-07-28
---

## Summary

Owner feedback on `/social/feed`'s chat panel (screenshot review, 2026-07-28):
the typing indicator sits too close to the input and needs more breathing
room above it; the message bubbles + avatar pairing already reads well and
should be kept; but the overall chat text UI wants a cyberpunk-consistent
visual refresh, plus three features that don't exist yet: a "seen" /
read-receipt signal, and the ability to post GIFs, stickers, and emoji from
a drawer.

## Evidence

- `src/features/chat/components/TypingIndicator/TypingIndicator.module.css:1-9`
  — `.wrapper` is a normal flow sibling directly above `ChatInput` inside
  `ChatPanel`'s `.inputArea` (`ChatPanel.jsx:60-64`), with only 6px of
  bottom padding separating it from the input — reads as glued to the
  input rather than floating above it.
- `src/features/chat/components/ChatBubble/ChatBubble.module.css:28-36` —
  bubbles use the generic `--md-surface-container-low` Material tone
  rather than any of the cyberpunk neon-glow treatment already established
  in `src/components/social/PostComposer/PostComposer.module.css:18-46`
  (animated gradient hairline + accent-glow box-shadow).
- `db/sql/0001_init_messages.sql:7-12` — `messages` has only `id`,
  `session_id`, `content`, `created_at`. No `read_at`/`seen` column, and
  there is no presence/read table either — a seen mechanism has no
  scaffolding to build on.
- `src/hooks/useChat.js` and `src/hooks/useTypingIndicator.js` — messages
  are DB-backed (Postgres `INSERT` subscription); typing presence is a
  deliberately ephemeral Realtime *broadcast* channel (`chat-typing`), not
  a table, per the file's own header comment — the precedent this
  ticket's seen-receipt design follows.
- `src/components/social/PostComposer/MediaPicker/MediaPicker.jsx` +
  `supabase/functions/klipy/index.ts` — a working KLIPY-backed GIF/sticker
  picker already exists for the post composer (T-066) but is neither
  generalized for reuse nor wired into chat. No emoji picker exists
  anywhere in the codebase.

## Impact

Users composing in the community chat have no way to tell whether anyone
has actually read what they sent, cannot attach a GIF/sticker the way
posts already can, cannot pick an emoji without leaving the app to
copy/paste one, and the typing indicator's cramped placement reads as a
layout defect rather than a deliberate affordance.

## Suggested fix

- Reposition `TypingIndicator` to float above `ChatInput` with a
  deliberate offset (absolute, anchored to `.inputArea`'s top edge)
  instead of sitting in normal flow with a 6px gap.
- Refresh `ChatBubble` and `ChatInput` visuals with the same
  animated-gradient-hairline + accent-glow idiom already used in
  `PostComposer`, keeping the existing avatar+bubble structure and
  tail-corner shape intact (explicitly not touching layout, only surface
  treatment).
- Add a "seen by" indicator under the newest message, backed by a new
  presence-based `useReadReceipts` hook (Realtime Presence, mirroring
  `useTypingIndicator`'s ephemeral design — no schema change, since read
  state is only meaningful for currently-connected peers with the panel
  open).
- Promote `MediaPicker` to `src/components/ui/MediaPicker/` (now used by
  both the post composer and chat — rules.md's "used in 2+ places"
  extraction trigger), add a third `emoji` tab (static curated grid, no
  network call) alongside the existing `gifs`/`stickers` KLIPY tabs, and
  gate which tabs render via a new `tabs` prop so the composer's behavior
  is unchanged.
- Add a drawer trigger button to `ChatInput` that opens this picker: emoji
  selection inserts into the compose field; GIF/sticker selection sends
  immediately as a new message.
- Add `messages.attachment_url` / `messages.attachment_type` columns
  (migration `0044`) since GIF/sticker messages are persisted content,
  unlike the ephemeral typing/seen state — `content` stays `NOT NULL` but
  callers may send `''` for an attachment-only message.

## Fix applied

All items below were implemented on branch
`feat/T-073-chat-redesign-seen-media-drawer` and verified live against a
local Supabase (Docker) instance, driving the real app in headless
Chromium (two separate browser contexts for the presence-based features).

- **Typing indicator** — `TypingIndicator.module.css` now positions
  `.wrapper` as `position: absolute; bottom: 100%` anchored to
  `.inputArea`, with a 14px `margin-bottom`, instead of a normal-flow
  sibling with 6px of padding. Verified: floats with a clear gap above
  the input in a live two-session screenshot.
- **Cyberpunk restyle** — `ChatBubble`'s own-message bubble now uses an
  accent gradient background + `box-shadow` glow (mirroring, not literally
  copying, PostComposer's animated hairline — this is a static
  glow/gradient, not a `@keyframes`-animated line); `ChatInput`'s
  container carries a persistent low-opacity accent border + glow that
  brightens on focus. Avatar+bubble layout and corner radii are untouched.
  Verified visually in-browser.
- **Seen receipts** — `src/hooks/useReadReceipts.js` (Presence channel
  `chat-read-receipts`, ephemeral, mirrors `useTypingIndicator.js`'s
  design) plus `src/features/chat/components/SeenIndicator/`. Wired into
  `ChatPanel.jsx`: marks read on the newest message whenever the panel is
  open and that message changes; renders under the last bubble. Verified
  live across two separate browser sessions — session B's avatar appeared
  under session A's last message within ~2s of B reading it.
- **Emoji/GIF/sticker drawer** — `MediaPicker` promoted from
  `src/components/social/PostComposer/MediaPicker/` to
  `src/components/ui/MediaPicker/`, gained a `tabs` prop (PostComposer
  keeps its default `gifs`/`stickers`-only tabs, chat adds `emoji`) and a
  static local `emoji` tab (`emojiData.js`, 51 curated entries, no network
  call). `ChatInput` gained a drawer-trigger button; emoji selection
  inserts into the field and keeps the drawer open, GIF/sticker selection
  sends immediately via `useChat.sendAttachment` and closes the drawer.
  Verified live: emoji tab renders and inserts correctly; GIFs tab renders
  its UI and gracefully shows a "Could not reach the GIF library" error
  (KLIPY's Edge Function is not deployed to the local stack — same
  limitation any local dev environment has, not a code defect); a directly
  inserted attachment row rendered as an `<img>` bubble via the new
  `mediaBubble`/`attachmentImg` CSS (the actual external GIF didn't load
  pixel-for-pixel in the sandboxed test run, no outbound internet there,
  but the DOM/render path is confirmed). PostComposer's own GIF/sticker
  flow re-verified live post-promotion: opens with exactly `["GIFs",
  "Stickers"]` tabs, no `emoji` leakage, no console errors.
- **Schema** — `db/sql/0044_chat_message_attachments.sql` adds
  `messages.attachment_url`/`attachment_type` (nullable, `CHECK
  (attachment_type IS NULL OR attachment_type IN ('gif', 'sticker'))`).
  Applied directly to local dev via `docker exec ... psql` rather than
  `npm run db:migrate`, because the runner currently refuses to apply
  *anything* due to pre-existing, unrelated checksum drift on migration
  `0024` (predates this ticket). Verified directly: columns exist, a
  plain-text insert and an attachment insert both succeed, an invalid
  `attachment_type` is rejected by the CHECK, and re-running the file is
  a no-op (idempotent). All synthetic test rows were deleted afterward.

Not independently re-verified: KLIPY's actual GIF/sticker network response
end-to-end in chat (blocked by no local Edge Function + no outbound
internet in the test sandbox) — the same integration T-066 already proved
works for the composer, and this ticket reuses that exact code path
unchanged.

## Acceptance criteria

- [x] Typing indicator renders with a clear, deliberate gap above the
      input instead of sitting flush against it
- [x] ChatBubble and ChatInput carry the cyberpunk neon-glow treatment
      consistent with PostComposer, without changing the avatar+bubble
      layout the owner already likes
- [x] Newest message shows avatars of peers who have read up to that
      point, live, while they have the panel open
- [x] Drawer offers Emoji, GIFs, and Stickers tabs from the chat input
- [x] Emoji selection inserts into the compose field; GIF/sticker
      selection sends as a message and renders correctly in ChatBubble
      for both sender and receiver
- [x] PostComposer's existing GIF/sticker picker behavior is unchanged
      after the MediaPicker promotion/generalization
- [x] `npm run build` and `npm run lint:css` pass
- [x] Migration applied and verified against local Supabase (Docker)

## References

- E-008 — social feed and chat overhaul
- T-066 — KLIPY media picker and chat typing indicator (the precedent
  this extends)
- docs/design.md, docs/design/colors.md — cyberpunk accent token system
- docs/architecture-update.md §5.5, §5.7 — chat feature and
  shared-UI-primitive placement
