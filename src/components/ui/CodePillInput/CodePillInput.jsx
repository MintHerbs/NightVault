// Code pill input with expanding textarea for Python code
import { useState, useRef } from 'react'
import { fireAck } from '../../../hooks/useSentinelQuip'
import styles from './CodePillInput.module.css'

function CodePillInput({ onSubmit, onAIStateChange }) {
  const [code, setCode] = useState('')
  const textareaRef = useRef(null)
  const hasTriggeredObserving = useRef(false)

  const handleChange = (e) => {
    const newValue = e.target.value
    setCode(newValue)

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
    if (code.length === 0 && hasTriggeredObserving.current && typeof onAIStateChange === 'function') {
      onAIStateChange('idle')
      hasTriggeredObserving.current = false
    }
  }

  const handleSubmit = () => {
    // See PillInput: only the refused submit is acked, because a real one
    // already drives aiState.
    if (code.trim().length === 0) {
      fireAck('reject')
      return
    }
    
    if (typeof onAIStateChange === 'function') {
      onAIStateChange('thinking')
    }
    
    // Brief delay before submitting
    setTimeout(() => {
      onSubmit(code.trim())
    }, 120)
  }

  const handleKeyDown = (e) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const hasContent = code.length > 0

  return (
    <div className={`${styles.container} ${hasContent ? styles.expanded : ''}`}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="Paste your Python code..."
        value={code}
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
    </div>
  )
}

export default CodePillInput
