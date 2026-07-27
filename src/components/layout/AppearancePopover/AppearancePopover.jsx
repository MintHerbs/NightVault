import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useTheme } from '../../../hooks/useTheme'
import styles from './AppearancePopover.module.css'

const MODE_OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
]

// Representative accent per theme, independent of the current light/dark
// mode — mirrors the seed hex each [data-color-theme] block in
// src/styles/global.css was derived from (T-062).
const SWATCH_HEX = {
  hub: 'var(--color-accent)',
  ghost: 'var(--color-accent)',
  verdant: '#16a34a',
  nebula: '#3b82f6',
  crimson: '#dc2626',
  cyan: '#06b6d4',
  rose: '#ec4899',
  slate: '#64748b',
}

export default function AppearancePopover({ children }) {
  const [open, setOpen] = useState(false)
  const { colorTheme, mode, setColorTheme, setMode, themes } = useTheme()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              forceMount
              side="right"
              align="end"
              sideOffset={12}
              collisionPadding={12}
            >
              <motion.div
                className={styles.content}
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <div className={styles.header}>Appearance</div>

                <div className={styles.segmented}>
                  {MODE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`${styles.segmentButton} ${mode === option.key ? styles.segmentButtonActive : ''}`}
                      onClick={() => setMode(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className={styles.divider} />

                <div className={styles.swatchList}>
                  {themes.map((theme) => (
                    <button
                      key={theme.key}
                      type="button"
                      className={styles.swatchRow}
                      onClick={() => setColorTheme(theme.key)}
                    >
                      <span
                        className={styles.swatchDot}
                        style={{ backgroundColor: SWATCH_HEX[theme.key] }}
                      />
                      <span className={styles.swatchName}>{theme.name}</span>
                      {colorTheme === theme.key && (
                        <Check size={16} className={styles.swatchCheck} />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  )
}
