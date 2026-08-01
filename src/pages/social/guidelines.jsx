import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ShieldCheck, Flag, Heart, AlertTriangle, Scale, Eye } from 'lucide-react'
import Starfield from '../../components/effects/Starfield/Starfield'
import Navbar from '../../components/layout/Navbar/Navbar'
import Callout from '../../components/social/Callout/Callout'
import Alert from '../../components/social/Alert/Alert'
import styles from './guidelines.module.css'

export default function GuidelinesPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <Starfield />
      <Navbar
        showNewFormula={true}
        onNewFormula={() => navigate(-1)}
        newFormulaText="← Back"
        showAbout={false}
      />

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
            <h1 className={styles.title}>Community Guidelines</h1>
            <p className={styles.headerSubtext}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Callout variant="note" title="Our Commitment" icon={Heart}>
              This platform is designed to foster a safe, respectful, and productive learning environment. 
              By participating, you agree to follow these guidelines and help maintain a positive community for all users.
            </Callout>
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className={styles.sectionTitle}>1. Prohibited Content</h2>
            <p className={styles.sectionIntro}>The following content is strictly prohibited and will result in immediate removal and potential account restrictions:</p>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Harassment and Bullying:</strong> Do not engage in harassment, intimidation, or bullying of any kind. This includes targeted attacks, threats, or sustained negative behavior toward individuals or groups.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Hate Speech:</strong> Content that promotes hatred, discrimination, or violence against individuals or groups based on race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, or age is prohibited.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Violence and Threats:</strong> Do not post content that threatens, glorifies, or incites violence. This includes threats of physical harm, self-harm, or harm to others.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Sexual Content:</strong> Sexually explicit content, sexual solicitation, and content involving minors in any sexual context is strictly prohibited.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Illegal Activities:</strong> Do not post content that promotes, facilitates, or engages in illegal activities, including but not limited to drug use, fraud, hacking, or copyright infringement.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Personal Information:</strong> Do not share personal information (yours or others') including full names, addresses, phone numbers, email addresses, social security numbers, or other identifying information without explicit consent.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Spam and Manipulation:</strong> Do not post spam, engage in vote manipulation, create multiple accounts to circumvent restrictions, or use automated systems (bots) to interact with the platform.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Misinformation:</strong> Do not deliberately spread false information, particularly regarding health, safety, or academic integrity matters.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <h2 className={styles.sectionTitle}>2. Expected Behavior</h2>
            <p className={styles.sectionIntro}>We expect all community members to:</p>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Be Respectful:</strong> Treat others with respect and courtesy. Disagree constructively and focus on ideas, not personal attacks.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Stay On Topic:</strong> Keep posts relevant to learning, studying, and academic support. Off-topic content may be removed.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Provide Value:</strong> Contribute meaningfully to discussions. Avoid low-effort posts, excessive self-promotion, or repetitive content.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Respect Privacy:</strong> Maintain the anonymity of yourself and others. Do not attempt to identify or "dox" other users.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Report Violations:</strong> Use the flag feature to report content that violates these guidelines. Do not engage with or amplify problematic content.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Callout variant="important" title="Reporting System" icon={Flag}>
              If you see content that violates these guidelines, use the flag button (hexagon icon) to report it. 
              When <strong>10 users</strong> flag a post, it is automatically removed and sent for review. 
              False or malicious reporting may result in restrictions on your account.
            </Callout>
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <h2 className={styles.sectionTitle}>3. Intellectual Property</h2>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Respect Copyright:</strong> Do not post copyrighted material without permission. This includes textbook content, exam questions, or proprietary course materials.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Academic Integrity:</strong> Do not share or request answers to graded assignments, exams, or assessments. Discussing concepts and study strategies is encouraged; sharing solutions is not.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Attribution:</strong> When sharing code, resources, or ideas from others, provide appropriate credit and attribution.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <h2 className={styles.sectionTitle}>4. Enforcement</h2>
            <p className={styles.sectionIntro}>Violations of these guidelines may result in:</p>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Content Removal:</strong> Posts that violate guidelines will be removed.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Temporary Restrictions:</strong> Repeated violations may result in temporary posting restrictions.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Permanent Ban:</strong> Severe or repeated violations may result in permanent removal from the platform.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Legal Action:</strong> Illegal content or activities may be reported to appropriate authorities.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <Alert 
              type="warning" 
              title="Enforcement Discretion"
              message="We reserve the right to remove content or restrict accounts at our discretion, even if not explicitly covered by these guidelines, to maintain a safe and productive community."
            />
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <h2 className={styles.sectionTitle}>5. Privacy and Data</h2>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Anonymous by Design:</strong> This platform is designed to be anonymous. We do not collect or display personally identifiable information.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Session-Based Identity:</strong> Your identity is tied to a session ID stored locally. Clearing your browser data will reset your identity.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Content Ownership:</strong> By posting content, you grant us a non-exclusive license to display and distribute your content on the platform.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Data Retention:</strong> We retain content and moderation records as necessary for platform operation and safety.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          >
            <h2 className={styles.sectionTitle}>6. Disclaimer</h2>
            <ul className={styles.rulesList}>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>User-Generated Content:</strong> Content posted by users does not reflect the views of the platform operators. Users are solely responsible for their content.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>No Guarantees:</strong> We do not guarantee the accuracy, completeness, or usefulness of any user-generated content.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Educational Purpose:</strong> This platform is for educational and informational purposes only. It is not a substitute for professional academic advising or mental health support.
              </motion.li>
              <motion.li whileHover={{ x: 4 }} transition={{ duration: 0.2 }}>
                <strong>Platform Changes:</strong> We reserve the right to modify these guidelines, platform features, or discontinue the service at any time.
              </motion.li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
          >
            <Callout variant="tip" title="Questions or Concerns?" icon={Eye}>
              If you have questions about these guidelines or need to report a serious issue, 
              please contact the platform administrators. We're committed to maintaining a safe and supportive learning environment.
            </Callout>
          </motion.div>

          <motion.div 
            className={styles.footer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.2 }}
          >
            <p className={styles.footerText}>
              By using this platform, you acknowledge that you have read, understood, and agree to abide by these Community Guidelines.
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
