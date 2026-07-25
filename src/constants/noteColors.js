// Preset swatches for the note-editor text color / highlight pickers (T-055).
// Deliberately separate from `colors.js` — these are user-content colors an
// admin applies to note text, not app-chrome tokens, so the "no new colors
// without updating a token file" rule in docs/design/colors.md doesn't apply
// here. Brand purple/orange come first, then a small standard hue set.
//
// Highlight tones are pre-darkened/desaturated (not a straight port of Google
// Docs' light-mode pastels) because notes render on `colors.bg` (#000000) —
// a bright pastel highlight would wash out or make the underlying text
// unreadable there.

export const TEXT_COLOR_SWATCHES = [
  { label: 'Purple (brand)', hex: '#8B5CF6' },
  { label: 'Orange (brand)', hex: '#EA6C0A' },
  { label: 'Red', hex: '#EF4444' },
  { label: 'Amber', hex: '#F59E0B' },
  { label: 'Yellow', hex: '#EAB308' },
  { label: 'Green', hex: '#22C55E' },
  { label: 'Teal', hex: '#14B8A6' },
  { label: 'Blue', hex: '#3B82F6' },
  { label: 'Pink', hex: '#EC4899' },
  { label: 'Gray', hex: '#9CA3AF' },
]

export const HIGHLIGHT_SWATCHES = [
  { label: 'Purple', hex: '#3B2A5E' },
  { label: 'Orange', hex: '#5C3A1A' },
  { label: 'Red', hex: '#5C2323' },
  { label: 'Amber', hex: '#5C4419' },
  { label: 'Yellow', hex: '#565426' },
  { label: 'Green', hex: '#204A2E' },
  { label: 'Teal', hex: '#1B4A46' },
  { label: 'Blue', hex: '#1E3A5C' },
  { label: 'Pink', hex: '#5C2140' },
  { label: 'Gray', hex: '#3A3A3E' },
]

export const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i
