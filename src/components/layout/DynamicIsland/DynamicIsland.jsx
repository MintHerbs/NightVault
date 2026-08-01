import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Music, Pause, Play, SkipBack, SkipForward, Timer } from 'lucide-react'
import AIStateContent from './AIStateContent'
import ChatNotificationContent from './ChatNotificationContent'
import BreakReminderContent from './BreakReminderContent'
import TimerPanel from './TimerPanel'
import TimerSetPanel from './TimerSetPanel'
import useChatNotification from '../../../hooks/useChatNotification'
import useIslandNotifications from '../../../hooks/useIslandNotifications'
import useStudyTimer from '../../../hooks/useStudyTimer'
import useBreakReminder, { BREAK_INTERVAL_MS } from '../../../hooks/useBreakReminder'
import styles from './DynamicIsland.module.css'

// Entrance timing. The pill drops in already expanded, holds its greeting for
// GREETING_HOLD_MS, then collapses. Reveal waits for presence to report a real
// count so the greeting can't announce the placeholder "1 online" and correct
// itself mid-hold — capped, so an unconfigured or silent presence channel
// can't keep the island hidden forever.
const REVEAL_DELAY_MS = 3000
const REVEAL_CAP_MS = 5000
const GREETING_HOLD_MS = 2000

// How long after opening chat from the island the "Back" shortcut stays on
// offer. Past this the island reverts to its normal behaviour and closing
// chat is manual again (owner decision, T-080).
const RETURN_WINDOW_MS = 60000

const BREAK_DISMISS_MS = 8000
const TIMER_DONE_DISMISS_MS = 10000
const BREAK_MESSAGE = "It's been an hour, reminder to take a break"

const PROGRESS_POLL_MS = 500
const RING_RADIUS = 18
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * The pill has two independent axes, deliberately kept apart:
 *
 *   phase  — entrance lifecycle: hidden → greeting → collapsed
 *   intent — what the visitor is doing: idle | hover | music | timer
 *
 * Everything else the pill can show (live AI state, a chat notification, a
 * break reminder, a running timer) is derived, never stored. An earlier
 * version stashed a synthetic 'ai-active' value into the same variable the
 * CSS reads, which permanently disabled the hover state once any AI activity
 * had fired; this precedence chain replaces that.
 */
function displayStateFor({
  intent,
  aiState,
  notification,
  phase,
  breakDue,
  timerFinished,
  timerRunning,
  returnAvailable,
  isHovered
}) {
  // An open panel means the visitor is actively interacting — nothing preempts it.
  if (intent === 'music') return 'music'
  if (intent === 'timer') return 'timer'
  if (intent === 'timer-set') return 'timer-set'
  // Task feedback the visitor is waiting on outranks anything ambient.
  if (aiState !== 'idle') return aiState
  // Hourly and deliberate, so it outranks chat.
  if (breakDue) return 'break'
  if (timerFinished) return 'timer-done'
  if (notification) return 'chat'
  // Hover-only offer: the collapsed pill stays a plain dot until pointed at.
  if (returnAvailable && isHovered) return 'return'
  if (phase === 'greeting') return 'greeting'
  if (intent === 'hover') return 'hover'
  // Ambient countdown, so a running timer is visible without opening anything.
  if (timerRunning) return 'timer-running'
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
  isViewingFeed = false,
  interruptible = true,
  chatOpenedFromIsland = false,
  onOpenChat,
  onOpenFeed,
  onCloseChat,
  breakIntervalMs = BREAK_INTERVAL_MS
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
  const [returnWindowOpen, setReturnWindowOpen] = useState(false)
  const pillRef = useRef(null)

  const reducedMotion = useReducedMotion()
  const timer = useStudyTimer()
  const breakReminder = useBreakReminder(breakIntervalMs)

  const isPanelOpen = intent === 'music' || intent === 'timer' || intent === 'timer-set'
  const returnAvailable = isChatOpen && chatOpenedFromIsland && returnWindowOpen

  const notificationsEnabled = useIslandNotifications()

  // Chat is the island's lowest-priority occupant: it must never preempt an
  // open panel, live AI feedback, the entrance, a break reminder or a
  // finished timer.
  //
  // The last three are the focus guards (T-087 follow-up). All three drop the
  // event rather than queueing it, matching this file's existing stance that a
  // late notification is pure noise — the sidebar badge is the lossless record
  // and none of this can lose a message:
  //   * the visitor switched the pill off in Appearance,
  //   * they're inside a tool or a note rather than browsing,
  //   * a study timer is running, which is the plainest statement of intent to
  //     concentrate the app has.
  const notificationsBlocked =
    isPanelOpen ||
    aiState !== 'idle' ||
    phase !== 'collapsed' ||
    breakReminder.isDue ||
    timer.hasFinished ||
    !notificationsEnabled ||
    !interruptible ||
    timer.isRunning

  // Memoised: the hook holds this in a ref and one of its effects keys on it,
  // so a fresh object per render would re-run that effect every render.
  const suppressedKinds = useMemo(
    () => ({ chat: isChatOpen, post: isViewingFeed }),
    [isChatOpen, isViewingFeed]
  )

  const { notification, acknowledge } = useChatNotification({
    lastIncoming,
    suppressedKinds,
    blocked: notificationsBlocked,
    paused: isHovered
  })

  // Single source for "where does clicking this pill go", so the aria-label
  // can't promise chat while the handler opens the feed. A mixed burst follows
  // its newest arrival, which is what the pill is showing.
  const notificationOpensFeed =
    notification?.kind === 'post' ||
    (notification?.kind === 'mixed' && notification.message?.kind === 'post')

  const displayState = displayStateFor({
    intent,
    aiState,
    notification,
    phase,
    breakDue: breakReminder.isDue,
    timerFinished: timer.hasFinished,
    timerRunning: timer.isRunning,
    returnAvailable,
    isHovered
  })

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
    const timeout = setTimeout(() => setPhase('collapsed'), GREETING_HOLD_MS)
    return () => clearTimeout(timeout)
  }, [phase])

  // The return shortcut's lifetime. Closing chat by any route, or opening it
  // from anywhere other than the island, ends the offer immediately.
  useEffect(() => {
    if (!isChatOpen || !chatOpenedFromIsland) {
      setReturnWindowOpen(false)
      return undefined
    }

    setReturnWindowOpen(true)
    const timeout = setTimeout(() => setReturnWindowOpen(false), RETURN_WINDOW_MS)
    return () => clearTimeout(timeout)
  }, [isChatOpen, chatOpenedFromIsland])

  useEffect(() => {
    // Dismissing to 'idle' is all that's needed — if an AI state is still
    // live, displayStateFor() picks it up again on the next render.
    const dismiss = () => setIntent('idle')

    // Clicking away means "I'm done with the island", so it closes outright.
    const handleClickOutside = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) dismiss()
    }

    // Escape steps back one level instead: from the set-time view it returns
    // to the transport, matching that view's own Cancel button. Escaping
    // straight past it to a closed island contradicted Cancel.
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      setIntent((current) => (current === 'timer-set' ? 'timer' : 'idle'))
    }

    if (!isPanelOpen) return undefined

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isPanelOpen])

  // Progress ring. Polled rather than pushed: the YouTube API has no
  // time-update event, and this only runs while the panel is actually open.
  useEffect(() => {
    if (intent !== 'music' || typeof getProgress !== 'function') return undefined

    setProgress(getProgress())
    const id = setInterval(() => setProgress(getProgress()), PROGRESS_POLL_MS)
    return () => clearInterval(id)
  }, [intent, getProgress, currentSong])

  // Both of these auto-clear once actually on screen, and hovering holds them
  // open — same contract as a chat notification.
  useEffect(() => {
    if (displayState !== 'break' || isHovered) return undefined
    const timeout = setTimeout(breakReminder.dismiss, BREAK_DISMISS_MS)
    return () => clearTimeout(timeout)
  }, [displayState, isHovered, breakReminder.dismiss])

  useEffect(() => {
    if (displayState !== 'timer-done' || isHovered) return undefined
    const timeout = setTimeout(timer.acknowledgeFinish, TIMER_DONE_DISMISS_MS)
    return () => clearTimeout(timeout)
  }, [displayState, isHovered, timer.acknowledgeFinish])

  const handleMouseEnter = () => {
    setIsHovered(true)
    // Hovering a notification, reminder or finished timer holds it open rather
    // than replacing it with the online count.
    if (
      phase === 'collapsed' &&
      intent === 'idle' &&
      aiState === 'idle' &&
      !notification &&
      !breakReminder.isDue &&
      !timer.hasFinished
    ) {
      setIntent('hover')
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (intent === 'hover') setIntent('idle')
  }

  // Keyed off what's actually on screen rather than off the underlying flags,
  // so a state that is present but outranked never captures the click.
  const handleActivate = () => {
    if (displayState === 'return') {
      onCloseChat?.()
      return
    }
    if (displayState === 'chat') {
      acknowledge()
      // A post alert sends you to the feed it's about; a chat alert opens the
      // panel.
      if (notificationOpensFeed) onOpenFeed?.()
      else onOpenChat?.()
      return
    }
    if (displayState === 'break') {
      breakReminder.dismiss()
      return
    }
    if (displayState === 'timer-done') {
      timer.acknowledgeFinish()
      return
    }
    if (!isPanelOpen) setIntent('music')
  }

  const handleKeyDown = (e) => {
    if (isPanelOpen) return
    if (e.key === 'Enter' || e.key === ' ') {
      // Space would otherwise scroll the page.
      e.preventDefault()
      handleActivate()
    }
  }

  const openPanel = (which) => (e) => {
    e.stopPropagation()
    setIntent(which)
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

  let pillLabel = `${onlineCount} online, open music player`
  if (displayState === 'return') pillLabel = 'Back to the page'
  else if (displayState === 'chat') {
    const what = notification.kind === 'mixed'
      ? 'New updates'
      : (notification.kind === 'post' ? 'New post' : 'New chat message')
    pillLabel = `${what}, ${notificationOpensFeed ? 'open the feed' : 'open chat'}`
  }
  else if (displayState === 'break') pillLabel = BREAK_MESSAGE
  else if (displayState === 'timer-done') pillLabel = 'Timer finished'

  // Announced from a stable node below rather than from the content div: a
  // live region that is itself removed and re-added (which the content div is,
  // on every state change) isn't reliably announced. Only states the visitor
  // needs told about are surfaced — hover is a mouse-only affordance.
  let announcement = ''
  if (displayState === 'chat') {
    const { count, kind } = notification
    if (kind === 'post') {
      announcement = count === 1 ? 'New post' : `${count} new posts`
    } else if (kind === 'mixed') {
      announcement = `${count} new updates`
    } else {
      announcement = count === 1 ? 'New chat message' : `${count} new chat messages`
    }
  } else if (displayState === 'break') {
    announcement = BREAK_MESSAGE
  } else if (displayState === 'timer-done') {
    announcement = 'Timer finished'
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
          // A collapsed pill is a button; an open panel is a container of
          // buttons, and nesting interactive roles would be invalid.
          role={isPanelOpen ? 'group' : 'button'}
          tabIndex={isPanelOpen ? -1 : 0}
          aria-label={isPanelOpen ? 'Island panel' : pillLabel}
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
              {aiState !== 'idle' && !isPanelOpen && (
                <AIStateContent aiState={aiState} errorMessage={errorMessage} />
              )}

              {displayState === 'break' && <BreakReminderContent message={BREAK_MESSAGE} />}

              {displayState === 'timer-done' && (
                <div className={styles.timerDonePanel}>
                  <Timer size={16} className={styles.timerDoneIcon} />
                  <span className={styles.timerDoneText}>Time&apos;s up</span>
                </div>
              )}

              {displayState === 'chat' && (
                <ChatNotificationContent
                  count={notification.count}
                  message={notification.message}
                  kind={notification.kind}
                />
              )}

              {displayState === 'return' && (
                <div className={styles.returnPanel}>
                  <ArrowLeft size={14} />
                  <span className={styles.returnText}>Back</span>
                </div>
              )}

              {displayState === 'idle' && <div className={styles.greenDot} />}

              {displayState === 'timer-running' && (
                <>
                  <div className={styles.greenDot} />
                  <span className={styles.onlineText}>{timer.remainingLabel}</span>
                </>
              )}

              {displayState === 'greeting' && (
                <>
                  <div className={styles.greenDot} />
                  <span className={styles.onlineText}>{greetingCount} online</span>
                </>
              )}

              {/* Segmented hover: the count, then a way into each panel. The
                  pill body still opens music, so nothing already learned
                  changes (owner decision, T-080). */}
              {displayState === 'hover' && (
                <>
                  <div className={styles.greenDot} />
                  <span className={styles.onlineText}>{onlineCount} online</span>
                  <span className={styles.segmentDivider} />
                  <button
                    type="button"
                    className={styles.segmentButton}
                    onClick={openPanel('music')}
                    aria-label="Open music player"
                  >
                    <Music size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.segmentButton}
                    onClick={openPanel('timer')}
                    aria-label="Open study timer"
                  >
                    <Timer size={14} />
                  </button>
                </>
              )}

              {displayState === 'timer' && (
                <TimerPanel
                  presets={timer.presets}
                  activePreset={timer.activePreset}
                  durationLabel={timer.durationLabel}
                  remainingLabel={timer.remainingLabel}
                  isRunning={timer.isRunning}
                  isArmed={timer.isArmed}
                  onSelectMinutes={timer.selectMinutes}
                  onOpenCustom={() => setIntent('timer-set')}
                  onToggle={timer.toggle}
                  onReset={timer.reset}
                />
              )}

              {displayState === 'timer-set' && (
                <TimerSetPanel
                  durationMs={timer.durationMs}
                  onStart={(ms) => {
                    timer.start(ms)
                    // Straight back to the transport, so the countdown the
                    // visitor just set is what they see.
                    setIntent('timer')
                  }}
                  onCancel={() => setIntent('timer')}
                />
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
