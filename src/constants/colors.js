// Single source of truth for all color tokens used across the app
export const colors = {
  // Brand
  accent:        '#8B5CF6',   // primary purple
  orange:        '#EA6C0A',   // secondary orange
  bg:            '#000000',
  surface:       '#0f0f0f',
  card:          '#0a0a0a',
  panel:         '#1a1a2e',
  border:        '#222222',
  text:          '#ffffff',
  textMuted:     'rgba(255,255,255,0.6)',
  error:         '#ef4444',
  warning:       '#facc15',
  success:       '#22c55e',

  // Sidebar icon states.
  //
  // iconOff is ICON-ONLY and must not be reused for text. At 0.38 alpha on the
  // page background it measures ~3.4:1 — that clears WCAG's 3:1 bar for
  // non-text UI components, but is below the 4.5:1 required for text. For
  // low-emphasis *text*, use --md-on-surface-variant instead (see LT-001).
  iconOff:       'rgba(255,255,255,0.38)',  // inactive — subtle on black
  iconHover:     'rgba(255,255,255,0.75)',  // hover — visible but not full
  iconActive:    '#8B5CF6',                 // active — accent purple
  iconActiveAlt: '#EA6C0A',                 // active alt — orange for external tools
}

// Material You (M3) dark scheme — mirrors the --md-* custom properties in
// src/styles/global.css for the JS side. Seeded from colors.accent, not
// Material's baseline purple. See docs/design/colors.md.
export const md = {
  // Surface container tones — M3 elevation is tonal, not shadow-based
  surfaceContainerLow:  '#131117',
  surfaceContainer:     '#1a171f',
  surfaceContainerHigh: '#241f2b',

  // Primary + tonal container
  primary:            '#8B5CF6',  // same value as colors.accent
  onPrimary:          '#ffffff',
  primaryContainer:   '#2e2148',
  onPrimaryContainer: '#d9c8ff',

  // Text on surfaces
  onSurface:        '#eae5ef',
  onSurfaceVariant: '#c9c2d2',
  outlineVariant:   '#2c2833',

  // State layer opacities — M3 spec values
  stateHover:   0.08,
  stateFocus:   0.10,
  statePressed: 0.12,
}
