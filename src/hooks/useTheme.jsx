import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PRESET_THEMES, derivePalette, normalizeHex } from '../lib/theme/palette'
import { fireQuip } from './useSentinelQuip'

// Preset keys match the [data-color-theme] blocks in src/styles/global.css.
export const COLOR_THEMES = PRESET_THEMES
const COLOR_THEME_KEYS = COLOR_THEMES.map((t) => t.key)
const DEFAULT_COLOR_THEME = 'hub'
const CUSTOM_KEY = 'custom'

export const MODES = ['light', 'dark', 'system']
// Night mode is the site's intended default look, so a light-preferring OS
// shouldn't silently land on light mode first visit — 'system' is opt-in.
const DEFAULT_MODE = 'dark'

const COLOR_THEME_STORAGE_KEY = 'theme-color'
const MODE_STORAGE_KEY = 'theme-mode'
const CUSTOM_HEX_STORAGE_KEY = 'theme-custom-hex'
// Pre-derived custom tokens, cached so index.html's inline no-flash script
// can apply a custom theme without shipping the derivation maths twice.
const CUSTOM_TOKENS_STORAGE_KEY = 'theme-custom-tokens'

// A real hex, not a var() — this is a seed fed to derivePalette(), not a
// CSS value.
const DEFAULT_CUSTOM_HEX = '#ffa31a'

function readStored(key, isValid, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return isValid(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable (private mode, etc.) — the theme still
    // applies for this page load, it just won't be remembered next visit.
  }
}

function getSystemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [colorTheme, setColorThemeState] = useState(() =>
    readStored(
      COLOR_THEME_STORAGE_KEY,
      (v) => v === CUSTOM_KEY || COLOR_THEME_KEYS.includes(v),
      DEFAULT_COLOR_THEME
    )
  )
  const [customHex, setCustomHexState] = useState(() =>
    readStored(CUSTOM_HEX_STORAGE_KEY, (v) => !!normalizeHex(v), DEFAULT_CUSTOM_HEX)
  )
  const [mode, setModeState] = useState(() =>
    readStored(MODE_STORAGE_KEY, (v) => MODES.includes(v), DEFAULT_MODE)
  )
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  const resolvedMode = mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode

  // Sentinel reacts to the mode actually in force rather than to setMode, so a
  // 'system' pick that flips at sunset counts too. The ref starts at the first
  // resolved value so the initial paint is not treated as a switch, which
  // would have Sentinel greet every page load with a remark about the theme.
  const previousMode = useRef(resolvedMode)

  useEffect(() => {
    if (previousMode.current === resolvedMode) return
    previousMode.current = resolvedMode
    fireQuip({ kind: 'chrome', id: resolvedMode === 'dark' ? 'theme-dark' : 'theme-light' })
  }, [resolvedMode])

  useEffect(() => {
    if (mode !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemPrefersDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  // Presets are pure CSS (the [data-color-theme] blocks); a custom colour is
  // derived here and written as inline custom properties on <html>, which
  // outrank those blocks. Switching back to a preset must therefore clear
  // the inline properties or the custom colour would stick.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.colorTheme = colorTheme
    root.dataset.mode = resolvedMode

    const customTokens =
      colorTheme === CUSTOM_KEY ? derivePalette(customHex, resolvedMode) : null

    if (customTokens) {
      for (const [token, value] of Object.entries(customTokens)) {
        root.style.setProperty(token, value)
      }
      writeStored(CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(customTokens))
    } else {
      for (const token of Object.keys(derivePalette('#000000', resolvedMode))) {
        root.style.removeProperty(token)
      }
    }
  }, [colorTheme, customHex, resolvedMode])

  const setColorTheme = useCallback((next) => {
    if (next !== CUSTOM_KEY && !COLOR_THEME_KEYS.includes(next)) return
    setColorThemeState(next)
    writeStored(COLOR_THEME_STORAGE_KEY, next)
  }, [])

  /** Select a user-picked seed colour. Accepts '#rrggbb' or 'rrggbb'. */
  const setCustomColor = useCallback((hex) => {
    const normalized = normalizeHex(hex)
    if (!normalized) return
    setCustomHexState(normalized)
    setColorThemeState(CUSTOM_KEY)
    writeStored(CUSTOM_HEX_STORAGE_KEY, normalized)
    writeStored(COLOR_THEME_STORAGE_KEY, CUSTOM_KEY)
  }, [])

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return
    setModeState(next)
    writeStored(MODE_STORAGE_KEY, next)
  }, [])

  const value = useMemo(
    () => ({
      colorTheme,
      customHex,
      mode,
      resolvedMode,
      setColorTheme,
      setCustomColor,
      setMode,
      themes: COLOR_THEMES,
      isCustom: colorTheme === CUSTOM_KEY,
    }),
    [colorTheme, customHex, mode, resolvedMode, setColorTheme, setCustomColor, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
