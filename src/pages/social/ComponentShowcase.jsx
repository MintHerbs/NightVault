import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../components/social/Alert/Alert'
import Callout from '../../components/social/Callout/Callout'
import Badge, { DotBadge } from '../../components/social/Badge/Badge'
import { ToastContainer } from '../../components/social/Toast/Toast'
import { useToast } from '../../hooks/useToast'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import Starfield from '../../components/effects/Starfield/Starfield'
import styles from './ComponentShowcase.module.css'

export default function ComponentShowcase() {
  const navigate = useNavigate()
  const { toasts, success, error, info, warning, removeToast } = useToast()
  const [showAlert, setShowAlert] = useState(true)

  return (
    <div className={styles.page}>
      <Starfield />
      
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button 
            className={styles.backBtn}
            onClick={() => navigate('/social/feed')}
          >
            <ArrowLeft size={20} />
            Back to Feed
          </button>
          <h1 className={styles.title}>Component Showcase</h1>
          <p className={styles.subtitle}>
            Explore all the new UI components available in the social feed
          </p>
        </motion.div>

        {/* Alerts Section */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className={styles.sectionTitle}>Alerts</h2>
          <p className={styles.sectionDesc}>
            Use alerts for important messages that need user attention
          </p>
          
          <div className={styles.grid}>
            {showAlert && (
              <Alert 
                type="error" 
                title="Error Alert"
                message="This is an error message with a close button"
                onClose={() => setShowAlert(false)}
              />
            )}
            <Alert 
              type="success" 
              title="Success Alert"
              message="Your action was completed successfully!"
            />
            <Alert 
              type="info" 
              title="Info Alert"
              message="Here's some helpful information for you"
            />
            <Alert 
              type="warning" 
              title="Warning Alert"
              message="Please be careful with this action"
            />
          </div>
        </motion.section>

        {/* Callouts Section */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2 className={styles.sectionTitle}>Callouts</h2>
          <p className={styles.sectionDesc}>
            Use callouts to highlight tips, important info, or special content
          </p>
          
          <div className={styles.grid}>
            <Callout variant="tip" title="Pro Tip">
              This is a helpful tip for users to improve their experience
            </Callout>
            <Callout variant="highlight" title="New Feature">
              Check out this amazing new feature we just launched!
            </Callout>
            <Callout variant="important" title="Important Notice">
              This requires your immediate attention and action
            </Callout>
            <Callout variant="note" title="Friendly Note">
              A gentle reminder from the team about something useful
            </Callout>
          </div>
        </motion.section>

        {/* Toasts Section */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>Toast Notifications</h2>
          <p className={styles.sectionDesc}>
            Temporary notifications that appear and auto-dismiss
          </p>
          
          <div className={styles.buttonGrid}>
            <RippleButton
              className={`${styles.toastBtn} ${styles.success}`}
              onClick={() => success('Action completed successfully!')}
            >
              Show Success Toast
              <RippleButtonRipples color="rgba(255, 255, 255, 0.3)" />
            </RippleButton>
            
            <RippleButton
              className={`${styles.toastBtn} ${styles.error}`}
              onClick={() => error('Something went wrong!')}
            >
              Show Error Toast
              <RippleButtonRipples color="rgba(255, 255, 255, 0.3)" />
            </RippleButton>
            
            <RippleButton
              className={`${styles.toastBtn} ${styles.info}`}
              onClick={() => info('Here is some information')}
            >
              Show Info Toast
              <RippleButtonRipples color="rgba(255, 255, 255, 0.3)" />
            </RippleButton>
            
            <RippleButton
              className={`${styles.toastBtn} ${styles.warning}`}
              onClick={() => warning('Please be careful!')}
            >
              Show Warning Toast
              <RippleButtonRipples color="rgba(255, 255, 255, 0.3)" />
            </RippleButton>
          </div>
        </motion.section>

        {/* Badges Section */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <h2 className={styles.sectionTitle}>Badges</h2>
          <p className={styles.sectionDesc}>
            Small labels for counts, status, or categories
          </p>
          
          <div className={styles.badgeShowcase}>
            <div className={styles.badgeGroup}>
              <h3 className={styles.badgeGroupTitle}>Variants</h3>
              <div className={styles.badgeRow}>
                <Badge variant="default">Default</Badge>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="orange">Orange</Badge>
              </div>
            </div>

            <div className={styles.badgeGroup}>
              <h3 className={styles.badgeGroupTitle}>Sizes</h3>
              <div className={styles.badgeRow}>
                <Badge variant="primary" size="sm">Small</Badge>
                <Badge variant="primary" size="md">Medium</Badge>
                <Badge variant="primary" size="lg">Large</Badge>
              </div>
            </div>

            <div className={styles.badgeGroup}>
              <h3 className={styles.badgeGroupTitle}>With Pulse</h3>
              <div className={styles.badgeRow}>
                <Badge variant="success" pulse>New</Badge>
                <Badge variant="error" pulse>3</Badge>
                <Badge variant="warning" pulse>!</Badge>
              </div>
            </div>

            <div className={styles.badgeGroup}>
              <h3 className={styles.badgeGroupTitle}>Dot Badges</h3>
              <div className={styles.badgeRow}>
                <DotBadge variant="success" pulse />
                <DotBadge variant="error" pulse />
                <DotBadge variant="warning" pulse />
                <DotBadge variant="info" pulse />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Usage Tips */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Callout variant="tip" title="Usage Guidelines">
            <ul className={styles.tipList}>
              <li><strong>Alerts:</strong> Use for important, persistent messages</li>
              <li><strong>Callouts:</strong> Use for tips, highlights, and educational content</li>
              <li><strong>Toasts:</strong> Use for temporary, non-critical notifications</li>
              <li><strong>Badges:</strong> Use for counts, status indicators, and labels</li>
            </ul>
          </Callout>
        </motion.section>
      </div>

      <ToastContainer 
        toasts={toasts} 
        onRemove={removeToast}
        position="top-right"
      />
    </div>
  )
}
