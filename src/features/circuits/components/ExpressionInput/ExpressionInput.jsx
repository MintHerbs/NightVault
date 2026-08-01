/**
 * ExpressionInput - the landing surface for the Digital Logic modes (T-089, T-092).
 *
 * The input itself is the shared PillInput, same as ERD, the tree and the logic
 * tools (docs/rules.md §14). T-089 shipped a bespoke filled text field here; it
 * is gone. What stays around the pill is tool-specific and allowed to be: a
 * symbol bar for the characters that are awkward to type, and a row of example
 * chips. Mode switching lives in DigitalLogicPage's ModeSelect bar, not on this
 * screen — the sandbox now has its own entry point entirely, and the other
 * three modes are a setting on the question, not a place of their own.
 *
 * The pill is driven controlled so the symbol bar can insert at the caret. That
 * is the whole reason PillInput grew an optional `value` prop.
 *
 * @param {Object} props
 * @param {string} props.mode - only used to pick the subtitle
 * @param {Function} props.onSubmit - called with the raw input string
 * @param {Function} props.onAIStateChange
 * @param {string} [props.defaultValue] - prefills after an error, so nothing is retyped
 */
import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ScrambleText } from '../../../../components/ui/ScrambleText'
import PillInput from '../../../../components/ui/PillInput/PillInput'
import { modeById } from '../ModeSelect/ModeSelect'
import { Chip, md } from '../md'
import styles from './ExpressionInput.module.css'

// Kept to the characters that are awkward on a keyboard. + and ( ) are absent
// because typing them is already easier than aiming at a button.
const SYMBOLS = [
  { symbol: "'", label: 'Complement' },
  { symbol: '·', label: 'AND' },
  { symbol: '⊕', label: 'XOR' },
  { symbol: 'Σm(', label: 'Minterm list' },
  { symbol: 'Σd(', label: "Don't-care list" },
  { symbol: 'ΠM(', label: 'Maxterm list' },
]

const EXAMPLES = [
  { text: "AB' + BC", note: 'A plain sum of products' },
  { text: "A'BC + AB'C + ABC' + ABC", note: 'Simplifies down a long way' },
  { text: 'F(A,B,C,D) = Σm(0,1,2,5,6,7) + Σd(8,10,11,15)', note: "With don't-cares" },
  { text: "(A+B)'(C+D)", note: 'Complemented groups' },
]

export default function ExpressionInput({
  mode,
  onSubmit,
  onAIStateChange,
  defaultValue = '',
}) {
  const inputRef = useRef(null)
  const [value, setValue] = useState(defaultValue)
  const active = modeById(mode)

  const insert = (symbol) => {
    const input = inputRef.current
    if (!input) { setValue(v => v + symbol); return }

    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const next = value.slice(0, start) + symbol + value.slice(end)
    setValue(next)

    // Restore the caret after React has written the new value, otherwise it
    // jumps to the end and the next symbol lands in the wrong place.
    requestAnimationFrame(() => {
      input.focus()
      const at = start + symbol.length
      input.setSelectionRange(at, at)
    })
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
    >
      <h1 className={styles.title}>
        <ScrambleText duration={500} speed={125}>Digital Logic</ScrambleText>
      </h1>
      <p className={styles.subtitle}>
        <ScrambleText duration={500} speed={125}>{active.hint}</ScrambleText>
      </p>

      <PillInput
        activeTool="digital-logic"
        placeholder="AB' + BC"
        value={value}
        onValueChange={setValue}
        onSubmit={onSubmit}
        onAIStateChange={onAIStateChange}
        inputRef={inputRef}
      />

      <p className={`${styles.hint} ${md.bodySmall} ${md.variantText}`}>
        Juxtaposition is AND, so AB means A&#183;B. A variable is one letter with optional digits.
      </p>

      <div className={styles.symbolBar}>
        {SYMBOLS.map(({ symbol, label }) => (
          <button
            key={symbol}
            type="button"
            className={`${styles.symbolButton} ${md.stateLayer}`}
            onClick={() => insert(symbol)}
            title={label}
            aria-label={label}
          >
            {symbol}
          </button>
        ))}
      </div>

      <div className={styles.examples}>
        <span className={`${styles.examplesLabel} ${md.labelMedium} ${md.variantText}`}>Try</span>
        <div className={styles.exampleChips}>
          {EXAMPLES.map(({ text, note }) => (
            <Chip key={text} onClick={() => onSubmit(text)} title={note}>
              {text}
            </Chip>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
