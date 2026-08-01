import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ShieldCheck, Mail } from 'lucide-react'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import Callout from '../../components/social/Callout/Callout'
import styles from './LegalPage.module.css'

const CONTACT_EMAIL = 'nightveult@gmail.com'

export default function PrivacyPage() {
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
            <ShieldCheck size={32} className={styles.headerIcon} />
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.headerSubtext}>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Callout variant="note" title="No Accounts, No Personal Profiles">
              Night Vault has no sign-up, login, or user accounts. Nothing here asks for your
              name, email, or any identifying information to use the site.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className={styles.sectionTitle}>1. What We Collect</h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Anonymous usage analytics.</strong> We record aggregate counts of which
                pages and tools get used — no names, no IP addresses tied to a person, no
                individual browsing history. This is used only to see which tools are worth
                improving.
              </li>
              <li>
                <strong>A random local session ID.</strong> A random identifier is generated and
                stored in your browser's local storage to keep the live chat and presence
                indicator working (so you can see who's online and which messages are yours).
                It is not linked to your identity and is specific to your browser.
              </li>
              <li>
                <strong>Chat messages you choose to send.</strong> Night Vault's chat is a single
                public room, not private messaging — anything you send there is visible to every
                visitor. See{' '}
                <a href="/terms" className={styles.inlineLink}>Terms & Legal</a> for content
                rules.
              </li>
              <li>
                <strong>Notes you choose to upload.</strong> Shared notes and their content are
                stored to be displayed to other visitors, as described in{' '}
                <a href="/terms" className={styles.inlineLink}>Terms & Legal</a>.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <h2 className={styles.sectionTitle}>2. Cookies & Local Storage</h2>
            <p className={styles.sectionIntro}>
              Night Vault itself does not set tracking or advertising cookies. Your browser's
              local storage is used for the session ID above and for saving your UI preferences
              (such as theme). Third-party embeds on the site — such as the YouTube player — may
              set their own cookies under their own policies; Night Vault does not control those.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <h2 className={styles.sectionTitle}>3. Third-Party Services</h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Supabase.</strong> Our database and backend host. Chat messages, notes,
                and analytics counts are stored there under Supabase's own infrastructure and
                security practices.
              </li>
              <li>
                <strong>YouTube.</strong> Embedded video content is served directly by YouTube
                and is subject to Google's privacy policy, including any cookies or data it sets
                in your browser.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <h2 className={styles.sectionTitle}>4. Data Retention & Removal</h2>
            <p className={styles.sectionIntro}>
              Since there are no accounts, there is nothing to "delete" in the traditional sense —
              chat messages and notes persist as part of the shared, public record described in
              the Terms. If you want a note, message, or other piece of content you posted
              removed, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.inlineLink}>{CONTACT_EMAIL}</a>{' '}
              with its location and we'll review the request.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <h2 className={styles.sectionTitle}>5. Children's Privacy</h2>
            <p className={styles.sectionIntro}>
              Night Vault is not directed at children and does not knowingly collect information
              from anyone under the age required to consent to data processing in their
              jurisdiction.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <h2 className={styles.sectionTitle}>6. Changes to This Policy</h2>
            <p className={styles.sectionIntro}>
              This policy may be updated as the site changes. Continued use of Night Vault after
              an update means you accept the revised policy.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <Callout variant="tip" title="Questions or Concerns?" icon={Mail}>
              For anything privacy or data related, reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.inlineLink}>{CONTACT_EMAIL}</a>.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.footer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          >
            <p className={styles.footerText}>
              By using Night Vault, you acknowledge that you have read and understood this
              Privacy Policy.
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
