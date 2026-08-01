import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Scale, Mail } from 'lucide-react'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import BackButton from '../../components/common/BackButton/BackButton'
import Callout from '../../components/social/Callout/Callout'
import Alert from '../../components/social/Alert/Alert'
import styles from './LegalPage.module.css'

const CONTACT_EMAIL = 'nightveult@gmail.com'

export default function TermsPage() {
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
            <Scale size={32} className={styles.headerIcon} />
            <h1 className={styles.title}>Terms & Legal</h1>
            <p className={styles.headerSubtext}>
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Callout variant="note" title="What Night Vault Is">
              Night Vault is a passion project built and maintained by a group of students in
              their own time. It is free, non-commercial, and fully open source. It is not a
              business, is not run for profit, and is not operated, endorsed, or affiliated
              with any university or institution.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className={styles.sectionTitle}>1. Ownership of Notes & Content</h2>
            <p className={styles.sectionIntro}>By uploading or sharing any note, summary, or material on Night Vault:</p>
            <ul className={styles.rulesList}>
              <li>
                <strong>You own what you write.</strong> Every note, summary, or piece of
                content shared on this platform is the original creative work of the student
                who authored it, and remains theirs.
              </li>
              <li>
                <strong>You are responsible for it.</strong> The author of a note takes full
                and sole responsibility for its content, including making sure it is their own
                original work and that sharing it does not infringe anyone else's copyright.
              </li>
              <li>
                <strong>Night Vault does not vet content.</strong> Notes are not reviewed,
                verified, edited, or endorsed by the creators or maintainers of this website
                before or after publication.
              </li>
              <li>
                <strong>The creators are not responsible for authors' content.</strong> Night
                Vault, its creators, maintainers, and contributors accept no responsibility or
                liability whatsoever for material written and shared by other students. Any
                dispute over a note's content, accuracy, or copyright status is between the
                author and the affected party.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <h2 className={styles.sectionTitle}>2. Acceptable Use</h2>
            <p className={styles.sectionIntro}>
              Night Vault includes a public chat and social feed. Full conduct rules live on the{' '}
              <a href="/social/guidelines" className={styles.inlineLink}>Community Guidelines</a>{' '}
              page; by using those features you agree to follow them. In short: no harassment,
              hate speech, illegal activity, or sharing others' personal information. Content
              that breaches the guidelines may be removed without notice, and access to
              individual features may be restricted for repeated abuse.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <h2 className={styles.sectionTitle}>3. Contributor Guidelines: No Names</h2>
            <p className={styles.sectionIntro}>
              Reproducing or distributing a lecturer's own teaching material without permission
              can amount to copyright infringement. To keep contributors and the platform clear
              of that risk, anything uploaded to Night Vault must be the contributor's own
              original notes, and:
            </p>
            <ul className={styles.rulesList}>
              <li>
                <strong>No lecturer names.</strong> Do not name, identify, or otherwise refer to
                any lecturer, professor, or member of teaching staff in any note or piece of
                content.
              </li>
              <li>
                <strong>No university name.</strong> Do not name, identify, or otherwise refer
                to the University of Mauritius, or any specific institution, in any note or
                piece of content.
              </li>
              <li>
                <strong>Original notes only.</strong> Do not upload a lecturer's or
                institution's own copyrighted teaching material verbatim — slides, past exam
                papers, textbook scans, or similar. Share your own notes and summaries, not
                someone else's material.
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
              title="Enforcement"
              message="Content that breaches these guidelines will be removed on discovery or on report, without notice, at the site's discretion."
            />
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <h2 className={styles.sectionTitle}>4. Copyright & Takedown Requests</h2>
            <p className={styles.sectionIntro}>
              If you believe content on Night Vault infringes your copyright, names you without
              consent, or otherwise breaches these terms, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.inlineLink}>{CONTACT_EMAIL}</a>{' '}
              with a description of the content, its location, and the reason for the request.
              As a volunteer-run project, we aim to review and act on reports promptly but
              cannot guarantee a fixed response time.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <h2 className={styles.sectionTitle}>5. No Warranty, No Liability</h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Provided "as is".</strong> Night Vault, its tools, and all content on it
                are provided as is, without warranty of any kind, express or implied, including
                accuracy, completeness, or fitness for a particular purpose.
              </li>
              <li>
                <strong>Use at your own risk.</strong> Always cross-reference notes and
                AI-assisted output against your own course material before relying on them
                academically.
              </li>
              <li>
                <strong>No liability for damages.</strong> To the maximum extent permitted by
                law, Night Vault and its creators, maintainers, and contributors are not liable
                for any direct, indirect, incidental, or consequential damages arising from use
                of the site, reliance on its content, or academic outcomes tied to that use.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <h2 className={styles.sectionTitle}>6. Indemnification</h2>
            <p className={styles.sectionIntro}>
              By submitting content to Night Vault, you agree to indemnify and hold harmless
              Night Vault and its creators, maintainers, and contributors from any claim,
              damage, or liability, including reasonable legal costs, arising from content you
              submitted or your use of the site.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <h2 className={styles.sectionTitle}>7. No Affiliation, Open Source, No Profit</h2>
            <ul className={styles.rulesList}>
              <li>
                <strong>Independent project.</strong> Night Vault is an independent, unofficial
                project run by students in their personal capacity. It is not operated,
                sponsored, or endorsed by any university, and nothing on it should be taken to
                represent an official position of any institution.
              </li>
              <li>
                <strong>Open source.</strong> The codebase is open source and freely available
                for anyone to use, inspect, or contribute to.
              </li>
              <li>
                <strong>Not for profit.</strong> Night Vault does not charge for access, run
                ads, sell data, or otherwise generate revenue from the site.
              </li>
            </ul>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          >
            <h2 className={styles.sectionTitle}>8. Third-Party Services & Your Data</h2>
            <p className={styles.sectionIntro}>
              Night Vault runs on Supabase (database and backend infrastructure) and embeds
              third-party content such as YouTube. These services operate under their own
              terms and privacy policies, which Night Vault does not control. For what Night
              Vault itself stores and why, see the{' '}
              <a href="/privacy" className={styles.inlineLink}>Privacy Policy</a>.
            </p>
          </motion.div>

          <motion.div
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
          >
            <h2 className={styles.sectionTitle}>9. Governing Law & Changes</h2>
            <p className={styles.sectionIntro}>
              These terms are governed by the laws of the Republic of Mauritius. If any part of
              these terms is found unenforceable, the rest remains in effect. These terms may be
              updated at any time; continued use of Night Vault after a change means you accept
              the updated terms.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
          >
            <Callout variant="tip" title="Questions or Concerns?" icon={Mail}>
              For anything legal, copyright, or takedown related, reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.inlineLink}>{CONTACT_EMAIL}</a>.
            </Callout>
          </motion.div>

          <motion.div
            className={styles.footer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.2 }}
          >
            <p className={styles.footerText}>
              By using Night Vault, you acknowledge that you have read, understood, and agree
              to these Terms & Legal notices.
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
