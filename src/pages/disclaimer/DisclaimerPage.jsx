// Disclaimer page with open source info and usage warnings
import { useNavigate } from 'react-router-dom'
import Starfield from '../../components/effects/Starfield/Starfield'
import BackButton from '../../components/common/BackButton/BackButton'
import styles from './DisclaimerPage.module.css'

function DisclaimerPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.disclaimerPage}>
      {/* Starfield background */}
      <Starfield />
      <BackButton onClick={() => navigate('/home')} />

      {/* Main content */}
      <main className={styles.content}>
        <div className={styles.textContainer}>
          <h1 className={styles.title}>Open Source & Built for Students</h1>
          
          <p className={styles.description}>
            This tool is open source - built by students, for students. If you want to contribute, 
            fix something that's broken, or just poke around the codebase, you're welcome to. 
            Pull requests are open.
          </p>
          
          <div className={styles.divider} />
          
          <div className={styles.warningSection}>
            <div className={styles.warningHeader}>
              <span className={styles.warningIcon}>⚠️</span>
              <h2 className={styles.warningTitle}>Disclaimer</h2>
            </div>
            
            <p className={styles.warningText}>
              This tool uses algorithms and AI/LLM-based processing to assist with learning. 
              It <strong>can and will make mistakes</strong>. Always cross-reference with your 
              course material, textbook, or lecturer before relying on any output.
            </p>
            
            <p className={styles.warningText}>
              This tool is intended as a study aid only. Any academic work submitted must be your own - 
              if your institution prohibits the use of AI-assisted tools in assessments, it is your 
              responsibility to comply with those guidelines. The developers of this tool take no 
              responsibility for academic misconduct arising from its misuse.
            </p>
            
            <p className={styles.warningFooter}>
              Use it to learn. Not to skip learning.
            </p>
          </div>
          
          <a 
            href="https://github.com/MintHerbs/b-tree"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubButton}
          >
            View on GitHub
          </a>
        </div>
      </main>
    </div>
  )
}

export default DisclaimerPage
