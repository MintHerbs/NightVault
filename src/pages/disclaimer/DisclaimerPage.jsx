// Disclaimer page — accuracy, academic-use, and availability warnings.
// Legal terms (ownership, liability, indemnification) live on /terms; this
// page is the plain-language "read this before you rely on anything" notice.
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, Sparkles, GraduationCap, Radio, ExternalLink, Mail } from 'lucide-react'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import Callout from '../../components/social/Callout/Callout'
import Alert from '../../components/social/Alert/Alert'
import styles from './DisclaimerPage.module.css'

const CONTACT_EMAIL = 'nightveult@gmail.com'
const GITHUB_URL = 'https://github.com/MintHerbs/b-tree'

export default function DisclaimerPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <Starfield />
      <BackButton onClick={() => navigate(-1)} />
      <Navbar showAbout={true} />

      <main className={styles.main}>
        <motion.div
          className={styles.container}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <AlertTriangle size={32} className={styles.headerIcon} />
            <h1 className={styles.title}>Disclaimer</h1>
            <p className={styles.headerSubtext}>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Callout variant="note" title="Open Source, Built for Students">
              Night Vault is a free, non-commercial passion project built and maintained by
              students in their own time. It is not a business and is not operated, endorsed,
              or affiliated with any university or institution. The codebase is open source —
              pull requests are welcome on{' '}
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>
                GitHub
              </a>.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className={styles.sectionTitle}>
              <Sparkles size={18} className={styles.sectionIcon} />
              1. AI & Algorithmic Output Can Be Wrong
            </h2>
            <p className={styles.sectionIntro}>
              Several tools on this site use algorithms and AI/LLM-based processing to help you
              study. That output <strong>can and will make mistakes</strong>, including confident
              ones. Always cross-reference results against your own course material, textbook,
              or lecturer before relying on them.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <h2 className={styles.sectionTitle}>
              <GraduationCap size={18} className={styles.sectionIcon} />
              2. Study Aid, Not a Substitute for Your Own Work
            </h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Intended as a study aid only.</strong> Any academic work you submit must
                be your own. If your institution restricts the use of AI-assisted tools in
                assessments, it is your responsibility to follow those rules.
              </li>
              <li>
                <strong>No responsibility for misuse.</strong> The creators of Night Vault take
                no responsibility for academic misconduct arising from how a tool on this site
                is used.
              </li>
              <li>
                <strong>Notes are user-submitted and unvetted.</strong> Shared notes are not
                reviewed, verified, or endorsed by the creators or maintainers before or after
                publication. See{' '}
                <a href="/terms" className={styles.inlineLink}>Terms & Legal</a> for full detail
                on content ownership and liability.
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Alert
              type="warning"
              title="Use it to learn, not to skip learning"
              message="Treat every generated answer, diagram, or summary as a starting point to check, not a final source to cite."
            />
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <h2 className={styles.sectionTitle}>
              <Radio size={18} className={styles.sectionIcon} />
              3. Availability & Third-Party Embeds
            </h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Provided "as is", with no uptime guarantee.</strong> This is a free,
                volunteer-run project — features, tools, or the site itself can change or go
                down without notice.
              </li>
              <li>
                <strong>Third-party embeds are outside our control.</strong> Content such as the
                embedded YouTube player is served by, and governed by the policies of, that
                third party. Night Vault does not control the cookies, scripts, or behaviour
                those embeds introduce in your browser.
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <Callout variant="tip" title="Questions or Concerns?" icon={Mail}>
              For anything related to accuracy, content, or how a tool works, reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.inlineLink}>{CONTACT_EMAIL}</a>.
              For the full legal terms, see{' '}
              <a href="/terms" className={styles.inlineLink}>Terms & Legal</a> and{' '}
              <a href="/privacy" className={styles.inlineLink}>Privacy Policy</a>.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.footer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubButton}
            >
              <ExternalLink size={16} />
              View on GitHub
            </a>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
