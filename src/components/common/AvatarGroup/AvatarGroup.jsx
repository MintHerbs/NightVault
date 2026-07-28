// Stacked circular author avatars — shared by the admin browser's Owner
// column, the public notes browser, and NoteReader (T-071), so authorship
// renders identically everywhere instead of three hand-rolled copies.
//
// HoverCard, not Popover: a Popover only closes on outside-click/Escape, so
// wiring one to open on mouseenter (an earlier version of this component did)
// left it stuck open the moment the pointer moved away without a click —
// hovering across a list of rows piled up several open cards at once, one
// per row you'd passed over. HoverCard's Trigger/Content track real pointer
// enter/leave and close on their own, which is exactly the "hover to
// preview" behaviour this needs.
import { useState } from 'react'
import { HoverCard } from 'radix-ui'
import { AnimatePresence, motion } from 'motion/react'
import styles from './AvatarGroup.module.css'

const MAX_VISIBLE = 3

function initial(name) {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?'
}

function Chip({ author, size }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  return author.avatarUrl ? (
    <img src={author.avatarUrl} alt="" className={styles.chip} style={style} />
  ) : (
    <span className={styles.chip} style={style}>{initial(author.displayName)}</span>
  )
}

/**
 * `authors`: [{ id, displayName, avatarUrl }], richest-contributor first.
 * Renders nothing when empty — a note with no author on record shouldn't
 * exist post-backfill, but this stays defensive rather than erroring.
 */
export default function AvatarGroup({ authors, size = 26 }) {
  const [open, setOpen] = useState(false)
  if (!authors || authors.length === 0) return null

  const visible = authors.slice(0, MAX_VISIBLE)
  const overflow = authors.length - visible.length

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={150} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          onClick={(e) => e.stopPropagation()}
          title={authors.map((a) => a.displayName).join(', ')}
        >
          <span className={styles.stack}>
            {visible.map((a) => <Chip key={a.id} author={a} size={size} />)}
            {overflow > 0 && (
              <span className={styles.chip} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
                +{overflow}
              </span>
            )}
          </span>
        </button>
      </HoverCard.Trigger>
      <AnimatePresence>
        {open && (
          <HoverCard.Portal forceMount>
            <HoverCard.Content
              asChild
              forceMount
              side="bottom"
              align="start"
              sideOffset={8}
              collisionPadding={12}
            >
              <motion.div
                className={styles.popover}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                {authors.map((a) => (
                  <div key={a.id} className={styles.popoverRow}>
                    <Chip author={a} size={24} />
                    <span className={styles.popoverName}>{a.displayName}</span>
                  </div>
                ))}
              </motion.div>
            </HoverCard.Content>
          </HoverCard.Portal>
        )}
      </AnimatePresence>
    </HoverCard.Root>
  )
}
