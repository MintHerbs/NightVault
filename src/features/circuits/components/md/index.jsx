/**
 * Material You primitives for the Digital Logic tool (T-089).
 *
 * Local to this feature on purpose. The project has exactly one shared M3
 * component today (`components/ui/Card`), and promoting a half-dozen more into
 * `components/ui/` off the back of one tool would be guessing at an API the
 * rest of the app has not asked for. If a second feature wants these, that is
 * the moment to lift them.
 *
 * All colour, shape and motion comes from the `--md-*` tokens in
 * src/styles/global.css, so every one of these follows the nine themes and both
 * modes without knowing anything about them.
 *
 * No MUI, no @material/web (docs/rules.md §5.2).
 */
import { Check } from 'lucide-react'
import styles from './Md.module.css'

export { styles as md }

const cx = (...parts) => parts.filter(Boolean).join(' ')

/**
 * M3 common button.
 * @param {'filled'|'tonal'|'outlined'|'text'} [variant]
 */
export function Button({ variant = 'text', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={cx(styles.button, styles.stateLayer, styles[variant], className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * M3 icon button. `label` becomes the accessible name, since the glyph is the
 * only visible content.
 * @param {'standard'|'filled'|'tonal'} [variant]
 */
export function IconButton({ variant = 'standard', label, className = '', children, ...rest }) {
  const tone = variant === 'filled' ? styles.iconButtonFilled
    : variant === 'tonal' ? styles.iconButtonTonal
      : ''
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, styles.stateLayer, tone, className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * M3 segmented button. One outlined container, the selected segment filled
 * with the primary-container role and carrying the spec's check icon.
 *
 * M3 assigns the selected segment `secondary-container`; this project's token
 * set only emits `primary-container` per theme, so that is what is used. The
 * alternative was inventing a secondary ramp for nine themes to serve one
 * component.
 *
 * @param {Array<{id: string, label: string}>} options
 */
export function SegmentedButton({ options, value, onChange, label, className = '' }) {
  return (
    <div className={cx(styles.segmented, className)} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            className={cx(styles.segment, styles.stateLayer, selected && styles.segmentSelected)}
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
          >
            {selected && <Check size={18} className={styles.segmentCheck} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** M3 assist / filter chip. */
export function Chip({ selected = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={cx(styles.chip, styles.stateLayer, selected && styles.chipSelected, className)}
      aria-pressed={rest.onClick ? selected : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
