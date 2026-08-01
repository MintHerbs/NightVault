// Identity row + the post's overflow menu. Flag used to sit in the action
// bar at the same visual weight as voting, which over-promoted a rare,
// one-way action; it now lives in this menu alongside edit and delete.
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Flag, MoreVertical, PencilLine, Trash2 } from 'lucide-react'
import AgentAvatar from '../../../effects/smoothui/agent-avatar'
import { formatAbsoluteTime, formatRelativeTime } from '../../../../lib/social/relativeTime'
import styles from './PostHeader.module.css'

export default function PostHeader({
  postId,
  createdAt,
  isEdited,
  isOwnPost,
  isFlagged,
  menuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
  onFlag,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handler = (e) => {
      if (menuRef.current?.contains(e.target)) return
      onMenuToggle(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onMenuToggle(false)
    }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, onMenuToggle])

  return (
    <header className={styles.header}>
      {/* Seeded on the post's own id, not session_id: that column has no grant
          for anon/authenticated any more (T-078), since it is the only thing
          between a reader and impersonating the author into edit/delete/vote
          RPCs. Trade-off, not an oversight — one author's avatar is no longer
          consistent across their own posts. */}
      <div className={styles.avatar}>
        <AgentAvatar seed={postId || 'anon'} size={36} animated={true} />
      </div>

      <div className={styles.meta}>
        <span className={styles.name}>Anon</span>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <time className={styles.time} dateTime={createdAt} title={formatAbsoluteTime(createdAt)}>
          {formatRelativeTime(createdAt)}
        </time>
        {isEdited && <span className={styles.edited}>edited</span>}
      </div>

      <div className={styles.menuWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => onMenuToggle(!menuOpen)}
          aria-label="Post options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className={styles.menu}
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            >
              {isOwnPost && (
                <>
                  <button type="button" role="menuitem" className={styles.menuItem} onClick={onEdit}>
                    <PencilLine size={15} aria-hidden="true" />
                    Edit post
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    onClick={onDelete}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete post
                  </button>
                  <div className={styles.menuDivider} role="separator" />
                </>
              )}

              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${isFlagged ? styles.menuItemActive : ''}`}
                onClick={onFlag}
              >
                <Flag size={15} aria-hidden="true" />
                {isFlagged ? 'Remove flag' : 'Flag post'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
