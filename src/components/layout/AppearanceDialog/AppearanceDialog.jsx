import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, BellOff, Check, ChevronDown, Monitor, Moon, Palette, Sun, X } from 'lucide-react'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '../../animate-ui/primitives/headless/dialog'
import ChatAvatar from '../../../features/chat/components/ChatAvatar/ChatAvatar'
import ColorWheel from '../../ui/ColorWheel/ColorWheel'
import { useTheme } from '../../../hooks/useTheme'
import useIslandNotifications, {
  setIslandNotificationsEnabled,
} from '../../../hooks/useIslandNotifications'
import styles from './AppearanceDialog.module.css'

const MODE_OPTIONS = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
]

export default function AppearanceDialog({ open, onClose, sessionId }) {
  const { colorTheme, customHex, mode, setColorTheme, setCustomColor, setMode, themes, isCustom } =
    useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(isCustom)
  const dropdownRef = useRef(null)
  const notificationsEnabled = useIslandNotifications()

  const activeTheme = themes.find((t) => t.key === colorTheme)
  const activeLabel = isCustom ? 'Custom' : (activeTheme?.name ?? 'Theme')
  const activeSwatch = isCustom ? customHex : activeTheme?.seed

  useEffect(() => {
    if (!dropdownOpen) return undefined
    const onPointerDown = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setDropdownOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [dropdownOpen])

  return (
    <Dialog open={open} onClose={onClose} className={styles.dialog}>
      <DialogBackdrop className={styles.backdrop} />

      <div className={styles.positioner}>
        <DialogPanel from="bottom" className={styles.panel}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>

          {/* Identity row — avatar left, session id beside it */}
          <div className={styles.identity}>
            <ChatAvatar sessionId={sessionId} size={48} />
            <div className={styles.identityText}>
              <DialogTitle className={styles.identityTitle}>Your session</DialogTitle>
              <code className={styles.sessionId} title={sessionId}>
                {sessionId}
              </code>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Mode — M3 segmented button group with icons */}
          <div className={styles.sectionLabel}>Mode</div>
          <div className={styles.segmented} role="group" aria-label="Colour mode">
            {MODE_OPTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                className={`${styles.segmentButton} ${mode === key ? styles.segmentButtonActive : ''}`}
                onClick={() => setMode(key)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Theme — dropdown of the presets, plus a custom colour escape hatch */}
          <div className={styles.sectionLabel}>Theme</div>
          <div className={styles.dropdownWrap} ref={dropdownRef}>
            <button
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => setDropdownOpen((p) => !p)}
              aria-expanded={dropdownOpen}
            >
              <span className={styles.swatchDot} style={{ backgroundColor: activeSwatch }} />
              <span className={styles.dropdownLabel}>{activeLabel}</span>
              <ChevronDown
                size={16}
                className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.ul
                  className={styles.dropdownMenu}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                >
                  {themes.map((theme) => (
                    <li key={theme.key}>
                      <button
                        type="button"
                        className={styles.dropdownOption}
                        onClick={() => {
                          setColorTheme(theme.key)
                          setWheelOpen(false)
                          setDropdownOpen(false)
                        }}
                      >
                        <span
                          className={styles.swatchDot}
                          style={{ backgroundColor: theme.seed }}
                        />
                        <span className={styles.dropdownLabel}>{theme.name}</span>
                        {colorTheme === theme.key && <Check size={15} className={styles.check} />}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            className={`${styles.customToggle} ${wheelOpen ? styles.customToggleActive : ''}`}
            onClick={() => setWheelOpen((p) => !p)}
            aria-expanded={wheelOpen}
          >
            <Palette size={16} />
            <span>Custom colour</span>
            <ChevronDown
              size={15}
              className={`${styles.chevron} ${wheelOpen ? styles.chevronOpen : ''}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {wheelOpen && (
              <motion.div
                className={styles.wheelWrap}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              >
                <ColorWheel value={customHex} onChange={setCustomColor} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.divider} />

          {/* Notifications — the pill only. The sidebar badge keeps counting
              either way, so this can never lose a message. */}
          <div className={styles.sectionLabel}>Notifications</div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            className={styles.switchRow}
            onClick={() => setIslandNotificationsEnabled(!notificationsEnabled)}
          >
            <span className={styles.switchIcon}>
              {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </span>
            <span className={styles.switchText}>
              <span className={styles.switchLabel}>Pop-up alerts</span>
              <span className={styles.switchHint}>
                New posts and messages appear in the island. The sidebar badge
                counts them either way.
              </span>
            </span>
            <span
              className={`${styles.switchTrack} ${
                notificationsEnabled ? styles.switchTrackOn : ''
              }`}
            >
              <span className={styles.switchThumb} />
            </span>
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
