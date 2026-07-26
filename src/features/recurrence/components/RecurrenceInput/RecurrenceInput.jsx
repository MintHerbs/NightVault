/**
 * RecurrenceInput - Expanding pill input for recurrence formulas
 * Shows KaTeX preview and math symbol bar when expanded
 */
import { useState, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { textToLatex } from '../../../../lib/algo/recurrenceParser'
import MathSymbolBar from '../MathSymbolBar/MathSymbolBar'
import styles from './RecurrenceInput.module.css'

/** One per distinct behaviour, so clicking through them shows the whole range. */
const EXAMPLES = [
  { label: 'Merge sort', formula: 'T(n) = 2T(n/2) + n' },
  { label: 'Binary search', formula: 'T(n) = T(n/2) + 1' },
  { label: 'Quicksort worst case', formula: 'T(n) = T(n-1) + n' },
  { label: 'Karatsuba', formula: 'T(n) = 3T(n/2) + n' },
  { label: 'Fibonacci', formula: 'T(n) = T(n-1) + T(n-2)' },
  { label: 'Median of medians', formula: 'T(n) = T(n/5) + T(7n/10) + n' },
]

function RecurrenceInput({ onSubmit, onAIStateChange, initialFormula = '', initialMethod = 'tree' }) {
  const [inputValue, setInputValue] = useState(initialFormula)
  const [method, setMethod] = useState(initialMethod)
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)
  const textareaRef = useRef(null)
  const hasTriggeredObserving = useRef(false)

  const handleChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Trigger 'observing' on first keystroke
    if (newValue.length > 0 && !hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
      hasTriggeredObserving.current = true
    }

    // If input is cleared back to empty, return to 'idle'
    if (newValue.length === 0 && hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
      hasTriggeredObserving.current = false
    }
  }

  const handleFocus = () => {
    // Trigger 'observing' immediately when focused
    if (!hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
      hasTriggeredObserving.current = true
    }
  }

  const handleBlur = () => {
    // If input is empty when losing focus, return to 'idle'
    if (inputValue.length === 0 && hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
      hasTriggeredObserving.current = false
    }
  }

  const handleSubmit = () => {
    if (inputValue.trim().length === 0) return
    
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('thinking')
    }
    
    // Brief delay before submitting
    setTimeout(() => {
      onSubmit(inputValue.trim(), method)
    }, 120)
  }

  const handleKeyDown = (e) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const insertAtCursor = (symbol) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = inputValue.slice(0, start) + symbol + inputValue.slice(end)
    setInputValue(newValue)

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + symbol.length
      textarea.focus()
    }, 0)
  }

  const renderKaTeXPreview = () => {
    try {
      const latex = textToLatex(inputValue)
      const html = katex.renderToString(latex, { throwOnError: false })
      return <div dangerouslySetInnerHTML={{ __html: html }} />
    } catch (err) {
      // Show raw text on error
      return <div>{inputValue}</div>
    }
  }

  const toggleMethodDropdown = () => {
    setShowMethodDropdown(!showMethodDropdown)
  }

  const selectMethod = (selectedMethod) => {
    setMethod(selectedMethod)
    setShowMethodDropdown(false)
  }

  const hasContent = inputValue.length > 0

  const useExample = formula => {
    setInputValue(formula)
    if (!hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
      hasTriggeredObserving.current = true
    }
    textareaRef.current?.focus()
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${hasContent ? styles.expanded : ''}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="T(n) = T(n-1) + log(n)"
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        
        {/* Send button - only visible when textarea has content */}
        {hasContent && (
          <button 
            className={styles.sendButton}
            onClick={handleSubmit}
            type="button"
            aria-label="Send"
          >
            {/* Right-pointing arrow chevron */}
            <svg 
              className={styles.arrow}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* KaTeX preview and symbol bar - only when expanded */}
        {hasContent && (
          <div className={styles.expandedContent}>
            <div className={styles.katexPreview}>
              {renderKaTeXPreview()}
            </div>
            
            <MathSymbolBar onInsert={insertAtCursor} />
          </div>
        )}
      </div>

      {/* Examples: nothing to type before seeing what the tool does. */}
      {!hasContent && (
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLES.map(ex => (
            <button
              key={ex.formula}
              type="button"
              className={styles.exampleChip}
              onClick={() => useExample(ex.formula)}
              title={ex.formula}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      {/* Method selector - below the pill */}
      <div className={styles.methodSelector}>
        <span className={styles.methodLabel}>Method: </span>
        <button 
          className={styles.methodButton}
          onClick={toggleMethodDropdown}
          type="button"
        >
          {method === 'tree' ? 'Tree' : 'Substitution'}
        </button>

        {/* Dropdown menu */}
        {showMethodDropdown && (
          <div className={styles.methodDropdown}>
            <button
              className={`${styles.methodOption} ${method === 'tree' ? styles.selected : ''}`}
              onClick={() => selectMethod('tree')}
              type="button"
            >
              Tree
            </button>
            <button
              className={`${styles.methodOption} ${method === 'substitution' ? styles.selected : ''}`}
              onClick={() => selectMethod('substitution')}
              type="button"
            >
              Substitution
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecurrenceInput
