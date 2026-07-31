import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar/Navbar';
import Starfield from '../../../components/effects/Starfield/Starfield';
import BackButton from '../../../components/common/BackButton/BackButton';
import { ScrambleText } from '../../../components/ui/ScrambleText';
import RecurrenceInput from '../../../features/recurrence/components/RecurrenceInput/RecurrenceInput';
import RecurrenceTreeView from '../../../features/recurrence/components/RecurrenceTreeView/RecurrenceTreeView';
import RecurrenceSubstitutionView from '../../../features/recurrence/components/RecurrenceSubstitutionView/RecurrenceSubstitutionView';
import ComplexityTerminal from '../../../features/complexity/components/ComplexityTerminal/ComplexityTerminal';
import { parseRecurrence } from '../../../lib/algo/recurrenceParser';
import { solveByTree, solveBySubstitution } from '../../../lib/algo/recurrenceSolver';
import { trackToolEvent } from '../../../lib/analytics/tracker';
import styles from './RecurrencePage.module.css';

export default function RecurrencePage({ onAIStateChange }) {
  const navigate = useNavigate();
  const [view, setView] = useState('input');
  const [formula, setFormula] = useState('');
  const [method, setMethod] = useState('tree');
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSubmit = (submittedFormula, submittedMethod) => {
    // Counted here rather than on the success path below, so it counts attempts.
    // Both a parse failure and an unsupported recurrence are someone using the
    // tool, and attempts far exceeding results is itself the signal that the
    // solver's coverage is the thing to work on.
    trackToolEvent('recurrence', 'solve');

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

  /**
   * Back to the input view.
   * @param {boolean} keepFormula true when the user is correcting a rejected
   *   formula, where wiping the field would mean retyping the whole thing.
   */
  const handleReset = (keepFormula = false) => {
    setView('input');
    setResult(null);
    setIsAnimating(false);
    if (!keepFormula) {
      setFormula('');
      setMethod('tree');
    }

    if (onAIStateChange) {
      onAIStateChange('idle');
    }
  };

  if (view === 'input') {
    return (
      <div className={styles.container}>
        <Starfield />
        <BackButton onClick={() => navigate('/home')} />
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
            initialFormula={formula}
            initialMethod={method}
          />
        </main>
      </div>
    );
  }

  // Result view
  return (
    <div className={styles.resultPage}>
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />
      <Navbar
        showTitle 
        title="Recurrence Relation" 
        showNewFormula 
        onNewFormula={() => handleReset(false)}
        newFormulaText="New Formula"
      />
      
      {result?.error ? (
        <div className={styles.errorContainer}>
          <div className={styles.errorBox}>
            {/* Covers both "could not read that" and "read it fine, but this
                family needs a method the solver does not implement". */}
            <h3 className={styles.errorTitle}>Cannot solve this one</h3>
            <p className={styles.errorMessage}>{result.error}</p>
            <button className={styles.retryButton} onClick={() => handleReset(true)}>
              ← Edit this formula
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
