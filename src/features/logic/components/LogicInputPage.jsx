/**
 * LogicInputPage - Shared input layout for all logic tools
 * 
 * Provides consistent input interface with HeroText, PillInput, and SymbolBar.
 * Used by all four logic tools: translate, proof tree, tableaux, resolution.
 * 
 * @param {Object} props
 * @param {string} props.title - Page title (e.g., "English to Logic")
 * @param {string} props.subtitle - Page subtitle/instruction
 * @param {string} props.placeholder - Input placeholder text
 * @param {Function} props.onSubmit - Callback when user submits input
 * @param {Function} props.onAIStateChange - Callback for AI state changes
 */
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ScrambleText } from '../../../components/ui/ScrambleText'
import Starfield from '../../../components/effects/Starfield/Starfield'
import Navbar from '../../../components/layout/Navbar/Navbar'
import BackButton from '../../../components/common/BackButton/BackButton'
import PillInput from '../../../components/ui/PillInput/PillInput'
import SymbolBar from './SymbolBar'
import styles from './LogicInputPage.module.css'

export default function LogicInputPage({
  title,
  subtitle,
  placeholder,
  onSubmit,
  onAIStateChange
}) {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  return (
    <div className={styles.page}>
      {/* Starfield background */}
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />

      {/* Navbar */}
      <Navbar />
      
      {/* Main content - centered like TreePage and ERDPage */}
      <main className={styles.main}>
        <motion.div 
          className={styles.container}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className={styles.title}>
            <ScrambleText duration={500} speed={125}>
              {title}
            </ScrambleText>
          </h1>
          <p className={styles.subtitle}>
            <ScrambleText duration={500} speed={125}>
              {subtitle}
            </ScrambleText>
          </p>
          
          <PillInput
            activeTool="logic"
            onSubmit={onSubmit}
            onAIStateChange={onAIStateChange}
            placeholder={placeholder}
            inputRef={inputRef}
          />
          
          <SymbolBar inputRef={inputRef} />
        </motion.div>
      </main>
    </div>
  )
}
