/**
 * BootContent - what the island shows while it is introducing itself (T-099).
 *
 * A two-slot log: the line before last rises and dims, the current one enters
 * from below. That is the whole reason the panel is tall rather than a strip -
 * one line replacing another in place would read as a status field updating,
 * not as Sentinel working through a list.
 *
 * The text uses ScrambleText, which is the effect this app already puts on H1
 * headers (see HeroText.jsx and docs/rules.md §14.1). It resolves characters
 * out of noise rather than typing left to right; there is deliberately no
 * second text-animation component in the app.
 */
import { AnimatePresence, motion } from 'motion/react'
import GridLoader from '../../effects/smoothui/grid-loader/index.tsx'
import ScrambleText from '../../ui/ScrambleText/ScrambleText'
import AvatarForge from './AvatarForge'
import {
  BOOT_EASE,
  BOOT_LINE_FADE_MS,
  BOOT_SCRAMBLE_MS,
  BOOT_SCRAMBLE_TICK_MS,
} from '../../../lib/sentinel/boot'
import styles from './DynamicIsland.module.css'

export default function BootContent({
  stage,
  line,
  previousLine,
  grid,
  seed,
  forging,
  forgeMs,
  showAvatar,
  reducedMotion,
}) {
  return (
    <div className={styles.bootPanel} data-stage={stage}>
      <div className={styles.bootGlyph}>
        {/* The forge replaces the glyph for two stages: while it is building,
            and while it is being handed over. `layoutId` is what carries it
            down to the sidebar's avatar slot. */}
        {showAvatar ? (
          <motion.div
            layoutId="sentinel-avatar"
            className={styles.bootAvatar}
            // No bounce on the handoff: the avatar is being handed over, and a
            // spring overshooting into the sidebar corner reads as it being
            // thrown there.
            transition={reducedMotion ? { duration: 0 } : { duration: 1.5, ease: BOOT_EASE }}
          >
            <AvatarForge
              seed={seed}
              size={64}
              durationMs={forging ? forgeMs : 0}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        ) : (
          grid && (
            <GridLoader
              blur={1.2}
              color={grid.color}
              gap={1}
              // The island's live region announces each line; the glyph is
              // decoration beside it, same contract as QuipContent.
              label=""
              mode={grid.mode}
              pattern={grid.pattern}
              rounded
              size="md"
              speed={grid.speed}
            />
          )
        )}
      </div>

      <div className={styles.bootLog}>
        <AnimatePresence initial={false} mode="popLayout">
          {previousLine && (
            <motion.div
              key={`prev-${previousLine}`}
              className={styles.bootLinePrevious}
              initial={{ opacity: 0.9, y: 0 }}
              animate={{ opacity: 0.45, y: 0, scale: 0.92 }}
              exit={{ opacity: 0, y: -10 }}
              transition={reducedMotion
                ? { duration: 0 }
                : { duration: BOOT_LINE_FADE_MS / 1000, ease: BOOT_EASE }}
            >
              {previousLine}
            </motion.div>
          )}
          {line && (
            <motion.div
              key={`cur-${line}`}
              className={styles.bootLine}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reducedMotion
                ? { duration: 0 }
                : { duration: BOOT_LINE_FADE_MS / 1000, ease: BOOT_EASE }}
            >
              {/* Slower than the scramble anywhere else in the app. On an H1 it
                  is a flourish over text you can already read; here it is the
                  only way the line arrives, so churning through it in 400ms
                  meant the sentence was gone before it registered. */}
              <ScrambleText duration={BOOT_SCRAMBLE_MS} speed={BOOT_SCRAMBLE_TICK_MS}>
                {line}
              </ScrambleText>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
