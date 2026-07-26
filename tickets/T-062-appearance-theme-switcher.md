---
id: T-062
title: Add an Appearance popup (color theme + light/dark mode switcher)
status: in-progress
severity: low
area: theming
epic: none
created: 2026-07-26
---

## Summary

The site has no user-facing theme control. Colors are a single hardcoded
scheme baked directly into `.module.css` files and `src/constants/colors.js`
— including a very recent flat find-and-replace (commit `8ea7614`,
"Alternative theme #ffa31a") that swapped the site's brand accent from
purple to orange across ~73 files with no token layer behind it, so
reverting or offering a choice today means editing files by hand. Add a
popup (avatar in the bottom of the left sidebar) offering Light/Dark/System
mode plus a picker across 8 named color palettes, remembered across visits.

## Evidence

- `src/styles/global.css:8-91` — one `:root` block, one hardcoded dark
  scheme. `--color-accent` is currently `#ffa31a` (post `8ea7614`); the
  original brand purple `#8B5CF6` no longer appears anywhere in `:root`.
- `docs/design.md` and `docs/design/colors.md` are now stale — both still
  document `#8B5CF6` as "Primary purple" / the seed for `--md-*`, not
  updated after `8ea7614`. `docs/design.md` line 36 itself says "No new
  colours without updating this table first," which `8ea7614` did not do.
- `src/constants/colors.js` — plain JS object of literal hex strings
  (`colors.iconActive`, `colors.accent`, etc.), imported and used as inline
  `style={{...}}` values across `Sidebar/CollapsedView.jsx` and the admin
  pages. These are resolved at render time and will **not** react to a CSS
  custom-property/theme change — only `var(--color-*)`/`var(--md-*)`
  consumers (currently <5% of color declarations, per direct grep) update
  live.
- ~700 raw hex/rgba literals hardcoded directly in `.module.css` files
  app-wide (heaviest in `pages/admin`, `components/social`, and
  `features/{logic,recurrence,erd,tree}`), none of which respond to a
  theme switch without being converted to token references.
- `docs/rules.md §5.2` and `docs/design/colors.md` explicitly rule out
  installing MUI or `@material/web` — this project has twice hand-built
  Material Design 3 as CSS custom properties instead (`ui/Card`,
  `AdminBrowser`'s `--md-*`/`--admin-md-*` tokens) — that precedent is the
  approach to extend, not an installed component library.
- `@radix-ui/react-popover` is already a dependency and already used this
  way in this codebase — `src/components/admin/ColorPickerPopover.jsx` and
  `StyleDropdown.jsx` are direct precedents for a controlled Popover with a
  swatch grid / selectable option list.
- The sidebar's bottom avatar (`ChatAvatar`, wired in
  `Sidebar/CollapsedView.jsx:129`) currently has no `onClick` — free slot
  for the new popup's trigger, no collision with existing chat behavior.
- No account system exists for regular visitors (`useAuth`/`supabase.auth`
  only appears under `src/pages/admin/`) — only an anonymous `session_id`
  already persisted via plain `localStorage` in `App.jsx:25`. Theme
  preference persistence should follow that same idiom; there is no
  cross-device sync target to build against.

## Impact

Visitors have no way to change the site's appearance, and the one existing
"theme change" this year was an unreversible, undocumented, hand-edited
73-file hex swap. Any future rebrand or A/B of the accent color means
repeating that manual edit. There's also no light mode at all today.

## Suggested fix

Full phased plan (approved, see
[/home/moon/.claude/plans/sunny-nibbling-dolphin.md](/home/moon/.claude/plans/sunny-nibbling-dolphin.md)
for complete detail):

- **Phase 0** — Token foundation: extend `global.css`'s `--color-*`/`--md-*`
  sets into 8 named palettes × {light, dark} via
  `[data-color-theme][data-mode]` attribute selectors on `<html>`; add
  `src/hooks/useTheme.js` (`ThemeProvider`/`useTheme()`, Context per
  `docs/rules.md §6.1`); persist to `localStorage`
  (`theme-color`/`theme-mode`); add a synchronous inline script to
  `index.html` to prevent a flash of the wrong theme before React mounts.
- **Phase 1** — `AppearancePopover` component (Radix Popover, following
  `ColorPickerPopover.jsx`'s exact convention), wired onto the sidebar
  avatar. Ships the feature end-to-end for anything already on
  `--color-*`/`--md-*` tokens.
- **Phase 2** — Retrofit `Sidebar/CollapsedView.jsx` (swap `colors.js`
  inline-style usage for `var(--color-*)`) and `features/chat` (cheapest
  raw-hex directories).
- **Phase 3** — Retrofit `components/social/**` (explicitly requested;
  highest-value public surface).
- **Phase 4** — Retrofit remaining public `pages/`/`features/**`.
  `treeLayout.js`/`TreeCanvas.jsx`/etc. (the "never modify" list in
  `docs/design.md`) are layout/logic, not styling, and are out of scope for
  this retrofit regardless.
- **Explicitly out of scope** (own follow-up tickets): the admin panel
  retrofit (authenticated internal tool, heaviest hex + `colors.js` cost in
  the app) and re-authoring the 23 branded on/off sidebar SVGs as
  `currentColor` art so they can participate in theming — today they swap
  whole assets and `docs/design/iconography.md` documents that runtime
  recoloring of this custom art is unreliable.
- Also update `docs/design.md`'s color table + Decisions Log (and
  `docs/design/colors.md`) to describe the new token/theme system,
  replacing the stale `#8B5CF6`-as-primary description left over from
  before `8ea7614`.

### Theme roster

| Name | Seed | Note |
|---|---|---|
| Hub Orange | `#ffa31a` | current live default (Tanoo's `8ea7614` rebrand) |
| Ghost Purple | `#8B5CF6` | former default, pre-`8ea7614` |
| Verdant | green, shifted off the existing semantic `success` green | new |
| Nebula | `#3B82F6` (blue) | new |
| Crimson | `#DC2626` | new |
| Cyan | `#06B6D4` | new |
| Rose | `#EC4899` | new |
| Slate | `#64748B` (neutral/grayscale) | new |

## Follow-up round 2 — light mode was only half-retrofitted (2026-07-26)

Testing the first implementation in a browser showed light mode is broken
across most of the app. Root cause: the retrofit passes only matched two
patterns — the accent family, and pure white (`#fff` / `rgba(255,255,255,α)`).
Everything else stayed hardcoded, so in light mode:

- **The sidebar stays black.** `Sidebar.module.css` and friends set
  `background: #000`/`#0a0a0a`, which no pass touched.
- **The post composer stays black** (`components/social/PostComposer`), as
  do most social surfaces built on `#0a0a0c`/`#1a1a1a`.
- **The chat panel's gradient stays dark** — gradient colour stops were
  never in scope.
- **Notes are unreadable.** Body copy uses near-white *greys*
  (`#e8e0d5`, `#f0eae0`, `#e2e8f0`, `#e0e0e0`) rather than `#fff`, so it
  stayed pale and washed out on the light background — the exact symptom
  the tone-10 body-text change was supposed to fix.

Measured scope of what remains (CSS Modules, excluding `src/content` and
`src/img`):

| Family | Occurrences | Distinct |
|---|---|---|
| Very dark (luminance < 0.06) — background/border candidates | 153 | 27 |
| Very light (luminance > 0.65) — text candidates | 79 | 16 |

Not all of those should be themed. Chromatic light values (`#7fe7ff`,
`#86efac`, `#ffd08a`, `#fde68a`, `#fcd34d`, `#67e8f9`) are syntax-highlight
and status colours and must stay fixed; only the *neutral* ones are body
text. Likewise the mapping has to be property-aware — `#222` is a border in
some rules and a surface in others, and they resolve to different tokens.

Also changed in this round:

- **Default mode is now `dark`, not `system`.** Owner decision: night mode
  is the intended default look, and `system` meant a light-preferring OS
  silently got light mode on first visit.

## Acceptance criteria

- [x] Clicking the sidebar avatar opens an M3-styled **dialog** (animate-ui
      headless Dialog) showing the user's avatar and session id, a
      Light/Dark/System segmented control with icons, a theme dropdown, and
      a custom-colour wheel + hex field.
- [x] Selecting a theme/mode applies instantly (no reload) and updates
      every `--color-*`/`--md-*` consumer live.
- [x] A custom seed colour derives the full tonal set at runtime via
      `derivePalette()` and is persisted alongside the presets.
- [x] Choice persists across a hard refresh and a fresh session
      (`localStorage`), with no flash of the wrong theme on load.
- [x] `system` mode follows the OS `prefers-color-scheme` live, including
      while the dialog/tab stays open.
- [x] Light mode inverts the Starfield: white sky, ink-dark stars and
      comets.
- [x] Accent literals retrofitted to theme-reactive tokens across the
      public app (~394 replacements over 70 files) — Sidebar, chat, social,
      pages and features.
- [x] `docs/design.md` / `docs/design/colors.md` updated to match.
- [ ] Sidebar, post composer, chat panel (incl. its gradient) and note
      body copy all follow light mode. *(round 2)*
- [ ] Neutral dark backgrounds and neutral light text greys retrofitted
      property-aware; chromatic syntax/status colours left fixed. *(round 2)*
- [x] Default mode is `dark`. *(round 2)*
- [x] Dynamic Island stays black in every theme and mode, contents included
      — the round-2 retrofit had themed it and was reverted. In light mode
      it drops the dark glow and keeps only the hairline edge. *(round 3)*
- [x] Sidebar avatar shows a pointer cursor, brightens on hover, and is
      keyboard-operable (`role="button"`, Enter/Space). *(round 3)*
- [ ] Verified in a real browser (blocked in the dev container: no
      Chromium/Playwright, Node 18 < Playwright's minimum). Round 1 shipped
      unverified and the gaps above were the consequence.
- [ ] Admin panel retrofit (`pages/admin/**`) — deliberately deferred, see
      "out of scope" above.

## References

- Plan: `/home/moon/.claude/plans/sunny-nibbling-dolphin.md`
- Commit `8ea7614` "Alternative theme #ffa31a" — the undocumented rebrand
  this ticket formalizes into a real, reversible, multi-option system.
- `docs/rules.md §5.2`, `docs/design/colors.md` (Session 10/11 decisions)
  — the "hand-built M3 tokens, no installed library" precedent.
