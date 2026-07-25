import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Prohibit } from '@phosphor-icons/react'
import { HEX_COLOR_RE } from '../../constants/noteColors'
import styles from './ColorPickerPopover.module.css'

const LAST_HEX_PREFIX = 'note-editor-last-'

// Shared swatch-grid + custom-hex popover behind the toolbar's text-color and
// highlight buttons (T-055). `kind` is just a localStorage-key namespace so
// each button remembers its own last-used custom color, Docs-style.
export default function ColorPickerPopover({ icon, tooltip, kind, swatches, onPick, onRemove }) {
  const storageKey = `${LAST_HEX_PREFIX}${kind}`
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) {
      setHex('')
      setError(false)
    }
  }, [open])

  const pick = (value) => {
    onPick(value)
    try {
      localStorage.setItem(storageKey, value)
    } catch {
      // localStorage unavailable (private mode, etc.) — last-color memory is
      // a nicety, not required for the picker to work.
    }
    setOpen(false)
  }

  const submitHex = () => {
    const value = hex.trim()
    if (!HEX_COLOR_RE.test(value)) {
      setError(true)
      return
    }
    pick(value)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Popover.Trigger asChild>
            <button className={styles.trigger} type="button">
              {icon}
            </button>
          </Popover.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles.tooltip} sideOffset={5}>
            {tooltip}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <Popover.Portal>
        <Popover.Content className={styles.content} sideOffset={5} align="start">
          <button className={styles.removeOption} onClick={onRemove} type="button">
            <Prohibit size={14} />
            <span>Remove</span>
          </button>

          <div className={styles.grid}>
            {swatches.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                className={styles.swatch}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.label}
                onClick={() => pick(swatch.hex)}
              />
            ))}
          </div>

          <div className={styles.hexRow}>
            <input
              type="text"
              className={styles.hexInput}
              placeholder="#8B5CF6"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value)
                if (error) setError(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitHex()}
            />
            <button type="button" className={styles.hexApply} onClick={submitHex}>
              Apply
            </button>
          </div>
          {error && <div className={styles.hexError}>Enter a valid hex color (e.g. #8B5CF6)</div>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
