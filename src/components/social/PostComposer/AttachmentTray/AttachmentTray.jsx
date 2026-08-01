// One chrome for all three attachment kinds. Poll, code and GIF each used to
// bring their own container, header and remove affordance, so the composer
// changed shape depending on which chip you pressed. The tray owns the
// surface, the label and the single remove control; the panel inside owns
// only its own editing UI.
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import styles from './AttachmentTray.module.css'

export default function AttachmentTray({ icon: Icon, label, onRemove, children }) {
  return (
    <motion.div
      className={styles.tray}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className={styles.label}>
            {Icon && <Icon size={14} strokeWidth={2.25} aria-hidden="true" />}
            {label}
          </span>

          <button
            type="button"
            className={styles.remove}
            onClick={onRemove}
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.panel}>{children}</div>
      </div>
    </motion.div>
  )
}
