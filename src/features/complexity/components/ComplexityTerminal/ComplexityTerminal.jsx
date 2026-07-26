import { useState, useEffect, useRef } from 'react';
import { displayComplexity } from '../../../../lib/algo/complexityTypes.js';
import styles from './ComplexityTerminal.module.css';

// Step type → colour mapping
const STEP_COLORS = {
  loop: '#4ade80',
  combine_nested: '#34d399',
  worst_case: '#fbbf24',
  special: '#67e8f9',
  info: '#9ca3af',
  divider: '#374151',
};

// Step type → prefix mapping
const STEP_PREFIXES = {
  special: '  ⚡ ',
  worst_case: '  ⚠ ',
  combine_nested: '',
  default: '▸ ',
};

/**
 * @param {string} [finalComplexityLabel] exact label to show in the final box.
 *   Recurrences can end up at complexities the fixed key list cannot name
 *   (O(n^1.58), O(log² n), O(φⁿ)), so callers may pass the rendered string
 *   directly. Falls back to the key lookup when omitted.
 */
export default function ComplexityTerminal({ steps, finalComplexity, finalComplexityLabel, onAnimationComplete }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const terminalRef = useRef(null);
  
  // Filter out 'final' type steps - they go in the finalBox only
  const renderableSteps = steps.filter(s => s.type !== 'final');
  
  // Reset and animate when steps change
  useEffect(() => {
    setVisibleCount(0);
    
    if (renderableSteps.length === 0) return;
    
    const interval = setInterval(() => {
      setVisibleCount(prev => {
        if (prev >= renderableSteps.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 80);
    
    return () => clearInterval(interval);
  }, [steps]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Call onAnimationComplete when all steps are visible
  useEffect(() => {
    if (visibleCount >= renderableSteps.length && renderableSteps.length > 0) {
      // Wait for final box animation (400ms) + small buffer
      const timer = setTimeout(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [visibleCount, renderableSteps.length, onAnimationComplete]);
  
  // Auto-scroll to bottom on visibleCount change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleCount]);
  
  const allStepsVisible = visibleCount >= renderableSteps.length;
  const showFinalBox = allStepsVisible && finalComplexity;
  
  return (
    <div className={styles.container}>
      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.dots}>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
        </div>
        <span className={styles.filename}>complexity.log</span>
      </div>
      
      {/* Terminal body */}
      <div className={styles.terminal} ref={terminalRef}>
        <div className={styles.prompt}>$ analyse --mode=big-o --drop-constants</div>
        <div className={styles.status}>Running asymptotic analysis...</div>
        <div className={styles.spacer}></div>
        
        {/* Render visible steps */}
        {renderableSteps.slice(0, visibleCount).map((step, idx) => {
          const color = STEP_COLORS[step.type] || '#9ca3af';
          const prefix = step.type === 'combine_nested' 
            ? '' 
            : (STEP_PREFIXES[step.type] || STEP_PREFIXES.default);
          
          const indent = step.indent !== undefined 
            ? '  '.repeat(step.indent) 
            : '';
          
          const lineNumber = String(idx + 1).padStart(2, '0');
          
          return (
            <div 
              key={idx} 
              className={styles.stepLine}
              style={{ color }}
            >
              {step.type !== 'divider' && <span className={styles.lineNum}>{lineNumber}</span>}
              <span className={styles.stepText}>
                {indent}{prefix}{step.text}
              </span>
            </div>
          );
        })}
        
        {/* Blinking cursor while animating */}
        {!allStepsVisible && (
          <span className={styles.cursor}>█</span>
        )}
        
        {/* Final box */}
        {showFinalBox && (
          <div className={styles.finalBox}>
            <div className={styles.finalLabel}>FINAL COMPLEXITY</div>
            <div className={styles.finalValue}>{finalComplexityLabel ?? displayComplexity(finalComplexity)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
