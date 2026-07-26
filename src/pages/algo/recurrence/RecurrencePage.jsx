import { useState } from 'react';
import Navbar from '../../../components/layout/Navbar/Navbar';
import Starfield from '../../../components/effects/Starfield/Starfield';
import { ScrambleText } from '../../../components/ui/ScrambleText';
import RecurrenceInput from '../../../features/recurrence/components/RecurrenceInput/RecurrenceInput';
import RecurrenceTreeView from '../../../features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView';
import RecurrenceSubstitutionView from '../../../features/recurrence/components/RecurrenceSubstitutionView/RecurrenceSubstitutionView';
import ComplexityTerminal from '../../../features/complexity/components/ComplexityTerminal/ComplexityTerminal';
import { parseRecurrence } from '../../../lib/algo/recurrenceParser';
import { solveByTree, solveBySubstitution } from '../../../lib/algo/recurrenceSolver';
import styles from './RecurrencePage.module.css';

export default function RecurrencePage({ onAIStateChange }) {
  const [view, setView] = useState('input');
  const [formula, setFormula] = useState('');
  const [method, setMethod] = useState('tree');
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSubmit = (submittedFormula, submittedMethod) => {
    // Parse the recurrence formula
    const parsed = parseRecurrence(submittedFormula);
    
    // Check for parse errors
    if (parsed.error) {
      setFormula(submittedFormula);
      setMethod(submittedMethod);
      setResult({ error: parsed.error });
      setView('result');
      setIsAnimating(false);
      
      if (onAIStateChange) {
        onAIStateChange('idle');
      }
      return;
    }
    
    // Solve based on method
    const analysis = submittedMethod === 'tree' ? solveByTree(parsed) : solveBySubstitution(parsed);

    // A recurrence can parse cleanly and still be outside what the solver
    // covers, so surface that instead of drawing a meaningless tree.
    if (analysis.error) {
      setFormula(submittedFormula);
      setMethod(submittedMethod);
      setResult({ error: analysis.error });
      setView('result');
      setIsAnimating(false);
      if (onAIStateChange) onAIStateChange('idle');
      return;
    }

    setFormula(submittedFormula);
    setMethod(submittedMethod);
    setResult(analysis);
    setView('result');
    setIsAnimating(true);
    
    // Set to 'thinking' state immediately
    if (onAIStateChange) {
      onAIStateChange('thinking');
    }
  };

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    
    // Return to 'idle' after animation completes
    if (onAIStateChange) {
      onAIStateChange('idle');
    }
  };

  const handleReset = () => {
    setView('input');
    setFormula('');
    setMethod('tree');
    setResult(null);
    setIsAnimating(false);
    
    if (onAIStateChange) {
      onAIStateChange('idle');
    }
  };

  if (view === 'input') {
    return (
      <div className={styles.container}>
        <Starfield />
        <Navbar />
        <main className={styles.landingCenter}>
          <div className={styles.heroContainer}>
            <h1 className={styles.title}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation={true}>
                Recurrence Relation
              </ScrambleText>
            </h1>
            <p className={styles.subtitle}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation={true}>
                Enter your recurrence formula
              </ScrambleText>
            </p>
          </div>
          <RecurrenceInput 
            onSubmit={handleSubmit} 
            onAIStateChange={onAIStateChange} 
          />
        </main>
      </div>
    );
  }

  // Result view
  return (
    <div className={styles.resultPage}>
      <Starfield />
      <Navbar 
        showTitle 
        title="Recurrence Relation" 
        showNewFormula 
        onNewFormula={handleReset}
        newFormulaText="New Formula"
      />
      
      {result?.error ? (
        <div className={styles.errorContainer}>
          <div className={styles.errorBox}>
            {/* Covers both "could not read that" and "read it fine, but this
                family needs a method the solver does not implement". */}
            <h3 className={styles.errorTitle}>Cannot solve this one</h3>
            <p className={styles.errorMessage}>{result.error}</p>
            <button className={styles.retryButton} onClick={handleReset}>
              ← Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.splitPanel}>
          <div className={styles.leftPanel}>
            {method === 'tree' ? (
              <RecurrenceTreeView 
                tree={result?.tree} 
                formula={formula} 
              />
            ) : (
              <RecurrenceSubstitutionView 
                formulas={result?.formulas || []} 
              />
            )}
          </div>
          <div className={styles.rightPanel}>
            <ComplexityTerminal
              steps={result?.steps || []}
              finalComplexity={result?.finalComplexity}
              finalComplexityLabel={result?.finalLabel}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
