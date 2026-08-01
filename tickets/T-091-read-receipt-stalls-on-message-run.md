---
id: T-091
title: "Chat read receipt never advances past the first message of a run, so \"Seen by\" disappears the moment someone sends twice"
status: backlog
severity: medium
area: chat
epic: E-008
created: 2026-08-01
---

## Summary

The "Seen by" indicator only appears when the newest message in the thread is
the *first* one a peer read. Send a second message a couple of seconds later
and the indicator vanishes and never comes back, even though the peer has the
panel open and is visibly receiving every message.

Found while verifying T-087, and confirmed **not** a T-087 regression: the
same probe reproduces it identically on the pre-rebuild build.

## Evidence

Two browser sessions against local Supabase, both with the chat panel open and
both receiving every message (bubble counts match on each side):

| Messages sent by A | "Seen by" on A |
|---|---|
| 1 | appears in ~1s |
| 5, paced 2.1s apart | never appears, polled for 20s |

Reproduced on the rebuilt build (port 5199) and on the pre-rebuild build
served from the main checkout (port 5198). The 1-message case passes on both;
the 5-message case fails on both.

It does not merely lag, it **latches**: after the five-message run, waiting six
seconds and sending one further message still leaves the indicator hidden for
the rest of the session. So the peer's tracked timestamp is stuck at the first
message it read, not trailing one behind.

The mechanism is the pairing of these two:

- `src/features/chat/components/ChatPanel/ChatPanel.jsx:78-82` — the peer
  calls `markRead(lastMessage.created_at)` in an effect keyed on
  `lastMessage`, so it should re-track on every new message.
- `src/features/chat/components/ChatPanel/ChatPanel.jsx:85-89` — the sender
  renders the indicator only for peers whose `seenAt` is
  `>= lastMessage.created_at`.

So the display is all-or-nothing against the newest message: if the peer's
tracked timestamp lags by even one message, the indicator hides entirely
rather than showing "seen up to here". Since delivery is confirmed working,
the peer's `channel.track()` in
`src/hooks/useReadReceipts.js:43-47` is not landing on the later messages —
Realtime presence updates on the same key in quick succession are the
suspect, not the effect.

Neither file was changed by T-087: `useReadReceipts.js` is untouched, and
ChatPanel's receipt block was carried over verbatim.

## Impact

In any real conversation someone sends more than one message, so the feature
is effectively dead outside a single-message exchange: a visitor sends three
messages, a peer reads all three with the panel open, and the sender is told
nothing was seen. That is worse than no indicator, because absence reads as
"nobody is there" rather than "not known".

## Suggested fix

Two separable pieces:

1. **Make the display tolerant.** `>= lastMessage.created_at` is a strict
   read-to-the-end test. Anchoring the indicator under the last message the
   peer *has* read, rather than hiding it unless they have read the newest,
   degrades gracefully and is the usual pattern.
2. **Make the tracking reliable.** Confirm whether rapid `channel.track()`
   calls on one presence key are being coalesced or rate-limited, and if so
   debounce the peer's `markRead` to the trailing edge (say 500ms) so one
   settled update lands per burst instead of five that race.

Worth checking `supabase.realtime` client config for `eventsPerSecond` while
in there.

## Acceptance criteria

- [ ] After a peer reads a run of five messages with the panel open, the
      sender sees "Seen by" against the newest message
- [ ] The indicator survives a further message from the sender once the peer
      has read it
- [ ] Verified across two live browser sessions, not only in one
- [ ] The single-message case still works

## References

- [T-087](T-087-social-and-chat-ui-rebuild.md) — found during its verification;
  the A/B against the pre-rebuild build is what rules out a regression
- T-073 — added seen receipts; verified the single-message case live, which is
  why this went unnoticed
- `src/hooks/useReadReceipts.js` — presence channel, deliberately ephemeral
