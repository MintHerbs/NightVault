# Project Coding Rules & Standards

## Core Principles

This document defines the mandatory coding standards for this project. All code must follow these rules to maintain consistency, readability, and maintainability.

---

## 1. Component Structure

### 1.1 Component Organization

**MANDATORY**: Every component must follow this folder structure:

```
src/components/ComponentName/
├── ComponentName.jsx          ← Main component file
├── ComponentName.module.css   ← Component-specific styles
└── index.js                   ← Optional: Clean re-exports
```

**Example**:
```
src/components/DynamicIsland/
├── DynamicIsland.jsx
├── DynamicIsland.module.css
└── index.js
```

### 1.2 Multi-Component Features

When a feature requires multiple related components, create a feature folder:

```
src/components/feature-name/
├── index.js                   ← Re-exports all components
├── MainComponent.jsx          ← Primary component
├── MainComponent.module.css
├── SubComponent1.jsx          ← Supporting component
├── SubComponent1.module.css
├── SubComponent2.jsx
└── SubComponent2.module.css
```

**Example**:
```
src/components/dynamic-island/
├── index.js
├── DynamicIsland.jsx
├── DynamicIsland.module.css
├── AIStateContent.jsx
├── ObservingAnimation.jsx
├── WaitingAnimation.jsx
└── ThinkingAnimation.jsx
```

---

## 2. File Naming Conventions

### 2.1 Component Files
- **Components**: `PascalCase.jsx` (e.g., `DynamicIsland.jsx`, `TreeNode.jsx`)
- **CSS Modules**: `PascalCase.module.css` (e.g., `DynamicIsland.module.css`)
- **Utility Files**: `camelCase.js` (e.g., `erdParser.js`, `treeLayout.js`)
- **Hooks**: `useCamelCase.js` (e.g., `useBPlusTree.js`, `useAnimationPlayer.js`)

### 2.2 Folder Names
- **Component folders**: `PascalCase` (e.g., `DynamicIsland/`, `TreeNode/`)
- **Feature folders**: `kebab-case` (e.g., `dynamic-island/`, `animated-text/`)
- **Utility folders**: `camelCase` (e.g., `lib/`, `hooks/`, `engine/`)

---

## 3. Code Organization

### 3.1 Component File Structure

Every component file must follow this order:

```jsx
// 1. Imports - external libraries first, then internal
import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import SubComponent from './SubComponent'
import styles from './Component.module.css'

// 2. Constants (if any)
const MAX_VALUE = 100

// 3. Helper functions (if any)
function helperFunction(value) {
  return value * 2
}

// 4. Main component
export default function Component({ prop1, prop2 }) {
  // 4a. State declarations
  const [state, setState] = useState(null)
  
  // 4b. Refs
  const ref = useRef(null)
  
  // 4c. Effects
  useEffect(() => {
    // Effect logic
  }, [])
  
  // 4d. Event handlers
  const handleClick = () => {
    // Handler logic
  }
  
  // 4e. Render
  return (
    <div className={styles.container}>
      {/* JSX */}
    </div>
  )
}
```

### 3.2 Import Order

1. React and React-related imports
2. Third-party libraries
3. Internal components
4. Utilities and helpers
5. Styles (always last)

**Example**:
```jsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import SubComponent from '../SubComponent/SubComponent'
import { helperFunction } from '../../lib/utils'
import styles from './Component.module.css'
```

---

## 4. Component Extraction Rules

### 4.1 When to Extract a Component

Extract a component when:
- **Reusability**: Used in 2+ places
- **Complexity**: JSX block exceeds 30 lines
- **Logic**: Contains significant state or effects
- **Clarity**: Improves readability of parent component

### 4.2 Component Extraction Process

**Before** (inline JSX):
```jsx
<div className={styles.card}>
  <div className={styles.header}>
    <h3>{title}</h3>
    <button onClick={handleClose}>×</button>
  </div>
  <div className={styles.body}>
    {/* 50+ lines of complex JSX */}
  </div>
</div>
```

**After** (extracted component):
```jsx
// Card.jsx
export default function Card({ title, onClose, children }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <button onClick={onClose}>×</button>
      </div>
      <div className={styles.body}>
        {children}
      </div>
    </div>
  )
}
```

---

## 5. Styling Rules

### 5.1 CSS Modules

**MANDATORY**: Use CSS Modules for all component styles.

```jsx
// ✅ CORRECT
import styles from './Component.module.css'

<div className={styles.container}>
  <h1 className={styles.title}>Title</h1>
</div>
```

```jsx
// ❌ WRONG - No inline styles
<div style={{ padding: '20px', color: 'red' }}>
  <h1 style={{ fontSize: '24px' }}>Title</h1>
</div>
```

**Exception**: Inline styles are allowed ONLY for:
- Dynamic values (e.g., `width: ${percentage}%`)
- Animation libraries that require inline styles
- One-off positioning adjustments

### 5.2 CSS Class Naming

Use descriptive, semantic class names:

```css
/* ✅ CORRECT */
.container { }
.header { }
.title { }
.submitButton { }
.errorMessage { }

/* ❌ WRONG */
.div1 { }
.box { }
.btn { }
.red { }
```

---

## 6. State Management

### 6.1 State Location

- **Local state**: Use `useState` for component-specific state
- **Shared state**: Lift state to nearest common ancestor
- **Global state**: Use context or props drilling (no Redux/Zustand unless necessary)

### 6.2 State Naming

```jsx
// ✅ CORRECT - Descriptive names
const [isOpen, setIsOpen] = useState(false)
const [userName, setUserName] = useState('')
const [selectedItems, setSelectedItems] = useState([])

// ❌ WRONG - Vague names
const [flag, setFlag] = useState(false)
const [data, setData] = useState('')
const [items, setItems] = useState([])
```

---

## 7. Props and Prop Drilling

### 7.1 Prop Naming

- **Boolean props**: Prefix with `is`, `has`, `should`, `can`
- **Event handlers**: Prefix with `on`
- **Data props**: Use descriptive nouns

```jsx
// ✅ CORRECT
<Component
  isOpen={true}
  hasError={false}
  shouldAnimate={true}
  onClose={handleClose}
  onSubmit={handleSubmit}
  userData={user}
  itemCount={10}
/>

// ❌ WRONG
<Component
  open={true}
  error={false}
  animate={true}
  close={handleClose}
  submit={handleSubmit}
  data={user}
  count={10}
/>
```

### 7.2 Prop Destructuring

Always destructure props in function signature:

```jsx
// ✅ CORRECT
export default function Component({ title, isOpen, onClose }) {
  return <div>{title}</div>
}

// ❌ WRONG
export default function Component(props) {
  return <div>{props.title}</div>
}
```

---

## 8. Comments and Documentation

### 8.1 File Headers

Every file should have a brief comment describing its purpose:

```jsx
// Main visualization screen - two-column layout with TreeCanvas and OperationsPanel
import { useState } from 'react'
// ... rest of file
```

### 8.2 Complex Logic

Add comments for non-obvious logic:

```jsx
// ✅ CORRECT
// Calculate the midpoint for binary search
const mid = Math.floor((left + right) / 2)

// Debounce API calls to prevent rate limiting
const debouncedSearch = debounce(searchAPI, 300)
```

### 8.3 Avoid Obvious Comments

```jsx
// ❌ WRONG - Comment states the obvious
// Set the state to true
setState(true)

// Increment counter by 1
setCounter(counter + 1)
```

---

## 9. Performance Optimization

### 9.1 Lazy Loading

Use lazy loading for route components:

```jsx
// ✅ CORRECT
const TreePage = lazy(() => import('./pages/TreePage'))
const ERDPage = lazy(() => import('./pages/ERDPage'))

<Suspense fallback={null}>
  <Routes>
    <Route path="/tree" element={<TreePage />} />
    <Route path="/erd" element={<ERDPage />} />
  </Routes>
</Suspense>
```

### 9.2 Code Splitting

Configure Vite for manual chunk splitting:

```js
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tree-feature': ['./src/pages/TreePage.jsx', /* ... */],
          'erd-feature': ['./src/pages/ERDPage.jsx', /* ... */]
        }
      }
    }
  }
})
```

---

## 10. Animation Guidelines

### 10.1 Animation Libraries

- **Preferred**: Framer Motion (`motion/react`)
- **Avoid**: CSS animations for complex interactions

### 10.2 Animation Timing

- **Fast interactions**: 150-250ms (buttons, hovers)
- **Medium transitions**: 300-500ms (modals, panels)
- **Slow animations**: 600-1200ms (page transitions, scramble effects)

### 10.3 Accessibility

Always respect `prefers-reduced-motion`:

```jsx
useEffect(() => {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  setShouldReduceMotion(motionQuery.matches)
}, [])

if (shouldReduceMotion) {
  // Skip animation
  return
}
```

---

## 11. Error Handling

### 11.1 Input Validation

Always validate user input:

```jsx
// ✅ CORRECT
const handleSubmit = (value) => {
  if (!value || typeof value !== 'string') {
    console.error('Invalid input')
    return
  }
  // Process value
}
```

### 11.2 Null Checks

Check for null/undefined before accessing properties:

```jsx
// ✅ CORRECT
if (!data || !data.items) {
  return <div>No data</div>
}

// ❌ WRONG - Will crash if data is null
return <div>{data.items.length}</div>
```

---

## 12. Git and Version Control

### 12.1 Commit Messages

Use conventional commit format:

```
feat: add scramble animation to text transitions
fix: resolve undefined error in ScrambleText component
refactor: extract DynamicIsland into separate components
style: update button hover states
docs: add coding rules documentation
```

### 12.2 Branch Naming

- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/component-name` - Code refactoring
- `docs/documentation-update` - Documentation changes

---

## 13. Testing (Future)

### 13.1 Test File Location

Place test files next to the component:

```
src/components/TreeNode/
├── TreeNode.jsx
├── TreeNode.module.css
└── TreeNode.test.jsx
```

### 13.2 Test Naming

```jsx
describe('TreeNode', () => {
  it('renders with correct value', () => {
    // Test logic
  })
  
  it('handles click events', () => {
    // Test logic
  })
})
```

---

## 14. Shared Input Surfaces

### 14.1 One Input Language

**MANDATORY**: A tool that asks the visitor a question uses the shared pill.
Do not build a new text input.

| Input | Use it for |
|---|---|
| `src/components/ui/PillInput/PillInput.jsx` | Single-line questions — a scenario, an expression, a formula |
| `src/components/ui/CodePillInput/CodePillInput.jsx` | The same, when the answer is code or notation that needs a monospace face |
| `src/features/chat/components/ChatInput/ChatInput.jsx` | Chat only |

Every tool's landing screen is the same three things in the same order:
`ScrambleText` title → subtitle → pill. `ERDStep1.jsx` is the reference.

```jsx
// ✅ CORRECT
import PillInput from '../../../../components/ui/PillInput/PillInput'

<PillInput
  onSubmit={handleSubmit}
  onAIStateChange={onAIStateChange}
  placeholder="e.g. A university has students who enroll in courses..."
/>
```

```jsx
// ❌ WRONG — a second text field in the app's fourth visual language
<div className={styles.field}>
  <label className={styles.label}>{label}</label>
  <input className={styles.input} value={value} onChange={...} />
</div>
```

### 14.2 What May Sit Around It

Tool-specific affordances **beside** the pill are fine and encouraged: a symbol
bar, example chips, a mode dropdown, an escape hatch link. The rule is about the
input control itself. One question, one pill.

### 14.3 Extending Rather Than Forking

If the shared pill cannot do what a tool needs, **extend the shared component**
and keep the change additive — a new optional prop that leaves every existing
call site behaving exactly as before. Forking it into a feature folder is what
this rule exists to prevent.

If a bespoke input is genuinely unavoidable, say why in a comment at the top of
the file and in the ticket. An input that exists because nobody checked is a
defect, not a decision.

---

## 15. The Dynamic Island Is the Feedback Channel

### 15.1 Every Tool Input Drives It

**MANDATORY**: When a visitor interacts with a tool's input, the island reacts.
A page that computes silently looks broken, whether it took 4ms or 4s.

Pages receive `onAIStateChange` as a prop
(`src/routes/index.jsx` → `src/App.jsx`) and pass it down. The vocabulary is
fixed — `src/components/layout/DynamicIsland/AIStateContent.jsx` is the only
place that maps a state to a visual:

| State | When |
|---|---|
| `observing` | The input has focus. Fires on click, before any typing |
| `waiting` | Queued behind something — a rate limit, another request |
| `thinking` | Working locally. Parsing, minimising, laying out |
| `generating` | A model call is in flight |
| `error` | Failed, with `errorMessage` set |
| `idle` | Nothing happening. **Always** the resting state |

### 15.2 Always Return to Idle

Every path out of a working state sets `idle`, including the error path and
unmount:

```jsx
// ✅ CORRECT — the pill cannot be stranded mid-animation
useEffect(() => () => setAIState('idle'), [setAIState])
```

### 15.3 Route Through a Stable Wrapper

`App` recreates its handler every render. Calling the prop directly re-fires
island effects on unrelated re-renders. Hold it in a ref:

```jsx
const notifyRef = useRef(onAIStateChange)
useEffect(() => { notifyRef.current = onAIStateChange }, [onAIStateChange])
const setAIState = useCallback((state) => {
  if (typeof notifyRef.current === 'function') notifyRef.current(state)
}, [])
```

Then use `setAIState` **everywhere** in the page, including the props passed to
child input components. One raw-prop call site defeats the wrapper.

### 15.4 Synchronous Work Still Needs a Visible State

Setting `thinking` and `idle` in the same synchronous block paints nothing. Work
that finishes instantly holds its state for a minimum dwell before clearing.
`src/hooks/useAIState.js` does this; the dwell belongs in the caller, never in
the island — the island's job is to show a state, not to guess how long it
should have lasted.

### 15.5 Give States Their Own Character

The animations are `GridLoader`
(`src/components/effects/smoothui/grid-loader/index.tsx`), which exposes ~50
patterns plus `mode`, `color`, `blur` and `gap`. Different kinds of work should
not animate identically — a local minimisation is not a model call, and reading
the same amber frame for both tells the visitor nothing.

---

## 16. Enforcement

### 16.1 Code Review Checklist

Before submitting code, verify:

- [ ] Component follows folder structure
- [ ] CSS uses modules (no inline styles except exceptions)
- [ ] Props are properly named and destructured
- [ ] State is in the correct location
- [ ] Complex logic has comments
- [ ] No console.logs in production code
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Input validation is present
- [ ] File has descriptive header comment
- [ ] Question inputs use the shared pill (§14), not a bespoke field
- [ ] The island reacts to the input and always returns to idle (§15)

### 16.2 Refactoring Triggers

Refactor immediately when:
- Component exceeds 300 lines
- JSX block exceeds 50 lines without extraction
- Function exceeds 30 lines
- Duplicate code appears 3+ times
- CSS file exceeds 500 lines

---

## 17. Examples

### 17.1 Good Component Example

```jsx
// Animated text component that scrambles characters on view transitions
import { useEffect, useRef, useState } from 'react'

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')

function scrambleText(original) {
  if (!original || typeof original !== 'string') {
    return ''
  }
  return original
    .split('')
    .map((char) => char === ' ' ? ' ' : CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)])
    .join('')
}

export default function ScrambleText({
  children,
  className = '',
  duration = 1200,
  speed = 60,
  skipInitialAnimation = false
}) {
  const [display, setDisplay] = useState(children)
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)
  const [isInitialMount, setIsInitialMount] = useState(true)
  const timeoutRef = useRef(null)
  const intervalRef = useRef(null)

  // Respect user's motion preferences
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setShouldReduceMotion(motionQuery.matches)

    const handleMotionChange = (e) => {
      setShouldReduceMotion(e.matches)
    }

    motionQuery.addEventListener('change', handleMotionChange)
    return () => motionQuery.removeEventListener('change', handleMotionChange)
  }, [])

  // Trigger scramble animation
  useEffect(() => {
    if (skipInitialAnimation && isInitialMount) {
      setIsInitialMount(false)
      setDisplay(children)
      return
    }

    if (isInitialMount) {
      setIsInitialMount(false)
    }

    if (shouldReduceMotion || !children || typeof children !== 'string') {
      setDisplay(children)
      return
    }

    // Clear existing timers
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Start scrambling
    intervalRef.current = setInterval(() => {
      setDisplay(() => scrambleText(children))
    }, speed)

    // Stop after duration
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setDisplay(children)
    }, duration)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [children, duration, speed, shouldReduceMotion, skipInitialAnimation, isInitialMount])

  return <span className={className}>{display}</span>
}
```

---

## Summary

These rules ensure:
- ✅ **Consistency**: All code follows the same patterns
- ✅ **Maintainability**: Easy to understand and modify
- ✅ **Scalability**: Structure supports growth
- ✅ **Performance**: Optimized bundle sizes and loading
- ✅ **Accessibility**: Respects user preferences
- ✅ **Quality**: Clean, readable, professional code

**Remember**: These are not suggestions—they are mandatory standards for this project.
