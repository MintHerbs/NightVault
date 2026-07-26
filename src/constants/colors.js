// Single source of truth for all color tokens used across the app.
//
// These are CSS `var()` references, not literal hex, so anything using them
// as an inline style value follows the selected theme and light/dark mode
// (T-062). Two consequences worth knowing:
//   - They only work where a CSS value is expected. A canvas context or a
//     third-party widget configured with plain colour strings (Monaco)
//     needs resolveThemeColor() from src/lib/theme/palette.js first.
//   - `var()` is invalid in an SVG *presentation attribute*
//     (fill="…"/stroke="…"). Set those through `style` instead.
export const colors = {
  // Brand
  accent:        'var(--color-accent)',       // primary brand accent
  orange:        'var(--color-accent-alt)',   // secondary "group" accent
  bg:            'var(--color-bg)',
  surface:       'var(--color-surface)',
  card:          'var(--md-surface-container-low)',
  panel:         'var(--bg-card)',
  border:        'var(--color-border)',
  text:          'var(--color-text)',
  textMuted:     'rgba(var(--color-fg-rgb), 0.6)',
  // Semantic status colours — deliberately fixed across every theme, since
  // "error" must not turn green because the user picked Verdant.
  error:         '#ef4444',
  warning:       '#facc15',
  success:       '#22c55e',

  // Sidebar icon states.
  //
  // iconOff is ICON-ONLY and must not be reused for text. At 0.38 alpha on the
  // page background it measures ~3.4:1 — that clears WCAG's 3:1 bar for
  // non-text UI components, but is below the 4.5:1 required for text. For
  // low-emphasis *text*, use --md-on-surface-variant instead (see LT-001).
  iconOff:       'rgba(var(--color-fg-rgb), 0.38)',  // inactive — subtle on black
  iconHover:     'rgba(var(--color-fg-rgb), 0.75)',  // hover — visible but not full
  iconActive:    'var(--color-accent)',                 // active — brand orange
  iconActiveAlt: 'var(--color-accent-alt)',                 // active alt — orange for external tools
}

// Material You (M3) roles — mirrors the --md-* custom properties in
// src/styles/global.css for the JS side. Same var() caveats as `colors`.
export const md = {
  // Surface container tones — M3 elevation is tonal, not shadow-based
  surfaceContainerLow:  'var(--md-surface-container-low)',
  surfaceContainer:     'var(--md-surface-container)',
  surfaceContainerHigh: 'var(--md-surface-container-high)',

  // Primary + tonal container
  primary:            'var(--md-primary)',  // same value as colors.accent
  onPrimary:          'var(--md-on-primary)',
  primaryContainer:   'var(--md-primary-container)',
  onPrimaryContainer: 'var(--md-on-primary-container)',

  // Text on surfaces
  onSurface:        'var(--md-on-surface)',
  onSurfaceVariant: 'var(--md-on-surface-variant)',
  outlineVariant:   'var(--md-outline-variant)',

  // State layer opacities — M3 spec values
  stateHover:   0.08,
  stateFocus:   0.10,
  statePressed: 0.12,
}
