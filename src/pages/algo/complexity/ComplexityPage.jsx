import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar/Navbar';
import Starfield from '../../../components/effects/Starfield/Starfield';
import BackButton from '../../../components/common/BackButton/BackButton';
import { ScrambleText } from '../../../components/ui/ScrambleText';
import CodePillInput from '../../../components/ui/CodePillInput/CodePillInput';
import ComplexityCodeView from '../../../features/complexity/components/ComplexityCodeView/ComplexityCodeView';
import ComplexityTerminal from '../../../features/complexity/components/ComplexityTerminal/ComplexityTerminal';
import { analyzeComplexity } from '../../../lib/algo/complexityEngine';
import { displayComplexity } from '../../../lib/algo/complexityTypes';
import styles from './ComplexityPage.module.css';

export default function ComplexityPage({ onAIStateChange }) {
  const navigate = useNavigate();
  const [view, setView] = useState('input');
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleSubmit = (submittedCode) => {
    // Call analyzeComplexity synchronously - it's fast
    const analysis = analyzeComplexity(submittedCode);
    
    setCode(submittedCode);
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
    setCode('');
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
        <BackButton onClick={() => navigate('/home')} />
        <Navbar />
        <main className={styles.landingCenter}>
          <div className={styles.heroContainer}>
            <h1 className={styles.title}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation={true}>
                Code Complexity
              </ScrambleText>
            </h1>
            <p className={styles.subtitle}>
              <ScrambleText duration={500} speed={125} skipInitialAnimation={true}>
                Paste your Python code
              </ScrambleText>
            </p>
          </div>
          <CodePillInput 
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
      <BackButton onClick={() => navigate('/home')} />
      <Navbar
        showTitle 
        title="O Complexity" 
        showNewFormula 
        onNewFormula={handleReset}
        newFormulaText="New Code"
      />
      
      {result?.error ? (
        <div className={styles.errorContainer}>
          <div className={styles.errorBox}>
            <h3 className={styles.errorTitle}>Analysis Error</h3>
            <p className={styles.errorMessage}>{result.error}</p>
            <button className={styles.retryButton} onClick={handleReset}>
              ← Try Again
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.splitPanel}>
          <div className={styles.leftPanel}>
            <ComplexityCodeView 
              code={code} 
              annotations={result?.annotations || []} 
            />
          </div>
          <div className={styles.rightPanel}>
            <ComplexityTerminal 
              steps={result?.steps || []} 
              finalComplexity={result?.finalComplexity}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
