# Architecture Update — Proposed Project Structure

> Status: **Proposal**. This document describes the target structure the
> project is moving toward. No files have been moved yet — see
> [Migration Plan](#migration-plan) at the bottom for the phased approach.
>
> Last updated: 2026-05-09

---

## 1. Why this update

The repository has grown from a single-tool B+ tree visualizer into a
multi-tool teaching app (B+ Tree, ERD, Complexity, Logic Proof, Tableaux,
Chat). The current layout was scaled "by accretion" and now has several
real problems:

### 1.1 Symptoms in the working tree

| Symptom | Where | Impact |
|---|---|---|
| Two `Sidebar` components live in the tree, only one is used | [src/components/Sidebar/](../src/components/Sidebar/) and [src/components/layout/Sidebar/](../src/components/layout/Sidebar/) | Confusion for new contributors, dead code |
| Empty placeholder folders | [src/server/](../src/server/), [src/model/](../src/model/), [test/](../test/) | Suggests structure that does not exist |
| Naming convention is mixed at the same depth | `TreeCanvas/` (PascalCase) next to `animated-text/`, `dynamic-island/`, `smoothui/` (kebab-case) | No predictable rule for "where do I put a new component" |
| Feature-grouped folders mixed with single-component folders at the same level | `components/chat/`, `components/logic/`, `components/algo/`, `components/landing/`, `components/layout/` mixed with `components/TreeCanvas/`, `components/TreeNode/`, `components/ERDCanvas/`, … | Two organising principles fighting each other |
| `.tsx` files in a JS-only project | [src/components/smoothui/](../src/components/smoothui/) (`glow-hover-card`, `grid-loader`, `scramble-hover`) | Build inconsistency, contributor confusion |
| Tests scattered across three places (and none of them runs) | [src/hooks/hooks.test.jsx](../src/hooks/hooks.test.jsx), [src/lib/treeLayout.test.js](../src/lib/treeLayout.test.js), [src/test/](../src/test/) (untracked), [test/](../test/) (empty) | Issue [#9](https://github.com/MintHerbs/b-tree/issues/9), [#16](https://github.com/MintHerbs/b-tree/issues/16) |
| Schema lives as one ad-hoc file at repo root | [supabase_messages_table.sql](../supabase_messages_table.sql) | No history, no ordering, only one of several tables (`sessions`, `api_calls` are also referenced from code but have no SQL anywhere) |
| Sensitive backend logic runs in the browser | [src/lib/geminiService.js](../src/lib/geminiService.js) calls Gemini directly with a `VITE_`-inlined key | Issue [#12](https://github.com/MintHerbs/b-tree/issues/12) — **High severity** |
| `documentation.md.backup` at repo root | [documentation.md.backup](../documentation.md.backup) | Looks like a working file someone forgot to delete |
| Manual route table in `App.jsx` | [src/App.jsx](../src/App.jsx) | Issue [#6](https://github.com/MintHerbs/b-tree/issues/6) |

### 1.2 Constraints driving the design

- **Vite, not Next.js.** Vite has no built-in file-system routing. Any
  "routes are derived from the filesystem" outcome needs an explicit
  plugin (`vite-plugin-pages` is the leading candidate — see
  Issue [#6](https://github.com/MintHerbs/b-tree/issues/6)).
- **Vercel deployment.** Vercel serverless functions live under `/api`
  at the repo root. That is the natural home for the Gemini proxy that
  Issue [#12](https://github.com/MintHerbs/b-tree/issues/12) requires.
- **JavaScript only.** No TypeScript files should land in `src/`. The
  three `.tsx` files in `smoothui/` need to be ported to `.jsx`.
- **CSS Modules.** Already the convention; keep it.

---

## 2. Target structure

```
b-tree/
│
├── api/                              # Vercel serverless functions — server-side, secrets stay here
│   ├── gemini.js                     # POST /api/gemini  → proxy to Google Generative AI
│   ├── chat.js                       # (future) any chat moderation / rate-limit endpoints
│   └── _lib/                         # Shared backend code (Vercel ignores `_`-prefixed dirs as routes)
│       ├── geminiClient.js
│       ├── rateLimiter.js
│       └── supabaseAdmin.js          # Service-role Supabase client (server only)
│
├── db/                               # Database schema & migrations (Supabase)
│   ├── migrations.yaml               # Ordered manifest of migrations (see §4)
│   ├── sql/
│   │   ├── 0001_init_messages.sql
│   │   ├── 0002_init_sessions.sql
│   │   ├── 0003_init_api_calls.sql
│   │   └── 0004_realtime_publications.sql
│   ├── seeds/                        # Optional dev/test seed data
│   │   └── dev_messages.sql
│   └── README.md                     # How to apply migrations against a Supabase project
│
├── docs/
│   ├── architecture-update.md        # ← this document (target structure)
│   ├── architecture/
│   │   ├── overview.md               # 1-page system map: client ↔ /api ↔ Supabase ↔ Gemini
│   │   ├── data-flow.md              # Page → hook → engine → canvas pipeline (per feature)
│   │   ├── routing.md                # How routing is wired and how to add a page
│   │   └── state.md                  # State-management conventions
│   ├── adr/                          # Architecture Decision Records (one per major choice)
│   │   ├── 0001-vite-no-ssr.md
│   │   ├── 0002-css-modules.md
│   │   ├── 0003-feature-folders.md
│   │   └── 0004-server-proxy-for-gemini.md
│   ├── runbooks/                     # Operational guides
│   │   ├── rotate-keys.md
│   │   ├── apply-db-migrations.md
│   │   └── local-supabase.md         # Local Supabase in Docker (planned, not yet implemented)
│   └── contributing.md               # Linked from CONTRIBUTING.md at root
│
├── public/                           # Static assets served as-is at the site root
│   └── favicon.svg
│
├── src/
│   ├── main.jsx                      # Vite entry
│   ├── App.jsx                       # Router shell only — no per-page logic
│   │
│   ├── routes/                       # Route configuration
│   │   └── index.jsx                 # Either hand-rolled or generated by vite-plugin-pages
│   │
│   ├── pages/                        # One folder per route, page-level component + CSS
│   │   ├── tree/
│   │   │   ├── TreePage.jsx
│   │   │   └── TreePage.module.css
│   │   ├── erd/
│   │   ├── complexity/
│   │   ├── logic/
│   │   │   ├── proof/
│   │   │   └── tableaux/
│   │   ├── about/
│   │   └── disclaimer/
│   │
│   ├── features/                     # Feature-scoped code (the bulk of the app)
│   │   ├── tree/
│   │   │   ├── components/           # TreeCanvas, TreeNode, TreeEdge, PointerArrow,
│   │   │   │                         # OperationsPanel, StepControls
│   │   │   ├── hooks/                # useBPlusTree, useAnimationPlayer
│   │   │   ├── lib/                  # BPlusTree.js, treeLayout.js
│   │   │   └── engine/               # AnimationEngine.js
│   │   ├── erd/
│   │   │   ├── components/           # ERDCanvas, ERDStep1, ERDStep2, ERDStep3, ERDChoiceCards
│   │   │   ├── hooks/
│   │   │   └── lib/                  # erdParser, erdLayout, erdPromptBuilder
│   │   ├── complexity/
│   │   │   ├── components/           # ComplexityCodeView, ComplexityInput, ComplexityTerminal
│   │   │   └── lib/                  # complexityEngine, complexityParser, complexityAlgebra,
│   │   │                             # complexityEngineHelpers, complexityTypes
│   │   ├── logic/
│   │   │   ├── components/           # ProofTreeCanvas, TableauxCanvas, ResolutionCanvas,
│   │   │   │                         # RulesPanel, LogicRulesPanel, InferenceRulesDrawer,
│   │   │   │                         # SymbolBar, LogicInputPage, LogicStepControls,
│   │   │   │                         # TranslationResult
│   │   │   ├── lib/                  # formulaParser, proofEngine, tableauxEngine, parser,
│   │   │   │                         # translator, validator
│   │   │   └── engine/               # ProofEngine, ResolutionEngine, TableauxEngine (currently stubs)
│   │   └── chat/
│   │       ├── components/           # ChatPanel, ChatBubble, ChatAvatar, ChatInput
│   │       └── hooks/                # useChat
│   │
│   ├── components/                   # Shared, cross-feature UI
│   │   ├── ui/                       # Generic primitives (no domain knowledge)
│   │   │   ├── PillInput/
│   │   │   ├── InputBox/
│   │   │   ├── PaginationDots/
│   │   │   └── ScrambleText/
│   │   ├── layout/                   # App shell — visible on every route
│   │   │   ├── Sidebar/              # The canonical one (today's `layout/Sidebar`)
│   │   │   ├── Navbar/
│   │   │   ├── DynamicIsland/
│   │   │   └── MusicPlayer/
│   │   └── effects/                  # Decorative / animated primitives
│   │       ├── Starfield/
│   │       ├── HeroText/
│   │       └── smoothui/             # AgentAvatar, GlowHoverCard, GridLoader,
│   │                                 # ScrambleHover, NotificationBadge — all `.jsx`
│   │
│   ├── hooks/                        # Cross-cutting hooks (used by ≥2 features or by App)
│   │   ├── usePresence.js
│   │   └── useApiCalls.js            # See §3 for why this stays for now
│   │
│   ├── lib/                          # Cross-cutting utilities
│   │   ├── api/                      # Client for our own /api endpoints (replaces direct Gemini call)
│   │   │   └── gemini.js             # `callGemini(prompt)` → fetch('/api/gemini', …)
│   │   ├── supabase/
│   │   │   └── client.js             # Anon-key Supabase client (browser)
│   │   └── utils/
│   │       └── index.js
│   │
│   ├── config/                       # Static config (no runtime data)
│   │   └── songs.js
│   │
│   ├── styles/
│   │   └── global.css
│   │
│   └── assets/                       # Images consumed via `import` (vs. /public for raw URLs)
│       └── img/                      # Today's `src/img/` contents
│
├── tests/                            # Single source of truth for tests (Vitest + Testing Library)
│   ├── unit/
│   │   ├── engine/
│   │   │   └── AnimationEngine.test.js
│   │   ├── features/
│   │   │   ├── tree/
│   │   │   └── erd/
│   │   └── lib/
│   ├── integration/
│   └── setup.js                      # jsdom + RTL matchers
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # Lint, build, test on PR + push to main (Issue #9)
│
├── .env.example                      # Tracked. Lists every var, no values (Issue #8)
├── .gitignore                        # Without the broad `*.md` rule (Issue #14)
├── README.md
├── CONTRIBUTING.md                   # Issue #8
├── LICENSE.md
├── SECURITY.md                       # Disclosure policy
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── vercel.json
```

---

## 3. Organising principles

These rules decide where any new file goes. When in doubt, prefer the rule
on top.

### 3.1 Server vs. client

- **`/api/`** — anything that needs a secret, talks to a service-role
  client, or enforces quotas the user must not bypass. Vercel runs each
  file as a serverless function. This is where the Gemini proxy
  ([Issue #12](https://github.com/MintHerbs/b-tree/issues/12)) and the
  server-side rate limiter
  (currently in [src/hooks/useApiCalls.js](../src/hooks/useApiCalls.js))
  go.
- **`src/`** — runs in the user's browser. Treat every value here as
  public. No `VITE_GEMINI_API_KEY` references survive the migration.
- **`db/`** — declarative schema. Neither client nor server code lives
  here.

The empty [src/server/](../src/server/) directory should be **deleted** —
its intent (server-side code) is served by `/api/`, not by something
inside the bundled client tree. Same for [src/model/](../src/model/),
which never developed a clear purpose.

### 3.2 Feature-first, not type-first

The current layout puts every component under `src/components/` and every
hook under `src/hooks/`. That works for ~10 components; it stops working
at 50+. Five features now share that flat namespace and "what does
`OperationsPanel` belong to?" is no longer obvious from the path.

The proposed `src/features/<feature>/` rule:

- A component is in `features/<feature>/` if removing the feature would
  also remove the component.
- It is in `components/` (the shared bucket) if it is reused by ≥2
  features, or by app-level shell (Sidebar, Navbar, etc.).
- The same applies to hooks and lib code.

This makes deletion cheap: removing a feature = `rm -rf
src/features/<feature> src/pages/<feature>` and a couple of route edits.

### 3.3 Three buckets inside shared `components/`

`components/` is split into **`ui/`**, **`layout/`**, **`effects/`** so
the bucket itself answers "is this thing visible everywhere or only on
one page?".

- **`ui/`** — generic atoms. No knowledge of routes, features, or app
  state. `PillInput`, `InputBox`, `PaginationDots`, `ScrambleText`.
- **`layout/`** — pieces of the app shell that persist across routes.
  `Sidebar`, `Navbar`, `DynamicIsland`, `MusicPlayer`. The duplicate
  `components/Sidebar/` is **deleted**; the canonical one is
  `components/layout/Sidebar/`.
- **`effects/`** — decorative / animated primitives. `Starfield`,
  `HeroText`, `smoothui/*`. These exist to make the app feel alive and
  could be removed wholesale without breaking functionality.

### 3.4 Naming conventions (one rule, applied everywhere)

- **Component folders and component files:** `PascalCase`
  (`TreeCanvas/TreeCanvas.jsx`).
- **Hook files:** `camelCase` starting with `use`
  (`useBPlusTree.js`).
- **Lib / engine files:** `camelCase` (`erdParser.js`,
  `complexityEngine.js`).
- **Folders that are buckets, not components:** `lowercase`
  (`features/tree/components/`, `lib/api/`).

Today's folders to rename: `animated-text/` → `ScrambleText/` (and move
to `components/ui/ScrambleText/`); `dynamic-island/` →
`DynamicIsland/` (and move to `components/layout/DynamicIsland/`);
`smoothui/agent-avatar/` → `smoothui/AgentAvatar/`, and so on for the
rest of `smoothui/`.

### 3.5 No `.tsx` in a JS project

The three `.tsx`-only files in `smoothui/` (`glow-hover-card`,
`grid-loader`, `scramble-hover`) need to be ported to `.jsx`. Vite tolerates
`.tsx` without `tsconfig.json`, but mixing the two means two different module
resolution rules in one tree.

The cost this section warned about was not hypothetical. `agent-avatar/` carried
both an `index.jsx` and an `index.tsx`; Vite resolved `.jsx` first, so the
`.tsx` was dead, unimportable (it referenced a `@repo/shadcn-ui` package this
repo does not have) and had silently drifted from the live file, losing the
circle-clip fix and the IntersectionObserver gating. It was deleted in T-099,
and the seed-to-pixels maths it duplicated now lives in a single
`agent-avatar/generator.js` that both the avatar and Sentinel's boot sequence
import.

---

## 4. Database migrations: `db/` with a YAML manifest

Today, [supabase_messages_table.sql](../supabase_messages_table.sql) is
the only schema file in the repo. Two other tables (`sessions`,
`api_calls`) are referenced from code without any matching SQL.

### 4.1 Layout

```
db/
├── migrations.yaml
├── sql/
│   ├── 0001_init_messages.sql
│   ├── 0002_init_sessions.sql
│   ├── 0003_init_api_calls.sql
│   └── 0004_realtime_publications.sql
├── seeds/
│   └── dev_messages.sql
└── README.md
```

### 4.2 The manifest (`db/migrations.yaml`)

The YAML is the **ordering authority** — `sql/` is just the file content.
This separation lets us record metadata (author, purpose, applied-on
dates, dependencies) without polluting the SQL.

```yaml
# db/migrations.yaml
# Migrations are applied top-to-bottom. Once applied to production,
# never edit a row — add a new migration that supersedes it.
project: b-tree
schema_version: 4

migrations:
  - id: "0001"
    file: sql/0001_init_messages.sql
    description: "Create messages table for the chat feature, with RLS and realtime publication"
    author: Atish J
    created: 2026-05-08
    applied_envs: [dev, staging, prod]
    related_issues: []

  - id: "0002"
    file: sql/0002_init_sessions.sql
    description: "Create sessions table used by usePresence (online-count pill)"
    author: Atish J
    created: 2026-05-09
    applied_envs: [dev]
    related_issues: []

  - id: "0003"
    file: sql/0003_init_api_calls.sql
    description: "Create api_calls table for per-session Gemini quota (10/day)"
    author: Moon
    created: 2026-05-09
    applied_envs: [dev]
    related_issues: [12]

  - id: "0004"
    file: sql/0004_realtime_publications.sql
    description: "Add messages to supabase_realtime publication (split out so realtime config lives in one place)"
    author: Moon
    created: 2026-05-09
    applied_envs: [dev]
    related_issues: []
```

### 4.3 SQL file conventions

- **Idempotent.** Every statement uses `CREATE … IF NOT EXISTS`,
  `CREATE OR REPLACE`, or `DROP … IF EXISTS` so the file can be re-run.
- **One concern per file.** A migration introduces one table, one set of
  related policies, or one publication change — not all three.
- **Numbered with 4 digits** (`0001`, `0002`, …). 4 digits buys us 9999
  migrations before we have to renumber, which is more than enough.
- **The current `supabase_messages_table.sql` is split.** Its three
  concerns (table, RLS policies, realtime publication) become 0001 and
  0004. The verification queries and the "production recommendations"
  comments move to `db/README.md`.

### 4.4 Application

A small helper script (Node, calling `psql` via Supabase's connection
string) reads `migrations.yaml`, walks the list, and applies each file
to the configured environment. The exact tooling is a follow-up — the
shape above is the persistence layer that any tool can read.

---

## 5. UI component categorisation — the table

For reference, here is exactly where each existing component should land.

### 5.1 Feature: Tree

Move from `src/components/<X>/` to `src/features/tree/components/<X>/`:

- `TreeCanvas/`
- `TreeNode/`
- `TreeEdge/`
- `PointerArrow/`
- `OperationsPanel/`
- `StepControls/`

Move from `src/hooks/` to `src/features/tree/hooks/`:

- `useBPlusTree.js`
- `useAnimationPlayer.js`

Move from `src/lib/` to `src/features/tree/lib/`:

- `BPlusTree.js`, `treeLayout.js`

Move from `src/engine/AnimationEngine.js` to
`src/features/tree/engine/AnimationEngine.js`. (Issue
[#7](https://github.com/MintHerbs/b-tree/issues/7) covers the rewrite of
this engine.)

### 5.2 Feature: ERD

Move from `src/components/<X>/` to `src/features/erd/components/<X>/`:

- `ERDCanvas/` (with `edges.jsx` and `shapes.jsx`)
- `ERDStep1/`, `ERDStep2/`, `ERDStep3/`
- `ERDChoiceCards/`

Move from `src/lib/` to `src/features/erd/lib/`:

- `erdParser.js`, `erdLayout.js`, `erdPromptBuilder.js`

### 5.3 Feature: Complexity

Move from `src/components/algo/<X>/` to
`src/features/complexity/components/<X>/`:

- `ComplexityCodeView/`, `ComplexityInput/`, `ComplexityTerminal/`

Move from `src/lib/algo/` to `src/features/complexity/lib/`:

- `complexityEngine.js`, `complexityParser.js`, `complexityAlgebra.js`,
  `complexityEngineHelpers.js`, `complexityTypes.js`

### 5.4 Feature: Logic

Move from `src/components/logic/` to `src/features/logic/components/`:

- All current files (`LogicInputPage.jsx`, `LogicStepControls.jsx`,
  `SymbolBar.jsx`, `InferenceRulesDrawer/`, `LogicRulesPanel/`,
  `ProofTreeCanvas/`, `ResolutionCanvas/`, `RulesPanel/`,
  `TableauxCanvas/`, `TranslationResult/`)

Move from `src/lib/logic/` to `src/features/logic/lib/`:

- `formulaParser.js`, `proofEngine.js`, `tableauxEngine.js`,
  `parser.js`, `translator.js`, `validator.js`

Move from `src/engine/logic/` to `src/features/logic/engine/`:

- `ProofEngine.js`, `ResolutionEngine.js`, `TableauxEngine.js` (these
  are stubs today — leave them for the engine work in their respective
  pages)

### 5.5 Feature: Chat

Move from `src/components/chat/<X>/` to
`src/features/chat/components/<X>/`:

- `ChatPanel/`, `ChatBubble/`, `ChatAvatar/`, `ChatInput/`

Move from `src/hooks/` to `src/features/chat/hooks/`:

- `useChat.js`

### 5.6 Shared layout (visible on every route)

Move to `src/components/layout/`:

- `Navbar/` (from `components/Navbar/`)
- `DynamicIsland/` (from `components/dynamic-island/`, renamed to
  PascalCase)
- `MusicPlayer/` (from `components/MusicPlayer/`)
- `Sidebar/` (from `components/layout/Sidebar/`)

**Delete** the orphan `components/Sidebar/` and `components/SidebarIcon/`
— they are not imported anywhere; the layout `Sidebar` brings its own
icons.

### 5.7 Shared UI primitives

Move to `src/components/ui/`:

- `PillInput/`
- `InputBox/`
- `PaginationDots/`
- `ScrambleText/` (from `components/animated-text/ScrambleText.jsx`,
  promoted to its own folder)

### 5.8 Shared effects

Move to `src/components/effects/`:

- `Starfield/`
- `HeroText/`
- `smoothui/` (with `.tsx` ports to `.jsx` and folders renamed to
  PascalCase: `AgentAvatar/`, `GlowHoverCard/`, `GridLoader/`,
  `ScrambleHover/`, `NotificationBadge/`)

### 5.9 Cross-cutting hooks

These stay under `src/hooks/` because they are consumed app-wide:

- `usePresence.js` — used by `App.jsx` for the online-count pill
- `useApiCalls.js` — used wherever AI features are guarded. Will be
  thinned down once the server takes ownership of quota
  ([Issue #12](https://github.com/MintHerbs/b-tree/issues/12)).

### 5.10 Landing components

`components/landing/CodePillInput/` is only used in one place. If it is
unique to a landing experience, fold it into `src/pages/landing/`. If
it is just a styled input, move it to `components/ui/CodePillInput/`.
Audit during the migration.

---

## 6. Resolving open issues with this structure

| Issue | How the new structure helps |
|---|---|
| [#6](https://github.com/MintHerbs/b-tree/issues/6) File-system routing | `src/pages/` is structured so `vite-plugin-pages` can derive routes verbatim; nested folders (`logic/proof`, `logic/tableaux`) already produce the right URL shape |
| [#7](https://github.com/MintHerbs/b-tree/issues/7) Animation engine | Moves to `features/tree/engine/`; tests move to `tests/unit/engine/` |
| [#8](https://github.com/MintHerbs/b-tree/issues/8) Contributor docs | `docs/architecture/`, `docs/contributing.md`, root `CONTRIBUTING.md` and `.env.example` are in the layout |
| [#9](https://github.com/MintHerbs/b-tree/issues/9) Tests + CI | Single `tests/` tree at root; `.github/workflows/ci.yml` |
| [#10](https://github.com/MintHerbs/b-tree/issues/10) Branch protection | Pre-requisite (CI must exist first) — independent of file layout |
| [#11](https://github.com/MintHerbs/b-tree/issues/11) `.env` committed | `.env.example` (tracked) + tighter `.gitignore` (Issue #14) |
| [#12](https://github.com/MintHerbs/b-tree/issues/12) Gemini key in client | `/api/gemini.js` proxy + `lib/api/gemini.js` client. **The single largest reason `/api` and `server-only` separation matters** |
| [#13](https://github.com/MintHerbs/b-tree/issues/13) Error state never resets | Pure logic fix — independent of layout |
| [#14](https://github.com/MintHerbs/b-tree/issues/14) `.gitignore` excludes all md | Replace `*.md` with targeted ignores |
| [#15](https://github.com/MintHerbs/b-tree/issues/15) Starfield setTimeout leak | Pure logic fix — `Starfield` lands in `components/effects/Starfield/` regardless |
| [#16](https://github.com/MintHerbs/b-tree/issues/16) Test relocation | Replaced wholesale by `tests/` at root with real Vitest tests |

---

## 7. Migration plan

The structural change is large but each step is independently shippable.

### Phase 0 — Stop the bleeding (urgent, security)

1. **Rotate keys** ([#11](https://github.com/MintHerbs/b-tree/issues/11)).
2. **Add `.env` to `.gitignore`** and remove from history
   ([#11](https://github.com/MintHerbs/b-tree/issues/11)).
3. **Fix `.gitignore` `*.md` rule** ([#14](https://github.com/MintHerbs/b-tree/issues/14))
   so docs can land.
4. **Add `.env.example`** ([#8](https://github.com/MintHerbs/b-tree/issues/8)).

### Phase 1 — Documentation foundation (this PR family)

1. Land this `docs/architecture-update.md`.
2. Add `docs/architecture/overview.md` (system map).
3. Add `docs/contributing.md` and root `CONTRIBUTING.md`.
4. Add `docs/runbooks/rotate-keys.md` and
   `docs/runbooks/apply-db-migrations.md`.

No source files move yet — these PRs are pure docs and unblock new
contributors immediately.

### Phase 2 — Database hygiene

1. Create `db/sql/0001_init_messages.sql` (split from
   [supabase_messages_table.sql](../supabase_messages_table.sql)).
2. Create `db/sql/0002_init_sessions.sql` and `db/sql/0003_init_api_calls.sql`
   reverse-engineered from current code references.
3. Create `db/sql/0004_realtime_publications.sql`.
4. Add `db/migrations.yaml` with all four entries.
5. Delete the root `supabase_messages_table.sql` and
   `documentation.md.backup`.

### Phase 3 — Server boundary (`/api`)

1. Add `/api/gemini.js` with non-`VITE_` env var.
2. Move quota enforcement from
   [src/hooks/useApiCalls.js](../src/hooks/useApiCalls.js) into
   `/api/_lib/rateLimiter.js`.
3. Replace [src/lib/geminiService.js](../src/lib/geminiService.js)
   internals with a `fetch('/api/gemini', …)` call.
4. Verify `dist/` no longer contains the key
   ([Issue #12](https://github.com/MintHerbs/b-tree/issues/12) acceptance).
5. Delete the placeholder [src/server/](../src/server/) and
   [src/model/](../src/model/) directories.

### Phase 4 — Test infrastructure

1. Add Vitest, jsdom, RTL.
2. Move existing test files to `tests/unit/…` and rewrite them as real
   tests ([Issue #9](https://github.com/MintHerbs/b-tree/issues/9)).
3. Add `.github/workflows/ci.yml` running build + test on PR.
4. Add branch protection ([Issue #10](https://github.com/MintHerbs/b-tree/issues/10))
   once CI is green.

### Phase 5 — Source-tree restructure (the big move)

This phase is one PR per feature, each isolated:

1. Move `tree` feature (§5.1).
2. Move `erd` feature (§5.2).
3. Move `complexity` feature (§5.3).
4. Move `logic` feature (§5.4).
5. Move `chat` feature (§5.5).
6. Restructure `components/` into `ui/` / `layout/` / `effects/` (§5.6–5.8).
7. Port `smoothui` `.tsx` → `.jsx`.
8. Delete duplicate `Sidebar/` and `SidebarIcon/`.

Each PR updates only its own imports and the routes that consume it.

### Phase 6 — File-system routing

Once `pages/` is the only place top-level routes are defined, install
`vite-plugin-pages` and remove the manual route table from `App.jsx`
([Issue #6](https://github.com/MintHerbs/b-tree/issues/6)).

---

## 8. Out of scope

Things this update **deliberately does not** address:

- TypeScript migration. The whole project stays on JS for now.
- SSR / SSG. Vite SPA stays.
- State management library (Redux, Zustand, etc.). Today's
  hooks-and-props approach is fine at the current scale.
- Storybook or component playground.
- Monorepo split (e.g. extracting `lib/` into a publishable package).

These are reasonable future steps but tracking them now would make the
target moving.

---

## 9. References

- Open issues: [#6](https://github.com/MintHerbs/b-tree/issues/6),
  [#7](https://github.com/MintHerbs/b-tree/issues/7),
  [#8](https://github.com/MintHerbs/b-tree/issues/8),
  [#9](https://github.com/MintHerbs/b-tree/issues/9),
  [#10](https://github.com/MintHerbs/b-tree/issues/10),
  [#11](https://github.com/MintHerbs/b-tree/issues/11),
  [#12](https://github.com/MintHerbs/b-tree/issues/12),
  [#13](https://github.com/MintHerbs/b-tree/issues/13),
  [#14](https://github.com/MintHerbs/b-tree/issues/14),
  [#15](https://github.com/MintHerbs/b-tree/issues/15),
  [#16](https://github.com/MintHerbs/b-tree/issues/16)
- Vite docs on env vars: https://vitejs.dev/guide/env-and-mode.html
- Vercel functions: https://vercel.com/docs/functions
- vite-plugin-pages: https://github.com/hannoeru/vite-plugin-pages
- Supabase migrations: https://supabase.com/docs/guides/cli/local-development#database-migrations
