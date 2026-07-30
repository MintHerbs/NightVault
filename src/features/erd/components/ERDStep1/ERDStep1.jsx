// ERD Step 1 - User describes their ER scenario
import { useState } from 'react'
import { motion } from 'motion/react'
import { ScrambleText } from '../../../../components/ui/ScrambleText'
import PillInput from '../../../../components/ui/PillInput/PillInput'
import PaginationDots from '../../../../components/ui/PaginationDots/PaginationDots'
import styles from './ERDStep1.module.css'

function ERDStep1({
  initialQuestion,
  onSubmit,
  onUseManualFlow,
  isGenerating,
  onAIStateChange,
  currentStep,
  totalSteps,
}) {
  // Tracked separately from PillInput's own state so the manual-flow escape
  // hatch can use whatever is currently typed, before any submit
  const [draft, setDraft] = useState(initialQuestion || '')

  const handleSubmit = (value) => {
    setDraft(value)
    onSubmit(value)
  }

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className={styles.title}>
        <ScrambleText duration={500} speed={125}>
          ER Diagram Builder
        </ScrambleText>
      </h1>
      <p className={styles.subtitle}>
        <ScrambleText duration={500} speed={125}>
          describe your scenario below
        </ScrambleText>
      </p>
      <PillInput
        activeTool="erd"
        onSubmit={handleSubmit}
        onAIStateChange={onAIStateChange}
        placeholder="e.g. A university has students who enroll in courses taught by professors..."
        defaultValue={initialQuestion}
        disabled={isGenerating}
        onValueChange={setDraft}
      />

      {/* Escape hatch for anyone who would rather drive their own LLM, and the
          way through if generation is slow rather than outright failing. */}
      {onUseManualFlow && !isGenerating && (
        <button
          type="button"
          className={styles.manualLink}
          onClick={() => onUseManualFlow(draft)}
          disabled={!draft.trim()}
        >
          Use my own LLM instead
        </button>
      )}

      <PaginationDots total={totalSteps} current={currentStep} />
    </motion.div>
  )
}

export default ERDStep1
