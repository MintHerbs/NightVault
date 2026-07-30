// Pill-shaped text input with conditional send button
import { useState, useEffect, useRef } from 'react'
import styles from './PillInput.module.css'

function PillInput({ activeTool, onSubmit, onAIStateChange, placeholder, defaultValue = '', inputRef, disabled = false, onValueChange }) {
  const [value, setValue] = useState(defaultValue)
  const internalRef = useRef(null)
  const hasTriggeredObserving = useRef(false)
  
  // Use provided ref or internal ref
  const effectiveRef = inputRef || internalRef

  // Update value if defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setValue(defaultValue)
    }
  }, [defaultValue])

  const handleChange = (e) => {
    const newValue = e.target.value
    setValue(newValue)
    if (typeof onValueChange === 'function') onValueChange(newValue)

    // Trigger 'observing' on first keystroke (only once per session)
    if (newValue.length > 0 && !hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
      hasTriggeredObserving.current = true
    }

    // If input is cleared back to empty, collapse pill to 'idle'
    if (newValue.length === 0 && hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
      hasTriggeredObserving.current = false
    }
  }

  const handleFocus = () => {
    // Trigger 'observing' immediately when input is focused (clicked)
    if (!hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('observing')
      hasTriggeredObserving.current = true
    }
  }

  const handleBlur = () => {
    // If input is empty when losing focus, return to 'idle'
    if (value.length === 0 && hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
      hasTriggeredObserving.current = false
    }
  }

  const handleSubmit = () => {
    if (disabled || value.trim().length === 0) return

    onSubmit(value)
    setValue('')
    if (typeof onValueChange === 'function') onValueChange('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasContent = value.length > 0
  
  // Use custom placeholder or default based on active tool
  const defaultPlaceholder = activeTool === 'btree' 
    ? "Frodo, Sauron, 67, Gandalf, etc..."
    : "Consider the following scenario. Draw an Entity Relationship..."
  
  const inputPlaceholder = placeholder || defaultPlaceholder

  return (
    <div className={styles.container}>
      <input
        ref={effectiveRef}
        type="text"
        className={styles.input}
        placeholder={inputPlaceholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      
      {/* Send button - only visible when input has content */}
      {hasContent && !disabled && (
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
    </div>
  )
}

export default PillInput
