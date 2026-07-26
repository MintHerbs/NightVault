import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, X, Flag } from 'lucide-react'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/primitives/buttons/ripple'
import styles from './FlagConfirmDialog.module.css'

export default function FlagConfirmDialog({ open, onClose, onConfirm, isFlagged }) {
  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.overlay} onClick={onClose}>
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div 
            className={styles.dialog} 
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ 
              type: 'spring',
              stiffness: 400,
              damping: 30
            }}
          >
            <motion.button
              className={styles.closeBtn}
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <X size={18} />
            </motion.button>

            <motion.div 
              className={styles.iconWrapper}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 500,
                damping: 25,
                delay: 0.1
              }}
            >
              {isFlagged ? (
                <Flag size={28} />
              ) : (
                <AlertTriangle size={28} />
              )}
            </motion.div>

            <div className={styles.title}>
              {isFlagged ? 'Unflag this post?' : 'Flag this post?'}
            </div>
            
            <div className={styles.message}>
              {isFlagged ? (
                <>
                  You previously flagged this post as inappropriate. 
                  Unflagging will remove your report.
                </>
              ) : (
                <>
                  You're about to flag this post as inappropriate. 
                  If <strong>10 people</strong> flag this post, it will be automatically removed for review.
                </>
              )}
            </div>

            {!isFlagged && (
              <motion.div 
                className={styles.infoBox}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className={styles.infoTitle}>When to flag:</div>
                <ul className={styles.infoList}>
                  <li>Harassment or hate speech</li>
                  <li>Spam or misleading content</li>
                  <li>Inappropriate or offensive material</li>
                </ul>
              </motion.div>
            )}

            <div className={styles.actions}>
              <RippleButton 
                className={styles.cancelBtn} 
                onClick={onClose}
                hoverScale={1.02}
                tapScale={0.98}
              >
                Cancel
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.2)" />
              </RippleButton>
              <RippleButton 
                className={isFlagged ? styles.unflagBtn : styles.flagBtn}
                onClick={handleConfirm}
                hoverScale={1.02}
                tapScale={0.98}
              >
                {isFlagged ? 'Unflag Post' : 'Flag Post'}
                <RippleButtonRipples color="rgba(var(--color-fg-rgb), 0.3)" />
              </RippleButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
