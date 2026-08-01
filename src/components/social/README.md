# Social components

The feed at `/social/feed` and its supporting pieces. The chat panel lives
separately, under [src/features/chat/](../../features/chat/), but shares this
surface's design language and two of its primitives.

## Design language (T-087)

Three layers, each with exactly one job. Anything added here has to fit them,
or the surface starts splitting in two again the way it did between T-065 and
T-087.

**1. Surface carries structure.** Every container is a Material 3 tonal
surface: an `--md-surface-container-*` fill, an `--md-outline-variant`
hairline, an `--md-shape-*` radius. Elevation is tone, not shadow. A surface
never gets both a tonal fill and an accent-tinted border. There is no hover
lift anywhere in the feed.

Nesting goes `--md-surface-container-low` (card, composer) →
`--md-surface-container` (attachment tray, comment field, chat bubble) →
`--md-surface-container-high` (menu, dialog, code input, poll option row).

**2. Accent carries meaning.** `--color-accent` appears only where it encodes
state or identity: focus, the primary action, your own chat bubble, an active
toggle chip, the poll option you picked, the "you" avatar ring. It is never
decoration on static text. **No `text-shadow` glow** — that was the old idiom
and it is gone.

**3. One signature element per surface.** A 2px neon rule along the top edge,
`var(--signature-gradient)`, dim at rest and bright on `:focus-within`. Painted
by `PostComposer` and `ChatHeader`. `PostCard` deliberately does not carry it —
owner call on 2026-08-01, one line per feed screen reads as clutter once every
card has one. That single line is the whole cyberpunk budget for a container,
which keeps `CodeBlock` the loudest thing on the page — correct, because it is
the content.

### Fixed exceptions

- **Vote green `#22c55e` / red `#ef4444`** are hue-fixed literals across all
  nine themes. Direction has to mean the same thing everywhere, so these do
  not derive from the accent. Same for the chat header's online dot.
- **Black shadows and scrims** (`rgba(0, 0, 0, …)`) stay literal. They carry no
  text-contrast requirement and must not flip with the mode.
- **[CodeBlock/](CodeBlock/) is frozen.** It renders published notes through
  `MarkdownRenderer` as well as feed snippets, so a restyle here would change
  every note. Its cyberpunk syntax palette is deliberate and out of scope. The
  composer's code *input* is `PostComposer/CodeAttachment/`, a different
  component, and that one does follow the three layers above.

## Layout

```
HomeFeedPage
├── PostComposer                  progressive: one line → title + body + chips
│   ├── ComposerAttachments       the four tray states
│   │   └── AttachmentTray        one chrome for poll / code / GIF
│   │       ├── PollBuilder
│   │       ├── CodeAttachment    code input, not CodeBlock
│   │       └── ui/MediaPicker    shared with chat; frameless, host owns the card
│   └── ComposerBar               chips + counter + Post
└── PostCard
    ├── PostHeader                avatar, Anon, time, overflow menu (edit/delete/flag)
    ├── PostBody                  title, clamped text, read-more, edit + delete states
    ├── CodeBlock                 frozen
    ├── PostPoll                  options, then result rows
    ├── PostActions               ui/VoteControl + comment toggle + flag read-out
    ├── CommentSection            header + sort + collapse
    │   ├── CommentComposer
    │   └── CommentItem           thread connector, recursive one level
    │       └── ReplyBox
    └── FlagConfirmDialog
```

## Shared primitives

Both live in [src/components/ui/](../ui/) because the chat uses them too.

- **`ui/VoteControl`** — the segmented up / score / down control. Posts use
  `size="md"`, comments `size="sm"`. Before T-087 these were two different
  shapes for identical semantics.
- **`ui/AvatarStack`** — overlapping seeded avatars with an overflow count.
  Used by `TypingIndicator` and `SeenIndicator`, which each had their own copy.

Timestamps come from
[src/lib/social/relativeTime.js](../../lib/social/relativeTime.js)
(`formatRelativeTime`, `formatAbsoluteTime`, `formatClockTime`,
`formatDayLabel`, `isDifferentDay`), not from a private copy per component.

## Standalone components

[Alert/](Alert/), [Badge/](Badge/), [Callout/](Callout/) and [Toast/](Toast/)
predate the language above and were **not** rebuilt. Only `Callout` has a live
consumer, in [pages/social/guidelines.jsx](../../pages/social/guidelines.jsx);
the other three are rendered solely by
[pages/social/ComponentShowcase.jsx](../../pages/social/ComponentShowcase.jsx),
which is not routed anywhere. Owner decision on 2026-08-01 was to leave all
four alone rather than restyle or delete them, so they still carry their own
hardcoded palettes. Do not copy their patterns into new work.

## Conventions

- **Motion** is `motion/react`. **Not** Framer Motion, and not GSAP. Durations
  and easing come from the `--md-duration-*` / `--md-easing-emphasized` tokens.
- **Icons** are `lucide-react` unless a custom SVG is specified.
- Every `@media` rule carries a comment naming its `--breakpoint-*` token,
  because custom properties cannot be read inside a media condition.
- Every module that animates carries a `prefers-reduced-motion: reduce` block.
- Interactive controls are at least 44px at the `--breakpoint-sm` (480px)
  viewport.
- `PostCard` is wrapped in `memo` and must keep receiving **scalar** props from
  `HomeFeedPage`. Passing a rebuilt object re-renders all 50 cards on any vote
  and re-tokenises every code block with them (T-064).

## References

- [T-087](../../../tickets/T-087-social-and-chat-ui-rebuild.md) — this rebuild
- [E-008](../../../epics/E-008-social-feed-overhaul.md) — parent epic
- [docs/design.md](../../../docs/design.md) — token table, breakpoints, decisions log
- [docs/design/colors.md](../../../docs/design/colors.md) — `--md-*` roles
