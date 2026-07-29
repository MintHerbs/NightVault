import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import AIStateContent from './AIStateContent'
import ChatNotificationContent from './ChatNotificationContent'
import useChatNotification from '../../../hooks/useChatNotification'
import styles from './DynamicIsland.module.css'

// Entrance timing. The pill drops in already expanded, holds its greeting for
// GREETING_HOLD_MS, then collapses. Reveal waits for presence to report a real
// count so the greeting can't announce the placeholder "1 online" and correct
// itself mid-hold — capped, so an unconfigured or silent presence channel
// can't keep the island hidden forever.
const REVEAL_DELAY_MS = 3000
const REVEAL_CAP_MS = 5000
const GREETING_HOLD_MS = 2000

const PROGRESS_POLL_MS = 500
const RING_RADIUS = 18
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The pill has two independent axes, deliberately kept apart:
 *
 *   phase  — entrance lifecycle: hidden → greeting → collapsed
 *   intent — what the visitor is doing: idle | hover | music
 *
 * Everything else the pill can show (live AI state, a chat notification) is
 * derived from props, never stored. An earlier version stashed a synthetic
 * 'ai-active' value into the same variable the CSS reads, which permanently
 * disabled the hover state once any AI activity had fired; the precedence
 * chain in displayStateFor() replaces that.
 */
function displayStateFor({ intent, aiState, notification, phase }) {
  // The visitor is actively interacting — nothing preempts this.
  if (intent === 'music') return 'music'
  // Task feedback the visitor is waiting on outranks anything ambient.
  if (aiState !== 'idle') return aiState
  if (notification) return 'chat'
  if (phase === 'greeting') return 'greeting'
  if (intent === 'hover') return 'hover'
  return 'idle'
}

export default function DynamicIsland({
  onlineCount,
  presenceSynced = false,
  isPlaying,
  onPlayPause,
  aiState = 'idle',
  errorMessage = '',
  currentSong,
  onSkipBack,
  onSkipForward,
  getProgress,
  lastIncoming = null,
  isChatOpen = false,
  onOpenChat
}) {
  const [phase, setPhase] = useState('hidden')
  const [intent, setIntent] = useState('idle')
  // Frozen when the greeting starts, so someone joining or leaving mid-hold
  // can't relabel the pill while it's being read.
  const [greetingCount, setGreetingCount] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(0)
  const [revealDelayElapsed, setRevealDelayElapsed] = useState(false)
  const [revealCapElapsed, setRevealCapElapsed] = useState(false)
  const pillRef = useRef(null)

  const reducedMotion = useReducedMotion()

  // Chat is the island's lowest-priority occupant: it must never preempt the
  // music panel, live AI feedback, or the entrance animation.
  const notificationsBlocked =
    intent === 'music' || aiState !== 'idle' || phase !== 'collapsed'

  const { notification, acknowledge } = useChatNotification({
    lastIncoming,
    suppressed: isChatOpen,
    blocked: notificationsBlocked,
    paused: isHovered
  })

  const displayState = displayStateFor({ intent, aiState, notification, phase })
  const isMusicOpen = intent === 'music'

  useEffect(() => {
    const delay = setTimeout(() => setRevealDelayElapsed(true), REVEAL_DELAY_MS)
    const cap = setTimeout(() => setRevealCapElapsed(true), REVEAL_CAP_MS)
    return () => {
      clearTimeout(delay)
      clearTimeout(cap)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'hidden') return
    if (!revealDelayElapsed) return
    if (!presenceSynced && !revealCapElapsed) return

    // Reduced motion skips the expand-then-collapse flourish entirely and
    // arrives collapsed: the greeting exists only as animation, and the count
    // stays available on hover.
    if (reducedMotion) {
      setPhase('collapsed')
      return
    }

    setGreetingCount(onlineCount)
    setPhase('greeting')
  }, [phase, revealDelayElapsed, revealCapElapsed, presenceSynced, reducedMotion, onlineCount])

  useEffect(() => {
    if (phase !== 'greeting') return undefined
    const timer = setTimeout(() => setPhase('collapsed'), GREETING_HOLD_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    // Close the music panel on outside click or Escape. Returning to 'idle'
    // is all that's needed — if an AI state is still live, displayStateFor()
    // picks it up again on the next render.
    const close = () => setIntent('idle')

    const handleClickOutside = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) close()
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') close()
    }

    if (!isMusicOpen) return undefined

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMusicOpen])

  // Progress ring. Polled rather than pushed: the YouTube API has no
  // time-update event, and this only runs while the panel is actually open.
  useEffect(() => {
    if (!isMusicOpen || typeof getProgress !== 'function') return undefined

    setProgress(getProgress())
    const id = setInterval(() => setProgress(getProgress()), PROGRESS_POLL_MS)
    return () => clearInterval(id)
  }, [isMusicOpen, getProgress, currentSong])

  const handleMouseEnter = () => {
    setIsHovered(true)
    // Hovering a notification holds it open (via `paused`) rather than
    // replacing it with the online count.
    if (phase === 'collapsed' && intent === 'idle' && aiState === 'idle' && !notification) {
      setIntent('hover')
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (intent === 'hover') setIntent('idle')
  }

  const handleActivate = () => {
    // Keyed off what's actually on screen, not just whether a notification
    // exists: for the render or two between an AI state firing and the
    // notification being cleared, the pill is showing the AI state, and a
    // click then means "open the music player".
    if (displayState === 'chat') {
      acknowledge()
      onOpenChat?.()
      return
    }
    if (!isMusicOpen) setIntent('music')
  }

  const handleKeyDown = (e) => {
    if (isMusicOpen) return
    if (e.key === 'Enter' || e.key === ' ') {
      // Space would otherwise scroll the page.
      e.preventDefault()
      handleActivate()
    }
  }

  const handlePlayPauseClick = (e) => {
    e.stopPropagation()
    onPlayPause()
  }

  const handleSkipBackClick = (e) => {
    e.stopPropagation()
    onSkipBack?.()
  }

  const handleSkipForwardClick = (e) => {
    e.stopPropagation()
    onSkipForward?.()
  }

  const pillLabel = displayState === 'chat'
    ? 'New chat message, open chat'
    : `${onlineCount} online, open music player`

  // Announced from a stable node below rather than from the content div: a
  // live region that is itself removed and re-added (which the content div is,
  // on every state change) isn't reliably announced. Only states the visitor
  // needs told about are surfaced — hover is a mouse-only affordance.
  let announcement = ''
  if (displayState === 'chat') {
    announcement = notification.count === 1
      ? 'New chat message'
      : `${notification.count} new chat messages`
  } else if (displayState === 'error') {
    announcement = errorMessage
  } else if (aiState !== 'idle') {
    announcement = aiState
  }

  const contentMotion = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 }
      }
    : {
        initial: { opacity: 0, scale: 0.9, filter: 'blur(5px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, scale: 0.9, filter: 'blur(5px)' },
        transition: { type: 'spring', bounce: 0.5, delay: 0.05 }
      }

  return (
    <div className={styles.wrapper} data-navbar>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </span>
      <div className={styles.innerCenter}>
        <motion.div
          ref={pillRef}
          className={styles.pill}
          data-state={displayState}
          // The entrance lifecycle, exposed separately because data-state
          // can't express it: a pill that hasn't been revealed yet still
          // reports data-state="idle", so this is the only way to tell
          // "not shown yet" from "shown and collapsed".
          data-phase={phase}
          layout
          style={{ borderRadius: 32 }}
          transition={reducedMotion
            ? { duration: 0 }
            : { type: 'spring', bounce: 0.5, duration: 0.25 }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24 }}
          animate={phase === 'hidden'
            ? (reducedMotion ? { opacity: 0 } : { opacity: 0, y: -24 })
            : { opacity: 1, y: 0 }}
          // A collapsed pill is a button; an open music panel is a container
          // of buttons, and nesting interactive roles would be invalid.
          role={isMusicOpen ? 'group' : 'button'}
          tabIndex={isMusicOpen ? -1 : 0}
          aria-label={isMusicOpen ? 'Music player' : pillLabel}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleActivate}
          onKeyDown={handleKeyDown}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={displayState}
              className={styles.content}
              data-ai-state={aiState}
              {...contentMotion}
            >
              {/* AI states: observing, waiting, processing, thinking, generating, error */}
              {aiState !== 'idle' && !isMusicOpen && (
                <AIStateContent aiState={aiState} errorMessage={errorMessage} />
              )}

              {displayState === 'chat' && (
                <ChatNotificationContent
                  count={notification.count}
                  message={notification.message}
                />
              )}

              {(displayState === 'idle' || displayState === 'greeting' || displayState === 'hover') && (
                <>
                  <div className={styles.greenDot} />
                  {displayState !== 'idle' && (
                    <span className={styles.onlineText}>
                      {displayState === 'greeting' ? greetingCount : onlineCount} online
                    </span>
                  )}
                </>
              )}

              {displayState === 'music' && currentSong && (
                <div className={styles.musicPanel}>
                  <div className={styles.albumArt}>
                    <svg className={styles.progressRing} viewBox="0 0 40 40" aria-hidden="true">
                      <circle className={styles.progressTrack} cx="20" cy="20" r={RING_RADIUS} />
                      <circle
                        className={styles.progressBar}
                        cx="20"
                        cy="20"
                        r={RING_RADIUS}
                        style={{
                          strokeDasharray: RING_CIRCUMFERENCE,
                          strokeDashoffset: RING_CIRCUMFERENCE * (1 - progress)
                        }}
                      />
                    </svg>
                    <span className={styles.albumEmoji}>{currentSong.emoji}</span>
                  </div>

                  <div className={styles.songInfo}>
                    <div className={styles.songTitle}>{currentSong.title}</div>
                    {currentSong.artist && (
                      <div className={styles.artistName}>{currentSong.artist}</div>
                    )}
                  </div>

                  <div className={styles.musicControls}>
                    <motion.button
                      className={styles.controlButton}
                      onClick={handleSkipBackClick}
                      aria-label="Skip back"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SkipBack size={16} />
                    </motion.button>

                    <motion.button
                      className={styles.controlButton}
                      onClick={handlePlayPauseClick}
                      aria-label={isPlaying ? 'Pause music' : 'Play music'}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </motion.button>

                    <motion.button
                      className={styles.controlButton}
                      onClick={handleSkipForwardClick}
                      aria-label="Skip forward"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SkipForward size={16} />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
