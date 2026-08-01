/**
 * ExpressionField - M3 filled text field for the expression input (T-089).
 *
 * Not `components/ui/PillInput`. That primitive is shared by four other tools
 * and restyling it to M3 would restyle all of them; giving it a variant prop
 * would put a design decision this tool made into a component the others own.
 * A local field is the smaller change.
 *
 * Follows the M3 filled variant: a `surface-container-high` container with
 * rounded top corners only, a resting bottom indicator that thickens and
 * takes the primary colour on focus, and a label that floats into the space
 * above the text.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {Function} props.onChange - called with the new string
 * @param {Function} props.onSubmit - called with the current value
 * @param {string} props.label
 * @param {string} [props.placeholder] - only visible once the label has floated
 * @param {string} [props.supporting] - helper line under the field
 * @param {boolean} [props.error]
 * @param {React.RefObject} [props.inputRef]
 */
import { useId, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { IconButton } from '../md'
import styles from './ExpressionField.module.css'

export default function ExpressionField({
  value,
  onChange,
  onSubmit,
  label,
  placeholder = '',
  supporting = '',
  error = false,
  inputRef,
}) {
  const id = useId()
  const internalRef = useRef(null)
  const ref = inputRef ?? internalRef
  const [focused, setFocused] = useState(false)

  const populated = focused || value.length > 0
  const submit = () => {
    if (value.trim().length === 0) return
    onSubmit(value)
  }

  return (
    <div className={styles.wrap}>
      <div
        className={[
          styles.field,
          focused ? styles.focused : '',
          error ? styles.error : '',
        ].filter(Boolean).join(' ')}
      >
        <label
          htmlFor={id}
          className={populated ? styles.labelFloating : styles.labelResting}
        >
          {label}
        </label>

        <input
          id={id}
          ref={ref}
          className={styles.input}
          type="text"
          value={value}
          placeholder={populated ? placeholder : ''}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />

        <div className={styles.trailing}>
          <IconButton
            variant={value.trim() ? 'filled' : 'standard'}
            label="Solve"
            disabled={!value.trim()}
            onClick={submit}
          >
            <ArrowUp size={20} aria-hidden="true" />
          </IconButton>
        </div>

        <span className={styles.indicator} aria-hidden="true" />
      </div>

      {supporting && <p className={styles.supporting}>{supporting}</p>}
    </div>
  )
}
