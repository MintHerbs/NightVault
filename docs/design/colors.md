# Colors

> **Known stale spot (T-062):** the brand accent below is documented as
> `#8B5CF6` ("Ghost Purple"). The live default since commit `8ea7614`
> ("Alternative theme #ffa31a") is `#ffa31a` ("Hub Orange") — Ghost Purple
> is now one of 8 selectable themes, not the default. See
> [docs/design.md](../design.md#appearance-system---color-accent--md--per-theme-x-lightdark)
> for the current, authoritative token/theme system and
> `src/styles/global.css` for the real values; the specific hex mentions
> throughout this page haven't all been swept yet — that's bundled with
> the Phase 2+ retrofit of `colors.js` itself (T-062), since the format
> changes there too (static hex → CSS var references).

The app is a near-black, purple/orange-accented dark theme. Color tokens
currently live in **three separate places** — this page is the full
inventory of all three, because they don't perfectly overlap.

## The three sources

| Source | Scope | Format |
|---|---|---|
| [src/constants/colors.js](../../src/constants/colors.js) | JS-importable token object, used where a component needs a color value in JS (not just CSS) | JS object |
| [src/styles/global.css](../../src/styles/global.css) `:root` | Global CSS variables, available everywhere | CSS custom properties |
| [src/styles/adminTokens.css](../../src/styles/adminTokens.css) `:root` | Admin panel's own expanded token set (states, overlays, shadows) | CSS custom properties |

**Known divergence:** these three are hand-maintained in parallel, not
generated from one source. Core brand colors (`#8B5CF6`, `#EA6C0A`,
`#000000`) agree across all three. Naming does not always agree — e.g.
`colors.js` has `panel: '#1a1a2e'` while `global.css` calls the same value
`--bg-card`. Treat `global.css` as authoritative for anything rendered
outside `/admin`, and `adminTokens.css` as authoritative inside `/admin`.
If you add a new brand color, update all three or note why one is
intentionally excluded.

## Brand tokens (`src/constants/colors.js`)

| Token | Value | Usage |
|---|---|---|
| `accent` | `#8B5CF6` | Primary purple — headings, buttons, active states, borders |
| `orange` | `#EA6C0A` | Secondary accent — Database/Logic group active states |
| `bg` | `#000000` | Page background |
| `surface` | `#0f0f0f` | Input backgrounds, card surfaces |
| `card` | `#0a0a0a` | Card backgrounds (slightly darker than surface) |
| `panel` | `#1a1a2e` | Panel backgrounds (tree/chat "other" bubble) |
| `border` | `#222222` | Subtle borders |
| `text` | `#ffffff` | Primary text |
| `textMuted` | `rgba(255,255,255,0.6)` | Secondary text |
| `error` | `#ef4444` | Error states |
| `warning` | `#facc15` | Warning states |
| `success` | `#22c55e` | Online indicator, success states |
| `iconOff` | `rgba(255,255,255,0.38)` | Inactive sidebar icons |
| `iconHover` | `rgba(255,255,255,0.75)` | Hovered sidebar icons |
| `iconActive` | `#8B5CF6` | Active sidebar icon (in-app tools) |
| `iconActiveAlt` | `#EA6C0A` | Active sidebar icon (external tools / group parents) |

## Global CSS variables (`src/styles/global.css`)

```css
--color-bg: #000000;
--color-accent: #8B5CF6;
--color-orange: #EA6C0A;
--color-star: #ffffff;       /* Starfield dots only */
--color-muted: #555555;
--color-surface: #0f0f0f;
--color-border: #222222;

--color-chat-own: #1A1A1A;
--color-chat-other: #1a1a2e;

/* Tree page (pre-dates the shared token set — do not "fix" without checking treeLayout.js) */
--bg-dark: #0d0d0d;
--bg-card: #1a1a2e;
--bg-panel: #111122;
--bg-controls: #111;
--border-subtle: #2a2a4a;
--border-highlight: #4f8ef7;
--text-primary: #ffffff;
--text-muted: #999;
--pointer-slot: #252540;
--accent-blue: #4f8ef7;
--accent-orange: #ff9f43;
--accent-green: #26de81;
--edge-color: #555;
```

The tree-page block is its own palette (blues/oranges/greens tuned for the
B+ tree canvas) — it does not track the brand purple/orange and that's
intentional; don't merge it into the brand tokens without checking
`treeLayout.js` and `TreeCanvas.jsx` first (both are on the
["never modify" list](../design.md#files-that-must-never-be-modified)).

## Material You tokens (`--md-*`)

A Material Design 3 dark scheme, defined in
[global.css](../../src/styles/global.css) and mirrored as the `md` export in
[colors.js](../../src/constants/colors.js). It is **seeded from the existing
brand purple** (`#8B5CF6` = `--md-primary`), not from Material's baseline
palette, so the tonal roles stay on-brand.

Currently consumed by [`ui/Card`](../../src/components/ui/Card/Card.jsx)
only — the landing page tool cards. It is a token set plus hand-built CSS
Modules, **not** an installed MD3 library; MUI / `@material/web` remain out
of bounds per [rules.md §5.2](../rules.md).

| Group | Tokens | Notes |
|---|---|---|
| Surface containers | `--md-surface-container-low` `#131117`, `--md-surface-container` `#1a171f`, `--md-surface-container-high` `#241f2b` | M3 elevation is **tonal**, not shadow-based — a raised surface is a lighter tone, not a drop shadow |
| Primary | `--md-primary` `#8B5CF6`, `--md-on-primary` `#ffffff` | `--md-primary` is the same value as `--color-accent` |
| Primary container | `--md-primary-container` `#2e2148`, `--md-on-primary-container` `#d9c8ff` | The tonal chip behind an icon |
| Text | `--md-on-surface` `#eae5ef`, `--md-on-surface-variant` `#c9c2d2` | Primary vs secondary text on a surface container |
| Outline | `--md-outline-variant` `#2c2833` | Hairline dividers on tonal surfaces |
| State layers | `--md-state-hover` `0.08`, `--md-state-focus` `0.10`, `--md-state-pressed` `0.12` | M3 spec opacities. Interaction = a tonal overlay, **not** a transform/lift |
| Shape scale | `--md-shape-sm` `8px`, `-md` `12px`, `-lg` `16px`, `-xl` `28px` | Cards use `--md-shape-lg` |
| Motion | `--md-easing-emphasized` `cubic-bezier(0.2, 0, 0, 1)`, `--md-duration-short` `200ms`, `--md-duration-medium` `350ms` | Durations sit inside the bands in [motion.md](motion.md) |

**Rule:** an M3 surface never gets a border *and* a tonal fill — pick filled
(`--md-surface-container`, no border) or outlined (`--md-outline-variant`
hairline over the page background). The card primitive is filled.

**Rule:** hover/press feedback on an M3 component is a state layer, never a
`translateY` lift or a `scale`. If you reach for the ripple primitive
([`animate-ui/primitives/buttons/ripple`](../../src/components/animate-ui/primitives/buttons/ripple.tsx)),
neutralise its `hoverScale` default to `1`.

## Admin panel tokens (`src/styles/adminTokens.css`)

A much larger set — the admin panel needs hover/active/soft/border variants
that the public-facing pages don't. All admin components should pull from
this file rather than inventing new rgba() values inline.

**Base:**
`--color-bg`, `--color-surface`, `--color-card`, `--color-panel`,
`--color-border`, `--color-border-subtle`, `--color-accent`,
`--color-accent-hover` (`#7c3aed`), `--color-accent-bright` (`#a78bfa`),
`--color-orange`, `--color-text` + 5 opacity steps (`-muted`, `-faint`,
`-soft`, `-medium`, `-strong`), `--color-icon` + `-muted`.

**State colors:** `--color-error` / `-hover` / `-soft` / `-border`,
`--color-warning`, `--color-success` / `-bright` / `-soft` / `-badge` /
`-border`.

**Overlays & hover:** `--color-overlay` (`rgba(0,0,0,0.4)`) / `-strong`
(`0.8`) / `-soft` (`0.2`); `--color-hover` / `-faint` / `-strong` /
`-barely` — four graduated opacity steps of white for hover states;
`--color-input` (`rgba(255,255,255,0.05)`).

**Accent opacity ramp:** `--color-accent-barely` (`0.05`) →
`-soft` (`0.08`) → `-muted` (`0.1`) → `-selected` (`0.12`) →
`-active` (`0.15`) → `-badge` (`0.2`) → `-scroll` (`0.3`) →
`-scroll-hover` (`0.5`). Use this ramp instead of picking an arbitrary
opacity when a new admin UI state needs a purple tint.

**Shadows:** `--shadow-sm` / `-md` / `-lg` — increasing blur/spread black
shadows for elevation.

**Short aliases** (for components ported from the public site, so they
don't need a rewrite): `--bg`, `--surface`, `--card`, `--panel`, `--border`,
`--accent`, `--orange`, `--text`, `--text-muted`, `--error`, `--warning`,
`--success` — all just repoint to the `--color-*` versions above.

**KaTeX overrides:** `adminTokens.css` also forces KaTeX's math-rendering
output to `--color-text` so formulas stay legible on the dark background
(see the `.katex *` rules at the bottom of the file) — needed because
KaTeX ships light-theme-only default styles.

## Usage rules

- **No new colors without updating a token file first** — never inline a
  new hex/rgba value in a component's CSS module.
- **Dynamic Island pill is always `#000`** — never purple or orange.
- **Orange (`#EA6C0A`)** is exclusively for primary nav group active states
  (Database / Logic / Algorithms / More Tools) and the GPA Calculator.
- **Purple (`#8B5CF6`)** is for child tool active states within a group, and
  the general brand accent everywhere else (buttons, links, focus rings).
- Inside `/admin`, prefer the `adminTokens.css` opacity ramps over ad-hoc
  `rgba()` so new states stay visually consistent with existing ones.
