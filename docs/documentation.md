# documentation.md — Mooner.dev Component & Architecture Reference

This file is maintained by the development agent. Update it after every task.
It is the single source of truth for what exists in the codebase.

## How-to guides

- [Adding a new page](architecture/adding-a-page.md) — use the `PageShell` wrapper (landing / result / content variants) instead of hand-rolling per-page layouts.

## Other reference folders

- [docs/design/](design/) — full design-language reference (colors, typography, motion, components, iconography), expanding on [docs/design.md](design.md).
- [tickets/](../tickets/) — individual bug/feature tickets tracked outside GitHub Issues.
- [epics/](../epics/) — groups of related tickets toward a larger outcome.

---

## Project Overview

Mooner.dev is a multi-tool academic visualizer for computer science students.
Built with Vite + React, hosted on Vercel, Supabase for presence tracking.

Current tools:
- **B+ Tree Visualizer** (`/tree`) — animated step-by-step B+ tree construction
- **ERD Builder** (`/erd`) — Chen notation ER diagram from natural language description

Planned tools (not yet implemented):
- Logic tools: Proof Tree, Semantic Tableaux, Resolution Method

---

## Architecture

```
src/
├── App.jsx                    Router shell. Manages global state: aiState, isPlaying.
│                              Renders DynamicIsland, Sidebar, MusicPlayer, ChatPanel
│                              outside all routes. Delegates the route table to ./routes.
│
├── routes/
│   └── index.jsx              Route table. Exports <AppRoutes onAIStateChange onChatOpen />
│                              plus preloadRoutes() for background chunk warming.
│
├── main.jsx                   Vite entry point. Mounts App.
│
├── pages/
│   ├── LandingPage.jsx        Currently redirects to /tree on load. Future: neutral landing.
│   ├── TreePage.jsx           B+ Tree page. Shows landing screen (HeroText + PillInput) when no tree,
│   │                          visualizer (TreeCanvas + OperationsPanel) when tree exists.
│   ├── ERDPage.jsx            ERD builder page. Manages 3-step flow state.
│   └── logic/
│       ├── TranslatePage.jsx  English to Logic translation tool
│       ├── LogicalEquivalencePage.jsx  Logical equivalence proof builder
│       ├── TableauxPage.jsx   Semantic tableaux solver
│       └── ResolutionPage.jsx Resolution method solver
│
├── components/                # Shared, cross-feature UI
│   ├── layout/                # App shell — visible on every route
│   │   ├── Navbar/            Top navigation bar. Shows on /tree and /erd.
│   │   ├── Sidebar/           Two-level nav sidebar. Always visible. See Sidebar section.
│   │   │   ├── NavGroup/      Collapsible navigation group with animated children.
│   │   │   ├── NavGroupIcon/  Primary parent icon button with open/close state.
│   │   │   └── NavChildIcon/  Child icon with tooltip and on/off SVG or Lucide icon.
│   │   ├── DynamicIsland/     Fixed top-center pill. Online count + music + AI states.
│   │   │                      Plus AIStateContent, Observing/Waiting/Thinking/Generating animations.
│   │   └── MusicPlayer/       Hidden YouTube IFrame API player. Controlled via ref.
│   │
│   ├── ui/                    # Generic primitives (no domain knowledge)
│   │   ├── PillInput/         Pill-shaped text input. Triggers AI state on focus.
│   │   ├── InputBox/          Generic styled input box.
│   │   ├── PaginationDots/    Step indicator dots. Props: total, current.
│   │   ├── ScrambleText/      Letter-scramble animated heading text.
│   │   └── CodePillInput/     Expanding pill for code input (used by ComplexityPage).
│   │
│   └── effects/               # Decorative / animated primitives
│       ├── Starfield/         Full-screen canvas starfield animation. Always behind content.
│       ├── HeroText/          Large heading + subtitle. Updates per active tool.
│       └── smoothui/          Third-party animated UI library (agent-avatar, glow-hover-card,
│                              grid-loader, scramble-hover, notification-badge).
│
├── features/                  # Feature-scoped code — removing a feature = rm -rf its folder
│   ├── tree/
│   │   └── components/        TreeCanvas, TreeNode, TreeEdge, PointerArrow,
│   │                          OperationsPanel, StepControls
│   ├── erd/
│   │   └── components/        ERDCanvas (+ shapes.jsx, edges.jsx), ERDStep1/2/3, ERDChoiceCards
│   ├── complexity/
│   │   └── components/        ComplexityCodeView, ComplexityInput, ComplexityTerminal
│   ├── logic/
│   │   └── components/        LogicInputPage, LogicStepControls, SymbolBar,
│   │                          InferenceRulesDrawer, LogicRulesPanel, ProofTreeCanvas,
│   │                          ResolutionCanvas, RulesPanel, TableauxCanvas, TranslationResult
│   └── chat/
│       └── components/        ChatPanel, ChatBubble, ChatAvatar, ChatInput, ChatDimOverlay
│
├── hooks/
│   ├── usePresence.js         Session ID creation + Supabase ping + online count.
│   ├── useApiCalls.js         Tracks Gemini API call count per session. 10 calls / 24h.
│   └── useAnimationPlayer.js  Manages B+ tree step playback: play/pause/prev/next/speed.
│
├── lib/
│   ├── BPlusTree.js           Pure B+ tree data structure. No React.
│   ├── treeLayout.js          Converts B+ tree to x/y coordinates for SVG.
│   ├── erdLayout.js           Converts ERD JSON to x/y coordinates for SVG.
│   ├── erdParser.js           Validates and sanitises ERD JSON from LLM.
│   ├── erdPromptBuilder.js    Builds the LLM prompt string from user question.
│   └── geminiService.js       Calls Gemini API with prompt, returns parsed ERD data.
│
└── engine/
    └── AnimationEngine.js     Produces ordered step array for B+ tree animations.
```

---

## Sidebar Navigation

### Component Hierarchy

```
Sidebar
└── NavGroup (×2: database, logic)
    ├── NavGroupIcon        ← the primary clickable icon
    └── NavChildIcon (×N)  ← child icons, animated in/out
```

### Component Locations

```
src/components/layout/Sidebar/
├── Sidebar.jsx              ← root, manages openGroup state
├── Sidebar.module.css
├── NavGroup/
│   ├── NavGroup.jsx         ← one collapsible group (parent + animated children)
│   └── NavGroup.module.css
├── NavGroupIcon/
│   ├── NavGroupIcon.jsx     ← primary (parent) icon button
│   └── NavGroupIcon.module.css
└── NavChildIcon/
    ├── NavChildIcon.jsx     ← child icon with tooltip + on/off SVG
    └── NavChildIcon.module.css
```

### Sidebar Props

```js
Sidebar({
  defaultOpenGroup: 'database' | 'logic' | null,  // defaults to 'database'
  activeChild: string,        // e.g. 'btree', 'erd'
  onChildSelect: (id) => void
})
```

### NavGroup Props

```js
NavGroup({
  id: string,                 // 'database' | 'logic'
  icon: ReactNode,            // the primary icon (Lucide or SVG img)
  label: string,              // tooltip label for the primary icon
  isOpen: boolean,
  onToggle: () => void,
  children: ReactNode         // NavChildIcon elements
})
```

### NavGroupIcon Props

```js
NavGroupIcon({
  icon: ReactNode,            // Lucide icon or SVG img element
  label: string,              // tooltip text
  isOpen: boolean,            // controls active/orange state
  onClick: () => void
})
```

### NavChildIcon Props

```js
NavChildIcon({
  iconOff: string,            // path to off-state SVG (or null if using Lucide)
  iconOn: string,             // path to on-state SVG (or null if using Lucide)
  lucideIcon: ReactNode,      // alternative to SVG paths — use Lucide icon directly
  tooltip: string,
  isActive: boolean,
  activeColor: string,        // '#8B5CF6' for DB children, '#EA6C0A' for group icons
  onClick: () => void
})
```

### Navigation Groups

**Database Group:**
- Icon: `src/img/left nav/Database_off.svg` / `Database_on.svg` (custom SVG, swaps based on isOpen state)
- Active color: `#EA6C0A` (orange)
- Children:
  - B+ Tree: uses `btree_off.svg` / `btree_on.svg`, routes to `/tree`, active color `#8B5CF6`
  - ERD: uses `erd_off.svg` / `erd_on.svg`, routes to `/erd`, active color `#8B5CF6`

**Logic Group:**
- Icon: `src/img/left nav/Logic_off.svg` / `Logic_on.svg` (custom SVG, swaps based on isOpen state, 26px size)
- Active color: `#EA6C0A` (orange)
- Children:
  - Logical Equivalence: `GitBranch` from `lucide-react`, routes to `/logic/proof`
  - Semantic Tableaux: `Table2` from `lucide-react`, routes to `/logic/tableaux`
  - Resolution Method: `Layers` from `lucide-react`, routes to `/logic/resolution`

**More Tools Group:**
- Icon: `src/img/left nav/Down_off.svg` / `Down_on.svg` (custom SVG, swaps based on isOpen state)
- Label: "More Tools"
- Active color: `#EA6C0A` (orange)
- Children:
  - GPA Calculator: uses `calculator_off.svg` / `calculator_on.svg`, opens `https://lazy-grades.vercel.app/` in new tab, active color `#EA6C0A`

**Retired Components:**
- `src/components/Sidebar/Sidebar.jsx` - old sidebar component, replaced by `src/components/layout/Sidebar/`
- `src/components/SidebarIcon/SidebarIcon.jsx` - old icon component, replaced by `NavChildIcon`

### Migration from Old Sidebar

The new Sidebar component is located at `src/components/layout/Sidebar/` and uses different props than the old `src/components/Sidebar/`:

**Old API:**
```js
<Sidebar activeTool="btree" onToolChange={(tool) => {}} />
```

**New API:**
```js
<Sidebar 
  defaultOpenGroup="database"
  activeChild="btree" 
  onChildSelect={(childId) => {}} 
/>
```

Pages using the old Sidebar need to be updated to use the new component and prop names.

### Animation Behavior

- Children animate in/out with `motion/react` spring animation
- Spring config: `stiffness: 300, damping: 25`
- Variants: `open: { height: 'auto', opacity: 1 }`, `closed: { height: 0, opacity: 0 }`
- Pointer events disabled when closed to prevent interaction with hidden elements
- 2px orange horizontal line appears below NavGroupIcon when group is open

### CSS Variables

Global CSS variables are defined in `src/styles/global.css`:

**Color Variables:**
- `--color-bg: #000000` - Page background
- `--color-accent: #8B5CF6` - Primary purple (headings, buttons, active states)
- `--color-orange: #EA6C0A` - Secondary accent (Database/Logic group active states, GPA Calculator)
- `--color-star: #ffffff` - Starfield dots
- `--color-muted: #555555` - Inactive icons, secondary text
- `--color-surface: #0f0f0f` - Input backgrounds, card surfaces
- `--color-border: #222222` - Subtle borders

---

## TreePage Flow

TreePage conditionally renders either a landing screen or the visualizer based on whether a tree exists.

**Landing Screen (no tree):**
- Shows `HeroText` with title "B+ Tree Visualizer" and order selector
- Shows `PillInput` for entering comma-separated values
- Shows "Made by CS for CS 🗿" credit text
- User types values (e.g., "Frodo, Sauron, 67, Gandalf")
- On submit (Enter key), values are parsed and tree is initialized
- Transitions to visualizer view

**Visualizer Screen (tree exists):**
- Shows `Navbar` with order display
- Shows `TreeCanvas` with rendered B+ tree
- Shows `OperationsPanel` for insert/delete operations
- Shows "Reset" button (top-right) to return to landing screen
- Mobile: shows toggle button for bottom sheet panel

**State Management:**
- `hasTree` boolean controls which view is shown
- `order` state tracks tree order (3-10, default 3)
- Router state can pass initial values to skip landing screen
- Reset button clears tree and returns to landing screen

---

## Dynamic Island States

Resolved by precedence in `displayStateFor()` (`DynamicIsland.jsx`), highest
first. Nothing is stored under a state name, and nothing else writes
`data-state`.

| State | Trigger | Animation | Label |
|---|---|---|---|
| `music` | Click or Enter on pill | Music player expands, progress ring polls the player | — |
| `thinking` | Insert/Delete (tree), JSON paste (ERD), proof submit | Amber stagger + frame | `"Thinking"` |
| `waiting` | Question submitted (ERD step 2) | White stagger + frame | `"Waiting"` |
| `observing` | User types in PillInput | Blue pulse + plus-full | `"Observing"` |
| `generating` | No caller yet | White stagger + frame | `"Generating"` |
| `processing` | No caller yet | White stagger + frame | `"Thinking"` |
| `error` | No caller yet; auto-clears after 3s | Red dot + message | error string |
| `chat` | Message from another session, subject to the gates below | Pill expands with count + snippet | `"New message"` / `"{n} new messages"` |
| `greeting` | Entrance only, once per page load | Drops in expanded, holds ~2s, collapses | `"{n} online"` |
| `hover` | Mouse over pill | Online count fades in | `"{n} online"` |
| `idle` | Default | Green dot only | — |

`generating`, `processing` and `error` are wired and reachable but no page
fires them yet — only `idle`, `observing`, `waiting` and `thinking` have
callers. The entrance lifecycle is exposed separately on `data-phase`
(`hidden` → `greeting` → `collapsed`), since an unrevealed pill still reports
`data-state="idle"`.

**Chat notification gating** (`src/hooks/useChatNotification.js`): the island
is the transient, strictly-budgeted channel and the Sidebar unread badge is
the lossless one, so every gate below drops rather than defers.

| Gate | Behaviour |
|---|---|
| Chat panel open | Never notifies |
| Own `session_id` | Filtered out in `useChat` before it counts or notifies |
| Burst coalescing | One pill per burst, relabelled with a count; 4s of silence dismisses it |
| Hover | Holds the pill open past its dismiss window |
| Cooldown | 30s after a dismissal, messages only bump the badge |
| Session budget | 5 pops per page load, then silence until chat is opened |
| Priority | Never preempts `music` or a live AI state |

---

## Routing and Shared State

Routes are declared in [src/routes/index.jsx](../src/routes/index.jsx) as the `<AppRoutes>` component. `App.jsx` renders `<AppRoutes onAIStateChange={setAIState} onChatOpen={...} />` inside a `<Suspense>` boundary; lazy-loaded page chunks are warmed 3 s after first paint via `preloadRoutes()`.

`App.jsx` owns:
- `aiState` + `setAiState` → passed to `DynamicIsland` and to each page via route element props
- `isPlaying` + `handlePlayPause` → passed to `DynamicIsland`
- `onlineCount` from `usePresence()`
- `musicPlayerRef` pointing to `MusicPlayer`
- `activeChild` + `setActiveChild` → tracks which sidebar child icon is active ('btree' | 'erd')

**Global Components (rendered outside Routes):**
- `MusicPlayer` - hidden YouTube IFrame player
- `DynamicIsland` - fixed top-center pill with online count, music, and AI states
- `Sidebar` - fixed left navigation, persists across all routes with `defaultOpenGroup="database"`, `activeChild`, and `onChildSelect` props

Each page receives `onAIStateChange` as a prop and calls it at the right moments.

**Default Route:**
- Navigating to `/` redirects to `/tree` using `<Navigate to="/tree" replace />`
- `LandingPage.jsx` exists but is a simple redirect component (TODO: replace with neutral landing page when ready)
- All pages (TreePage, ERDPage, AboutPage, DisclaimerPage) no longer render their own Sidebar - it's global in App.jsx

**Logic Tool Routes:**
- `/logic/translate` → TranslatePage (English to Logic translation)
- `/logic/proof` → LogicalEquivalencePage (Logical equivalence proof builder)
- `/logic/tableaux` → TableauxPage (Semantic tableaux solver)
- `/logic/resolution` → ResolutionPage (Resolution method solver)
- All logic pages use `LogicInputPage` component for consistent layout and ScrambleText animations

---

## Logic Tools

### LogicInputPage Component

Shared input layout used by all four logic tools. Provides consistent UX with:
- **Layout**: Absolute positioning (`top: 50%, left: 50%, transform: translate(-50%, -50%)`) matching TreePage and ERDPage landing screens
- **ScrambleText**: Title and subtitle animate with 500ms duration, 40ms speed
- **Entrance Animation**: Container fades in with `opacity: 0 → 1` and `y: 20 → 0` over 0.4s
- **Components**: Renders Starfield, Navbar, title/subtitle with ScrambleText, PillInput, and SymbolBar

**Props:**
```js
LogicInputPage({
  title: string,              // e.g., "English to Logic"
  subtitle: string,           // e.g., "Translate natural language to logical notation"
  placeholder: string,        // e.g., "Enter a sentence..."
  onSubmit: (value) => void,  // Callback when user submits input
  onAIStateChange: (state) => void  // Callback for AI state changes
})
```

### SymbolBar Component

Custom-built logic symbol insertion toolbar with no external dependencies. Provides 8 logic symbols:
- ¬ (negation)
- ∧ (conjunction)
- ∨ (disjunction)
- → (implication)
- ↔ (biconditional)
- ∴ (therefore)
- ⊤ (tautology)
- ⊥ (contradiction)

**Behavior:**
- Each button inserts its symbol at the current cursor position in the input field
- Uses `inputRef.current.setRangeText(symbol, start, end, 'end')` API
- Dispatches synthetic `input` event to update React state
- Buttons styled with purple accent (#8B5CF6) on hover

**Props:**
```js
SymbolBar({
  inputRef: React.RefObject  // Reference to the input element
})
```

### Logic Tool Pages

All four logic tool pages follow the same pattern:
1. Import and render `LogicInputPage` with tool-specific props
2. Handle input submission with `onSubmit` callback
3. Manage AI state transitions with `onAIStateChange`
4. Future: render visualization canvas after input submission

**Current Status:**
- ✅ Folder structure created under `src/pages/logic/`, `src/components/logic/`, `src/lib/logic/`, `src/engine/logic/`
- ✅ LogicInputPage and SymbolBar fully implemented
- ✅ All four page components created with stub implementations
- ✅ Routes added to App.jsx with lazy loading
- ✅ Sidebar Logic group children navigate to correct routes
- ⏳ Visualization canvases (proof tree, tableaux, resolution) not yet implemented
- ⏳ Logic engines and libraries stubbed but not implemented

---

## Logic Tools

### Overview

Four logic tools for propositional logic education:
1. **English to Logic** (`/logic/translate`) — LLM-powered translation from natural language to formal logic
2. **Logical Equivalence** (`/logic/proof`) — Forward-chaining proof builder (pure JS)
3. **Semantic Tableaux** (`/logic/tableaux`) — Pure JS tableau solver with step-by-step visualization
4. **Resolution Method** (`/logic/resolution`) — Pure JS resolution algorithm with CNF conversion

### Architecture

```
src/
├── pages/logic/
│   ├── TranslatePage.jsx      English to Logic translation. Uses Gemini API.
│   ├── LogicalEquivalencePage.jsx      Logical equivalence proof builder. Pure JS algorithm.
│   ├── TableauxPage.jsx       Semantic tableaux solver. Pure JS algorithm.
│   └── ResolutionPage.jsx     Resolution method solver. Pure JS algorithm.
│
├── components/logic/
│   ├── LogicInputPage/        Shared input layout for all logic tools.
│   ├── SymbolBar/             Logic symbol insertion toolbar.
│   ├── TranslationResult/     Displays English → Logic translation result.
│   ├── RulesPanel/            Collapsible reference panel for tableau rules.
│   ├── LogicStepControls.jsx  Step controls for logic animations (play/pause/speed).
│   ├── TableauxCanvas/        SVG renderer for semantic tableaux tree.
│   └── ResolutionCanvas/      SVG renderer for resolution V-connector diagram.
│
├── lib/logic/
│   ├── formulaParser.js       Recursive descent parser for propositional logic.
│   ├── tableauxEngine.js      Semantic tableaux algorithm (pure JS).
│   ├── resolutionEngine.js    Resolution algorithm with CNF conversion (pure JS).
│   ├── logicPromptBuilder.js  Builds Gemini prompts for translate and proof tools.
│   └── logicParser.js         Validates and sanitizes Gemini JSON responses.
│
└── engine/logic/              (Reserved for future animation engines)
```

### LogicInputPage Component

Shared input layout used by all four logic tools. Provides consistent UX with:
- **Layout**: Absolute positioning (`top: 50%, left: 50%, transform: translate(-50%, -50%)`) matching TreePage and ERDPage landing screens
- **ScrambleText**: Title and subtitle animate with 500ms duration, 40ms speed
- **Entrance Animation**: Container fades in with `opacity: 0 → 1` and `y: 20 → 0` over 0.4s
- **Components**: Renders Starfield, Navbar, title/subtitle with ScrambleText, PillInput, and SymbolBar

**Props:**
```js
LogicInputPage({
  title: string,              // e.g., "English to Logic"
  subtitle: string,           // e.g., "Translate natural language to logical notation"
  placeholder: string,        // e.g., "Enter a sentence..."
  onSubmit: (value) => void,  // Callback when user submits input
  onAIStateChange: (state) => void  // Callback for AI state changes
})
```

### SymbolBar Component

Custom-built logic symbol insertion toolbar with no external dependencies. Provides 8 logic symbols:
- ¬ (negation, U+00AC)
- ∧ (conjunction, U+2227)
- ∨ (disjunction, U+2228)
- → (implication, U+2192)
- ↔ (biconditional, U+2194)
- ∴ (therefore, U+2234)
- ⊤ (tautology, U+22A4)
- ⊥ (contradiction, U+22A5)

**Behavior:**
- Each button inserts its symbol at the current cursor position in the input field
- Uses `inputRef.current.setRangeText(symbol, start, end, 'end')` API
- Dispatches synthetic `input` event to update React state
- Buttons styled with purple accent (#8B5CF6) on hover
- Requires `PillInput` to expose `inputRef` prop

**Props:**
```js
SymbolBar({
  inputRef: React.RefObject  // Reference to the input element
})
```

### Formula Parser

**Location:** `src/lib/logic/formulaParser.js`

Recursive descent parser for propositional logic. Supports:
- **Atoms**: Single uppercase letters (A-Z)
- **Negation**: ¬ or ~
- **Binary connectives**: ∧ (&), ∨ (|), → (->), ↔ (<->)
- **Parentheses**: For grouping

**Grammar (precedence lowest → highest):**
```
iff      : implies (IFF implies)*          (left-assoc)
implies  : or (IMPLIES implies)?           (right-assoc)
or       : and (OR and)*                   (left-assoc)
and      : not (AND not)*                  (left-assoc)
not      : NOT not | primary
primary  : ATOM | '(' iff ')'
```

**AST Node Types:**
```js
{ type: 'atom', name: 'P' }
{ type: 'not', child: node }
{ type: 'and' | 'or' | 'implies' | 'iff', left: node, right: node }
```

**Export:**
```js
parseFormula(formulaString) → ASTNode
```

**Tests:** Includes 8 inline tests covering De Morgan's laws, implications, double negation, ASCII equivalents, and right-associativity.

### Tableaux Engine

**Location:** `src/lib/logic/tableauxEngine.js`

Pure JS semantic tableaux algorithm for propositional logic. No LLM required.

**Algorithm:**
1. Start with formula (negated for validity mode, as-is for satisfiability mode)
2. Apply expansion rules (α-rules first, then β-rules)
3. Check each branch for contradictions (atom A and ¬A both present)
4. Mark branches as closed (✗) or open (○)
5. Return tree structure + steps array for animation

**Rules:**
- **α-rules (single branch)**: ¬¬A, A∧B, ¬(A∨B), ¬(A→B)
- **β-rules (branch split)**: A∨B, ¬(A∧B), A→B, A↔B, ¬(A↔B)

**Export:**
```js
runTableaux(formulaString, mode) → { tree, steps, result }
// mode: 'satisfiability' | 'validity'
// result: 'satisfiable' | 'unsatisfiable' | 'valid' | 'invalid'
```

**Tree Node Structure:**
```js
{
  id: string,
  formula: string,
  formulaNode: ASTNode,
  isClosed: boolean,
  isOpen: boolean,
  closedBy: [id1, id2] | null,
  children: TableauNode[]
}
```

**Steps Array:**
```js
[{
  id: number,
  description: string,
  treeSnapshot: TableauNode,
  highlightNodeId: string
}]
```

**Tests:** Includes 5 inline tests covering De Morgan's law, tautologies, satisfiability, contradictions, and validity.

### Resolution Engine

**Location:** `src/lib/logic/resolutionEngine.js`

Pure JS resolution algorithm with CNF conversion. No LLM required.

**CNF Conversion Pipeline:**
1. Eliminate biconditionals: `P↔Q` → `(P→Q)∧(Q→P)`
2. Eliminate implications: `P→Q` → `¬P∨Q`
3. Push negations inward: De Morgan's laws + double negation elimination
4. Distribute ∨ over ∧: Convert to conjunctive normal form

**Resolution Algorithm:**
1. Parse input (formula string or array of clause strings)
2. Convert to CNF and extract clauses
3. Try all pairs of clauses for resolution
4. Find complementary literals (P and ¬P), produce resolvent
5. Stop when empty clause produced (contradiction) or no new clauses
6. Return knowledge base + steps array

**Export:**
```js
runResolution(input) → { knowledgeBase, steps, result }
// input: string (formula) | string[] (clauses)
// result: 'contradiction' | 'satisfiable'
```

**Knowledge Base Structure:**
```js
[{
  id: string,           // e.g., 'c0', 'c1'
  clause: string[],     // e.g., ['P', '¬Q']
  source: 'premise' | 'resolution'
}]
```

**Steps Array:**
```js
[{
  id: string,
  clause1: string,      // ID of first parent clause
  clause2: string,      // ID of second parent clause
  resolvedLiteral: string,  // e.g., 'P'
  resolvent: string[],  // Result clause
  resolventId: string   // ID of new clause
}]
```

**Tests:** Includes 6 inline tests covering simple resolution, contradictions, satisfiability, CNF conversion, and the Image 4 example from spec.

### TranslatePage

**Location:** `src/pages/logic/TranslatePage.jsx`

English to formal logic translation using Gemini API.

**Flow:**
1. User enters English sentence (e.g., "If it rains then the ground is wet")
2. Calls `buildTranslatePrompt()` to create LLM prompt
3. Calls `callGeminiWithParser()` with `parseTranslation` validator
4. Displays `TranslationResult` component with:
   - Original English sentence
   - Formal logic translation (large purple monospace)
   - Symbol breakdown table

**Dynamic Island States:**
- `observing` → on input focus
- `waiting` → during Gemini API call
- `idle` → after result displayed (1s delay)

**Result JSON Schema:**
```json
{
  "english": "If it rains then the ground is wet",
  "formal": "R → W",
  "breakdown": [
    { "symbol": "R", "meaning": "It rains" },
    { "symbol": "W", "meaning": "The ground is wet" },
    { "symbol": "→", "meaning": "If...then (material implication)" }
  ]
}
```

### TableauxPage

**Location:** `src/pages/logic/TableauxPage.jsx`

Semantic tableaux solver with step-by-step visualization.

**Flow:**
1. User enters propositional formula (e.g., `¬(¬(P∧Q)↔(¬P∨¬Q))`)
2. Selects mode: satisfiability or validity
3. Calls `runTableaux()` from `tableauxEngine.js`
4. Displays `TableauxCanvas` with animated tree construction
5. Uses `useAnimationPlayer` hook for step-by-step playback
6. Shows `LogicStepControls` at bottom for play/pause/speed
7. Shows `RulesPanel` toggle button (?) in top-right

**Dynamic Island States:**
- `observing` → on input focus
- `thinking` → during algorithm execution
- `idle` → after result displayed

**Canvas Features:**
- Formulas stack vertically within each branch
- Beta splits render as two child columns branching horizontally
- Closed branches end with ✗ in red (#ef4444)
- Open branches end with ○ in green (#22c55e)
- Pan with mouse drag, zoom with mouse wheel
- Result badge shows VALID/INVALID or SATISFIABLE/UNSATISFIABLE

### ResolutionPage

**Location:** `src/pages/logic/ResolutionPage.jsx`

Resolution method solver with V-connector diagram visualization.

**Input Parsing:**
- **Proof mode**: `(P→Q)∧(R→S)∧(¬Q∨¬S), prove: ¬(¬P∨¬R)`
  - Splits at "prove:" keyword
  - Negates conclusion and adds to clause set
- **Clause mode**: `P∨Q, ¬P∨R, ¬Q∨S`
  - Treats entire input as comma-separated clauses

**Flow:**
1. User enters clauses or formula with conclusion
2. Parses input to extract clauses
3. Calls `runResolution()` from `resolutionEngine.js`
4. Displays `ResolutionCanvas` with:
   - Knowledge base panel on right (shows initial clauses)
   - V-connector diagram in center (shows resolution steps)
   - Each step animates in sequentially
5. Uses `useAnimationPlayer` hook for step-by-step playback
6. Shows `LogicStepControls` at bottom

**Dynamic Island States:**
- `observing` → on input focus
- `thinking` → during algorithm execution
- `idle` → after result displayed

**Canvas Features:**
- Knowledge base panel (300px width) shows all premise clauses
- V-connector diagram: two parent clauses at top, resolved literal at junction, resolvent at bottom
- Empty clause (contradiction) rendered as ⊥ in red (#ef4444)
- Steps arranged in grid layout (3 per row)
- Pan with mouse drag, zoom with mouse wheel
- Result badge shows CONTRADICTION or SATISFIABLE

### RulesPanel Component

**Location:** `src/components/logic/RulesPanel/`

Collapsible reference panel for tableau rules. Toggled by ? button in top-right.

**Content:**
- **α-Rules table**: Single branch rules with formula → produces columns
- **β-Rules table**: Branch split rules with formula → left branch → right branch columns
- **Branch Closure explanation**: When branches close (✗) or stay open (○)

**Styling:**
- Background: #0a0a0a
- Border: 1px solid #222
- Border radius: 12px
- Headers: #8B5CF6 (purple)
- Slides in from right with spring animation
- Backdrop overlay when open

### LogicStepControls Component

**Location:** `src/components/logic/LogicStepControls.jsx`

Bottom control bar for logic animations. Same pattern as B+ tree StepControls but not imported (separate component).

**Features:**
- Play/Pause button (purple background)
- Previous/Next buttons
- Step counter (e.g., "Step 3 / 10")
- Step description text
- Speed slider (0.5x to 2x)
- Fixed at bottom with 80px height

**Props:**
```js
LogicStepControls({
  player: {
    currentStepIndex: number,
    currentStep: object,
    isPlaying: boolean,
    speed: number,
    isAtStart: boolean,
    isAtEnd: boolean,
    hasSteps: boolean,
    totalSteps: number,
    togglePlayPause: () => void,
    next: () => void,
    prev: () => void,
    updateSpeed: (speed) => void
  }
})
```

### TableauxCanvas Component

**Location:** `src/components/logic/TableauxCanvas/`

SVG renderer for semantic tableaux tree.

**Layout Algorithm:**
- Calculates depth and width of each subtree
- Positions nodes recursively
- Single children: same x position, move down
- Two children (beta split): split horizontally

**Visual Elements:**
- Node boxes: 200px width, 40px height, 8px border radius
- Formulas in Courier New monospace
- Closed nodes: red border (#ef4444), ✗ marker below
- Open nodes: green border (#22c55e), ○ marker below
- Highlighted nodes: purple glow (#8B5CF6)
- Edges: 2px gray lines (#333)

**Interactions:**
- Pan with mouse drag
- Zoom with mouse wheel
- Zoom controls in bottom-right corner

### ResolutionCanvas Component

**Location:** `src/components/logic/ResolutionCanvas/`

SVG renderer for resolution method V-connector diagram.

**Layout:**
- Knowledge base panel: 300px width, fixed on right
- Canvas area: flex-grow, center area
- Steps arranged in grid: 3 per row, 220px horizontal spacing, 180px vertical spacing

**Visual Elements:**
- Clause boxes: 180px width, 50px height, 8px border radius
- V-connector lines: 2px purple (#8B5CF6)
- Resolved literal label: small box at junction
- Empty clause (⊥): red color (#ef4444), larger font, glow effect
- Each step animates in with fade + slide

**Interactions:**
- Pan with mouse drag
- Zoom with mouse wheel
- Zoom controls in bottom-right corner

### Gemini Service Updates

**Location:** `src/lib/geminiService.js`

Added generic `callGeminiWithParser()` function:
```js
callGeminiWithParser(prompt, parser) → Promise<{success, data} | {success, error}>
```

Accepts any parser function that returns `{valid, data, error}`. Existing `callGemini()` refactored to use this generic function with `parseERD`.

### Logic Prompt Builder

**Location:** `src/lib/logic/logicPromptBuilder.js`

Builds Gemini prompts for logic tools:

**buildTranslatePrompt(englishSentence):**
- Instructs LLM to return only raw JSON (no markdown, no code fences)
- Specifies JSON schema with `english`, `formal`, `breakdown[]` fields
- Provides example translation
- Returns complete prompt string

**buildProofPrompt(premises, conclusion):**
- Instructs LLM to return only raw JSON (no markdown, no code fences)
- Specifies JSON schema with `premises[]`, `conclusion`, `steps[]` fields
- Lists all inference rule abbreviations (M.P., M.T., H.S., D.S., etc.)
- Provides example proof
- Returns complete prompt string

### Logic Parser

**Location:** `src/lib/logic/logicParser.js`

Validates and sanitizes Gemini JSON responses:

**parseTranslation(jsonString):**
- Validates JSON syntax
- Checks required fields: `english`, `formal`, `breakdown[]`
- Validates breakdown entries have `symbol` and `meaning`
- Returns `{valid: true, data}` or `{valid: false, error}`

**parseProof(jsonString):**
- Validates JSON syntax
- Checks required fields: `premises[]`, `conclusion`, `steps[]`
- Validates step structure: `id`, `formula`, `justification`, `from[]`
- Verifies step references point to previous steps or premises
- Returns `{valid: true, data}` or `{valid: false, error}`

### Algorithm Sources

**Semantic Tableaux:**
- Algorithm based on standard propositional logic tableau method
- Rules from classical logic textbooks (Smullyan's "First-Order Logic")
- Implementation: pure JavaScript, no external libraries
- Depth-first search with branch closure detection

**Resolution Method:**
- Algorithm based on Robinson's resolution principle (1965)
- CNF conversion follows standard transformation rules
- Implementation: pure JavaScript, no external libraries
- Exhaustive clause pair resolution with duplicate detection

**Formula Parser:**
- Recursive descent parser with operator precedence
- Grammar designed for propositional logic with standard connectives
- Right-associativity for implication (P→Q→R = P→(Q→R))
- Left-associativity for conjunction, disjunction, biconditional

### Current Status

**Fully Implemented:**
- ✅ LogicInputPage with ScrambleText animations
- ✅ SymbolBar with 8 logic symbols
- ✅ Formula parser with comprehensive tests
- ✅ Tableaux engine with step-by-step animation
- ✅ Resolution engine with CNF conversion
- ✅ TranslatePage with Gemini integration
- ✅ TableauxPage with canvas visualization
- ✅ ResolutionPage with V-connector diagram
- ✅ RulesPanel with collapsible reference
- ✅ LogicStepControls for animation playback
- ✅ All routes added to App.jsx
- ✅ Sidebar Logic group navigation updated

**Not Yet Implemented:**
- ⏳ LogicalEquivalencePage (implemented with pure JS proof engine)
- ⏳ ProofTreeCanvas component
- ⏳ Animation engines for proof tree

---

## Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `usePresence.js`, `useApiCalls.js` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `usePresence.js`, `useApiCalls.js` | Supabase anon key |
| `VITE_GEMINI_API_KEY` | `geminiService.js` | Gemini API key |

---

## Database Tables (Supabase)

### `sessions`
```sql
create table sessions (
  id uuid primary key,
  last_seen timestamptz not null default now()
);
```
Used by `usePresence.js` to track active users. A session is "online" if
`last_seen > now() - interval '2 minutes'`.

### `api_calls`
```sql
create table api_calls (
  session_id uuid primary key references sessions(id) on delete cascade,
  call_count integer not null default 0,
  last_reset timestamptz not null default now()
);
```
Used by `useApiCalls.js`. Resets `call_count` to 0 after 24 hours.

---

## Known Limitations

- YouTube IFrame API postMessage errors appear on localhost — normal, disappear on Vercel
- Firefox SES/lockdown-install.js warnings are from browser extensions — not our code
- Gemini free tier is per Google Cloud project — create a new project for a fresh quota
- ERD layout can still produce overlapping nodes on very large diagrams (10+ entities)


---

## Chat Feature

### Overview

Real-time community chat system using Supabase for backend storage and real-time subscriptions. Chat panel slides up from bottom as a full-screen overlay.

### Architecture

```
src/
├── components/chat/
│   ├── ChatPanel/         Full-screen overlay with slide-up animation
│   ├── ChatBubble/        Individual message display with avatar
│   ├── ChatInput/         Pill-shaped textarea with send button
│   ├── ChatAvatar/        Wrapper around AgentAvatar
│   └── index.js           Clean exports
│
├── hooks/
│   └── useChat.js         Chat state management with Supabase
│
└── lib/
    └── supabaseClient.js  Centralized Supabase configuration
```

### ChatPanel Component

**Location:** `src/components/chat/ChatPanel/`

Full-screen overlay that slides up from bottom. No Framer Motion - uses pure CSS transitions.

**Props:**
```js
ChatPanel({
  isOpen: boolean,
  onClose: () => void,
  sessionId: string
})
```

**Layout:**
- Position: `fixed, top: 0, left: 56px, right: 0, bottom: 0, z-index: 50`
- Background: `#000` (solid black, no starfield)
- Mobile (< 640px): `left: 0` (full screen)

**Three Sections:**
1. **Header** (56px height):
   - Title: "Community Chat" in `#8B5CF6`, font-weight 600
   - Close button (✕) on right
   - Border-bottom: `1px solid #1a1a1a`

2. **Messages Area** (flex: 1):
   - Overflow-y: auto
   - Padding: 20px
   - Messages constrained to `max-width: min(800px, 90vw)`, centered
   - Auto-scroll to bottom on new messages
   - Loading state: centered spinner (32px, purple)
   - Empty state: "No messages yet. Say hi!" in `rgba(255,255,255,0.3)`

3. **Input Area** (bottom):
   - Padding: `12px 20px`
   - Border-top: `1px solid #1a1a1a`
   - Renders ChatInput component

**Animation:**
- Slide from bottom: `transform: translateY(100%)` → `translateY(0)`
- Transition: `transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- When `isOpen` is false: `translateY(100%)`

### ChatBubble Component

**Location:** `src/components/chat/ChatBubble/`

Displays individual messages with avatar and asymmetric border radius.

**Props:**
```js
ChatBubble({
  message: {
    id: string,
    session_id: string,
    content: string,
    created_at: string
  },
  isOwnMessage: boolean
})
```

**Layout:**
- Own messages: avatar on right, bubble on left
- Other messages: avatar on left, bubble on right
- Avatar size: 32px
- Gap: 8px between avatar and bubble

**Bubble Styling:**
- Own message:
  - Background: `#1A1A1A` (or `var(--color-chat-own)`)
  - Border-radius: `18px 18px 4px 18px` (flat bottom-right)
- Other message:
  - Background: `#1a1a2e` (or `var(--color-chat-other)`)
  - Border-radius: `18px 18px 18px 4px` (flat bottom-left)
- Text: white, 14px, padding `10px 14px`
- Max-width: 70%
- Timestamp: `rgba(255,255,255,0.3)`, 10px, below bubble

### ChatInput Component

**Location:** `src/components/chat/ChatInput/`

Pill-shaped textarea with auto-resize and animated send button.

**Props:**
```js
ChatInput({
  onSend: (content: string) => void
})
```

**Container:**
- Background: `#0f0f0f`
- Border: `1px solid #222`
- Border-radius: `9999px` (pill shape)
- Width: `min(800px, 90vw)`
- Min-height: `54px`
- Centered: `margin: 0 auto`
- Mobile: width `95vw`

**Textarea:**
- Transparent background
- White text
- Padding: `16px 52px 16px 20px`
- Resize: none
- Max-height: `100px` (locks growth)
- Overflow-y: auto when exceeded
- Auto-resizes as user types

**Focus State:**
- Border: `#8B5CF6`
- Box-shadow: `0 0 0 2px rgba(139,92,246,0.25)`

**Send Button:**
- Purple circle: 32px diameter
- Background: `#8B5CF6`
- Positioned on right inside pill
- Only visible when textarea has content
- Transition: `scale(0)` → `scale(1)`
- Hover: scale(1.05)

**Keyboard:**
- Enter: sends message
- Shift+Enter: adds newline
- After sending: clears textarea

### ChatAvatar Component

**Location:** `src/components/chat/ChatAvatar/`

Wrapper around AgentAvatar with circular clipping.

**Props:**
```js
ChatAvatar({
  sessionId: string,
  size: number  // default: 36
})
```

**Implementation:**
```jsx
<div style={{
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0
}}>
  <AgentAvatar 
    seed={sessionId} 
    size={size || 36} 
    animated={true} 
  />
</div>
```

**Features:**
- Deterministic avatar generation from session UUID
- Each user always gets same unique avatar
- Animated breathing, pulsing, sparkle effects
- Respects `prefers-reduced-motion`

### useChat Hook

**Location:** `src/hooks/useChat.js`

Manages chat state with Supabase real-time subscriptions.

**Returns:**
```js
{
  messages: Message[],
  sendMessage: (content: string) => Promise<void>,
  isLoading: boolean
}
```

**Behavior:**
- On mount: fetches last 50 messages ordered by `created_at`
- Subscribes to real-time inserts on `messages` table
- On unmount: unsubscribes from channel
- `sendMessage()`: inserts row with current `session_id` from localStorage

**Message Object:**
```js
{
  id: string,           // UUID
  session_id: string,   // User identifier
  content: string,      // Message text
  created_at: string    // ISO timestamp
}
```

### Supabase Integration

**Table Schema:**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Indexes
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_session_id ON messages(session_id);
```

**Row Level Security:**
```sql
-- Allow public read access
CREATE POLICY "Allow public read access" 
ON messages FOR SELECT USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert access" 
ON messages FOR INSERT WITH CHECK (true);
```

### Sidebar Integration

**Chat Icon:**
- Location: Above ChatAvatar at bottom of sidebar
- Icons: `src/img/social/chat_off.svg`, `chat_hover.svg`, `chat_on.svg`
- Behavior: Same hover/active pattern as NavChildIcon
- Click: Opens chat panel via `setIsChatOpen(true)`

**ChatAvatar:**
- Location: Very bottom of sidebar
- Size: 28px
- Session ID: From localStorage
- Margin-top: auto (pushes to bottom)

**Collapse Behavior:**
- When chat is open: sidebar collapses child icons
- Only shows primary group icons (Database, Logic, More Tools)
- Chat icon and avatar remain visible
- Children hidden via conditional render: `{!isChatOpen && <NavChildIcon />}`

### App.jsx Integration

**State:**
```js
const [isChatOpen, setIsChatOpen] = useState(false)
const sessionId = localStorage.getItem('session_id') || 'anonymous'
```

**Props Passed to Sidebar:**
```js
<Sidebar
  defaultOpenGroup="database"
  activeChild={activeChild}
  onChildSelect={setActiveChild}
  isChatOpen={isChatOpen}
  setIsChatOpen={setIsChatOpen}
/>
```

**ChatPanel Render:**
```js
<ChatPanel 
  isOpen={isChatOpen} 
  onClose={() => setIsChatOpen(false)} 
  sessionId={sessionId}
/>
```

### CSS Variables

**Global Variables (src/styles/global.css):**
```css
--color-chat-own: #1A1A1A;      /* Own message bubble background */
--color-chat-other: #1a1a2e;    /* Other message bubble background */
```

### Key Features

✅ Real-time messaging via Supabase subscriptions
✅ Animated avatars generated from session UUID
✅ Smooth slide-up animation (CSS only, no Framer Motion)
✅ Full-screen overlay with sidebar offset
✅ Message boundaries aligned with input pill width
✅ Auto-scroll to new messages
✅ Loading & empty states
✅ Sidebar collapse when chat open
✅ Mobile responsive (full screen)
✅ Solid black background (no starfield)

### Future Enhancements

- Message editing and deletion
- Typing indicators
- Read receipts
- Message reactions
- File attachments
- User presence indicators
- Message search
- Pagination for older messages
- Markdown support
- Code syntax highlighting

---

## Navbar Component

**Location:** `src/components/Navbar/`

The Navbar component is now **fully prop-driven** with no hardcoded content. Every element (title, buttons, links) is controlled by props and only renders when explicitly enabled.

### Props

```js
Navbar({
  showTitle = false,        // Show title text
  title = '',               // Title text to display
  showReset = false,        // Show "Reset / New Tree" button
  onReset = null,           // Reset button click handler
  showResult = false,       // Show result badge
  resultText = '',          // Result text (e.g., "VALID", "SATISFIABLE")
  showNewFormula = false,   // Show "← New Formula" button
  onNewFormula = null,      // New formula button click handler
  showAbout = true,         // Show "About" link (default: true)
  showDisclaimer = false    // Show "Disclaimer" link
})
```

### Styling

- **Background**: Transparent (no background color)
- **Border**: None (no bottom border on any page)
- **Height**: 60px fixed
- **Padding**: 16px 24px

### Usage Examples

**Landing/Input Pages (minimal):**
```jsx
<Navbar />  // Shows only "About" link by default
```

**TreePage Canvas View:**
```jsx
<Navbar 
  showTitle={true}
  title="B+ Tree Visualizer"
  showReset={true}
  onReset={handleReset}
  showDisclaimer={true}
/>
```

**ERD Canvas View:**
```jsx
<Navbar 
  showNewFormula={true}
  onNewFormula={handleNewERD}
/>
```

**Logic Canvas Views:**
```jsx
// TableauxPage
<Navbar 
  showResult={true}
  resultText={result.conclusion}  // "SATISFIABLE" | "UNSATISFIABLE" | "VALID" | "INVALID"
  showNewFormula={true}
  onNewFormula={handleReset}
/>

// LogicalEquivalencePage
<Navbar 
  showNewFormula={true}
  onNewFormula={handleReset}
/>
```

### Result Badge Styles

The `resultText` prop accepts these values with corresponding colors:
- `"SATISFIABLE"` → Green (#22c55e)
- `"UNSATISFIABLE"` → Red (#ef4444)
- `"VALID"` → Green (#22c55e)
- `"INVALID"` → Red (#ef4444)
- `"CONTRADICTION"` → Red (#ef4444)

---


---

## O Complexity Analyser

**Route:** `/algo/complexity`

Pure JavaScript Big-O complexity analyser for Python code. No LLM APIs. Fully algorithmic.

### Overview

The O Complexity tool analyses Python code blocks and produces:
1. **Step-by-step derivation** showing how each loop/block contributes to overall complexity
2. **Visual bracket annotations** on the code showing the complexity of each nested structure
3. **Final Big-O result** with proper mathematical notation

### Architecture

```
src/
├── pages/
│   ├── ComplexityPage.jsx         Two-view page: input → result
│   └── ComplexityPage.module.css
│
├── components/algo/
│   ├── ComplexityInput/           Textarea pill for Python code input
│   │   ├── ComplexityInput.jsx
│   │   └── ComplexityInput.module.css
│   ├── ComplexityCodeView/        Left panel: code + SVG bracket annotations
│   │   ├── ComplexityCodeView.jsx
│   │   └── ComplexityCodeView.module.css
│   └── ComplexityTerminal/        Right panel: terminal with step-by-step derivation
│       ├── ComplexityTerminal.jsx
│       └── ComplexityTerminal.module.css
│
└── lib/algo/
    ├── complexityTypes.js         Complexity constants and display helpers
    ├── complexityAlgebra.js       Multiply/sum/dominant operations + lookup table
    ├── complexityParser.js        Python line parser + expression analyser
    ├── complexityEngine.js        Main analysis engine (recursive block analyser)
    └── complexityEngineHelpers.js Helper functions for engine
```

### Navigation

**Sidebar Group:** Algorithms (between Database and Logic)
- Parent icon: `DSA_OFF.svg` / `DSA_ON.svg`
- Active color: `#EA6C0A` (orange)
- Child: "O Complexity"
  - Icons: `COMPLEXITY_OFF.svg`, `COMPLEXITY_HOVER.svg`, `COMPLEXITY_ON.svg`
  - Route: `/algo/complexity`
  - Active color: `#EA6C0A`

### ComplexityPage Flow

**Input View:**
- Starfield background
- Plain Navbar (no props)
- Centered ComplexityInput component
- User pastes Python code
- On submit (Cmd/Ctrl+Enter or button click):
  - Calls `analyzeComplexity()` synchronously
  - Switches to result view

**Result View:**
- Starfield background
- Navbar with title "O Complexity", result badge, and "← New Formula" button
- Split panel layout:
  - Left (flex: 1): ComplexityCodeView
  - Right (420px fixed): ComplexityTerminal
- Error state: centered error message + retry button

### ComplexityInput Component

Textarea pill for Python code input. Same visual language as LogicInputPage.

**Props:**
```js
ComplexityInput({
  onSubmit: (code) => void,
  onAIStateChange: (state) => void
})
```

**Behavior:**
- On focus → `onAIStateChange('observing')`
- On blur → `onAIStateChange('idle')`
- On submit → `onAIStateChange('thinking')`, 120ms delay, then `onSubmit(code.trim())`
- Keyboard: Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) submits
- Submit button disabled when textarea is empty

**Styling:**
- Pill container: `border-radius: 16px`, `background: var(--color-surface)`
- On focus: border and box-shadow become `--color-accent`
- Textarea: `JetBrains Mono`, `13px`, `min-height: 280px`, `max-height: 480px`, `resize: none`
- Footer: hint text left ("⌘ Enter to analyse"), submit button right

### ComplexityCodeView Component

Left panel showing Python code with SVG bracket annotations.

**Props:**
```js
ComplexityCodeView({
  code: string,
  annotations: Annotation[]
})
```

**Annotation Structure:**
```js
{
  id: string,          // e.g., 'a0', 'a1'
  lineStart: number,   // 1-indexed, inclusive
  lineEnd: number,     // 1-indexed, inclusive
  complexity: string,  // complexity key e.g., 'n2'
  label: string,       // e.g., 'for i in range(n)'
  depth: number,       // nesting depth, 0=outermost
  kind: 'for' | 'while' | 'if' | 'def'
}
```

**Layout:**
- Fixed line height: **22px** (critical for SVG positioning)
- Line numbers: right-aligned, muted, non-selectable
- Line text: `JetBrains Mono`, `13px`, `white-space: pre`
- SVG bracket panel to the right of code lines

**SVG Bracket Rendering:**
- Panel width = `(maxDepth + 1) * 56 + 16` pixels
- Column width = 56px per depth level
- Annotations sorted deepest-first (outermost draws on top)
- Column x position = `(maxDepth - ann.depth) * 56 + 8` (outermost = rightmost)
- `yTop = (ann.lineStart - 1) * 22 + 11` (midpoint of first line)
- `yBot = (ann.lineEnd - 1) * 22 + 11` (midpoint of last line)
- Each bracket: vertical line + top tick (6px) + bottom tick (6px) + label background rect + label text

**Bracket Colors:**
| Complexity | Color |
|---|---|
| `'1'` | `#6b7280` (gray) |
| `'log_n'`, `'log2_n'` | `#10b981` (green) |
| `'sqrt_n'`, `'sqrt_n_log_n'` | `#06b6d4` (cyan) |
| `'n'` | `#3b82f6` (blue) |
| `'n_log_n'`, `'n_sqrt_n'` | `#8b5cf6` (purple) |
| `'n2'`, `'n2_log_n'` | `#f59e0b` (amber) |
| `'n3'`, `'n3_log_n'` | `#ef4444` (red) |
| `'exp_n'` | `#be123c` (rose) |
| `'unknown'` | `#6b7280` (gray) |

### ComplexityTerminal Component

Right panel showing step-by-step derivation in terminal style.

**Props:**
```js
ComplexityTerminal({
  steps: Step[],
  finalComplexity: string
})
```

**Step Structure:**
```js
{
  text: string,
  type: 'loop' | 'combine_nested' | 'worst_case' | 'special' | 'info' | 'divider' | 'final',
  complexity?: string,   // optional
  indent?: number        // 0-based nesting depth
}
```

**Behavior:**
- When steps prop changes: reset visible count to 0
- Reveal one step every 80ms via `setInterval`
- Auto-scroll to bottom on each step reveal
- Blinking cursor (█) shown while steps are being revealed
- Steps with `type: 'final'` are NOT rendered as lines (shown in finalBox only)
- Final box appears after all steps visible AND `finalComplexity` is truthy

**Step Colors:**
| Type | Color |
|---|---|
| `loop` | `#4ade80` (green) |
| `combine_nested` | `#34d399` (emerald) |
| `worst_case` | `#fbbf24` (amber) |
| `special` | `#67e8f9` (cyan) |
| `info` | `#9ca3af` (gray) |
| `divider` | `#374151` (dark gray) |

**Step Prefixes:**
- `special` → `  ⚡ `
- `worst_case` → `  ⚠ `
- `combine_nested` → no prefix
- all others → `▸ `

**Line Format:** `[2-digit index]  [indent][prefix][text]`

**Styling:**
- Terminal background: `#020409` (near-black)
- Header background: `#0d1117`
- Font: `JetBrains Mono`, `12px`, `line-height: 1.7`
- Final box:
  - Border: `1px solid #166534`
  - Background: `rgba(20, 83, 45, 0.2)`
  - Label: "FINAL COMPLEXITY" — 9px, bold, uppercase, letter-spacing 0.18em, `#166534`
  - Value: 28px, bold, `#4ade80`, text-shadow glow `rgba(74, 222, 128, 0.4)`

**Animations:**
- Each step line: `fadeSlideIn` (opacity 0→1, translateX -4px→0, 0.15s)
- Final box: `finalReveal` (opacity 0→1, scale 0.97→1, 0.4s)
- Cursor: `blink` (1s step-end infinite)

### Engine Layer

#### complexityTypes.js

Exports complexity constants and display helpers:

```js
COMPLEXITY_ORDER = [
  '1', 'log_n', 'log2_n', 'sqrt_n', 'sqrt_n_log_n',
  'n', 'n_log_n', 'n_sqrt_n', 'n2', 'n2_log_n',
  'n3', 'n3_log_n', 'exp_n', 'unknown'
]

COMPLEXITY_DISPLAY = {
  '1': 'O(1)',
  'log_n': 'O(log n)',
  'n': 'O(n)',
  'n2': 'O(n²)',
  // ... etc
}

COMPLEXITY_SHORT = {
  '1': '1',
  'log_n': 'log n',
  'n': 'n',
  'n2': 'n²',
  // ... etc
}

displayComplexity(c) → string  // e.g., 'O(n²)'
shortComplexity(c) → string    // e.g., 'n²'
```

#### complexityAlgebra.js

Implements complexity arithmetic operations:

```js
dominantOf(a, b) → string           // Returns higher-order complexity
multiplyComplexities(a, b) → string // For nested loops (uses lookup table)
sumComplexities(a, b) → string      // For sequential blocks (keeps dominant)
worstCase(arr) → string             // For if/elif/else branches
multiplyStepStr(a, b, result) → string  // Human-readable step string
```

**Multiply Table:** 40 entries covering all realistic exam combinations (e.g., `log_n × n → n_log_n`, `n × n → n2`, `sqrt_n × sqrt_n → n`)

#### complexityParser.js

Parses raw Python source into typed line objects:

```js
parseLines(code) → Line[]
// Line: { lineNum, raw, stripped, indent, kind, meta }
// Kinds: empty, for_range, for_iter, while, if, elif, else, def, update, assign, stmt

analyzeExpression(expr) → string
// Maps Python expressions to complexity keys
// e.g., 'n' → 'n', 'n**2' → 'n2', 'len(...)' → 'n', 'sorted(...)' → 'n_log_n'

splitArgs(argsStr) → string[]
// Splits comma-separated args respecting nested parentheses

analyzeRangeArgs(rangeArgs) → string
// Analyses range(stop), range(start, stop), range(start, stop, step)

parseWhileCondition(condition) → { var, bound, boundKind } | null
// Handles: i <= n, i < n, i*i <= n, n >= i
// boundKind: 'direct' | 'sqrt_product'
```

#### complexityEngine.js

Main analysis engine. Exports one function:

```js
analyzeComplexity(code) → {
  finalComplexity: string,
  annotations: Annotation[],
  steps: Step[],
  error?: string
}
```

**Algorithm:**
1. Parse lines with `parseLines()`
2. Filter out empty lines, find minimum indent
3. Call `analyzeBlock()` recursively
4. Push divider and final steps
5. Return result (or error on failure)

**Key Functions:**
- `analyzeBlock()` — processes lines sequentially, dispatches to handlers, combines with `sumComplexities`
- `handleForRange()` — analyses `for i in range(...)`, creates new context with loop variable, multiplies iteration count by body complexity
- `handleForIter()` — analyses `for x in iterable`, similar to handleForRange
- `handleWhile()` — analyses while loops with **geometric series detection** (critical special case)
- `handleIfElse()` — analyses if/elif/else branches, takes worst case

**Geometric Series Detection:**
- Detects: `while i < n: i *= 2; for j in range(i)`
- Recognizes multiplicative update (`*=`, `/=`, `//=`) + inner for loop using loop variable
- Correctly identifies as O(n) instead of O(n log n)
- Adds special warning steps explaining the geometric series: `Σ(k=1,2,4,...,n) = 2n−1`

**Helper Functions:**
- `logOf(bound)` — converts complexity to logarithmic form
- `sqrtOf(bound)` — converts complexity to square root form
- `resolveExpr(expr, ctx)` — resolves identifiers from context
- `findBodyIndent()` — finds indent level of block body
- `findUpdate()` — finds update statements for a variable
- `checkBuiltinCall()` — detects built-in operations like `.sort()`, `sorted()`, `heapq.`

### Complexity Keys

The engine uses short string keys internally:

| Key | Display | Meaning |
|---|---|---|
| `'1'` | O(1) | Constant |
| `'log_n'` | O(log n) | Logarithmic |
| `'log2_n'` | O(log² n) | Log squared |
| `'sqrt_n'` | O(√n) | Square root |
| `'sqrt_n_log_n'` | O(√n · log n) | Square root times log |
| `'n'` | O(n) | Linear |
| `'n_log_n'` | O(n log n) | Linearithmic |
| `'n_sqrt_n'` | O(n√n) | Linear times square root |
| `'n2'` | O(n²) | Quadratic |
| `'n2_log_n'` | O(n² log n) | Quadratic times log |
| `'n3'` | O(n³) | Cubic |
| `'n3_log_n'` | O(n³ log n) | Cubic times log |
| `'exp_n'` | O(2ⁿ) | Exponential |
| `'unknown'` | O(?) | Unknown |

### Example Analysis

**Input:**
```python
def example(n):
    for i in range(n):
        for j in range(n):
            print(i, j)
```

**Output:**
- Step 1: `for i in range(n): → O(n) iterations`
- Step 2: `  for j in range(n): → O(n) iterations`
- Step 3: `    └─ body: O(1)  →  O(n) × O(1) = O(n)`
- Step 4: `  └─ body: O(n)  →  O(n) × O(n) = O(n²)`
- Final: `FINAL COMPLEXITY: O(n²)`

**Annotations:**
- Outer for loop (lines 2-4): O(n²) — purple bracket
- Inner for loop (lines 3-4): O(n) — blue bracket

### Files Created

**Engine Layer (src/lib/algo/):**
- `complexityTypes.js` (42 lines)
- `complexityAlgebra.js` (74 lines)
- `complexityParser.js` (198 lines)
- `complexityEngine.js` (231 lines) — split into two files to stay under 200 lines
- `complexityEngineHelpers.js` (84 lines)

**Component Layer (src/components/algo/):**
- `ComplexityInput/ComplexityInput.jsx` (84 lines)
- `ComplexityInput/ComplexityInput.module.css` (109 lines)
- `ComplexityCodeView/ComplexityCodeView.jsx` (143 lines)
- `ComplexityCodeView/ComplexityCodeView.module.css` (83 lines)
- `ComplexityTerminal/ComplexityTerminal.jsx` (116 lines)
- `ComplexityTerminal/ComplexityTerminal.module.css` (139 lines)

**Page Layer (src/pages/):**
- `ComplexityPage.jsx` (90 lines)
- `ComplexityPage.module.css` (80 lines)

**Modified Files:**
- `src/App.jsx` — added lazy route `/algo/complexity` with 1500ms preload delay
- `src/components/layout/Sidebar/Sidebar.jsx` — added Algorithms NavGroup between Database and Logic

**Total:** 13 new files, 2 modified files

### Design Principles

1. **Pure JavaScript** — No LLM APIs, no external services, fully algorithmic
2. **CSS Modules only** — No Tailwind classes in JSX
3. **File size limit** — No file exceeds 200 lines (split complexityEngine into two files)
4. **Consistent patterns** — Follows existing component structure (Navbar, Starfield, Sidebar)
5. **Accurate analysis** — Handles geometric series, nested loops, conditionals, while loops with multiplicative updates

---

## Admin Panel

### Overview

Internal content-management system for editing the site's markdown notes
content (see [markdown-notes-setup.md](../markdown-notes-setup.md)). Not
one of the public-facing teaching tools — gated behind Supabase Auth and
not linked from the public nav.

**Routes:** `/admin` (login), `/admin/editor` (main editor), `/admin/users`
(owner-only user management).

### Architecture

```
src/
├── pages/admin/
│   ├── AdminLogin.jsx      Email/password sign-in via supabase.auth.signInWithPassword
│   ├── AdminEditor.jsx     Main markdown content editor (largest admin screen)
│   ├── AdminUsers.jsx      Owner-only user management — 403s non-owners
│   └── useAdmin.js         Auth-guard hook: redirects to /admin if unauthenticated
│
├── components/admin/
│   ├── EditorNavbar/, FormattingToolbar, StyleDropdown, PreviewModal
│   ├── DirectoryDrawer     Content directory tree/picker
│   ├── UsersDrawer         User list + create/edit/delete UI
│   ├── ImageCleanupDrawer  Finds and removes unused uploaded images
│   ├── ChangePasswordModal, SocialLinkModal, FormulaModal
│   ├── ToastNotification   Admin-scoped toast
│   └── adminIconOptions.js Phosphor icon picker for admin-managed content
│
├── lib/adminSupabase.js     getAdminProfile(userId) — fetches admin_users row
│
└── styles/adminTokens.css   Admin's own expanded token set — see docs/design/colors.md
```

Backend: two Supabase Edge Functions using the service-role key —
`supabase/functions/admin-create-user/` and `admin-delete-user/` — both
verify the caller is an `owner` (via the `admin_users` table) before
acting, validate the role enum, and (create) roll back the created auth
user if the profile insert fails, or (delete) refuse to let an owner
delete themselves.

### Auth & roles

- **Table:** `admin_users` ([db/sql/0016_init_admin_users.sql](../db/sql/0016_init_admin_users.sql)) — `id` (FK to `auth.users`), `username`, `role` (`owner` | `contributor`), `allowed_directories` (text array, contributors only).
- **Login** is plain Supabase Auth — any authenticated Supabase user reaches `/admin/editor` if `useAdmin()`'s `getAdminProfile` call succeeds; a non-admin authenticated user has no `admin_users` row so that query throws and `useAdmin` redirects to `/admin`.
- **Owner-only pages** (`AdminUsers`) explicitly check `profile.role === 'owner'` and render a 403 otherwise. `useAdmin()` itself does not gate on role — it only guards "is authenticated + has a profile."
- **RLS:** self-referencing policy on `admin_users` (owners can see all rows via a subquery against the same table) — see the admin-panel epic/tickets for hardening notes on this pattern.

### Deleting a subject is a soft delete

`handleDeleteModule` (`src/hooks/useEditorModules.js`) only removes the
subject's entry from `modules.js` and its two `notes/`/`tools/` `.gitkeep`
placeholders — it does **not** delete the subject's actual note or image
files. They remain in the repo under `src/content/notes/{subjectId}/` and
`public/notes/img/{subjectId}/`, just no longer reachable from the admin
UI (the Image Cleanup tool only scans subjects still present in
`modules.js`).

This is intentional to avoid an irreversible bulk-delete with no
rollback. To actually reclaim a deleted subject's storage, an owner must
remove those two directories manually via the GitHub repo (file browser
or a local clone + `git rm -r` + push) — the app has no in-UI path for
this.

### Known issues

Tracked as tickets rather than inline notes here — see [tickets/](../tickets/) filed under the admin-panel-hardening epic in [epics/](../epics/) for specifics found during the 2026-07-19 audit.
6. **Visual clarity** — Color-coded brackets, step-by-step terminal output, proper mathematical notation
