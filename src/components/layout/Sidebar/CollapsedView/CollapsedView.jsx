import { memo, useCallback, useState } from 'react'
import { motion } from 'motion/react'
import { BookOpen, ChatCircle, Globe } from '@phosphor-icons/react'
import ChatAvatar from '../../../../features/chat/components/ChatAvatar/ChatAvatar'
import { useAvatarIntegrated } from '../../../../hooks/useSentinelBoot'
import NotificationBadge from '../../../effects/smoothui/components/notification-badge'
import AppearanceDialog from '../../AppearanceDialog/AppearanceDialog'
import { colors } from '../../../../constants/colors'
import styles from '../Sidebar.module.css'
import moonLogo from '../../../../img/moon.svg'

function SidebarIcon({ icon, tooltip, isActive, activeColor = colors.iconActive, onClick }) {
  return (
    <div className={styles.iconWrapper} onClick={onClick} title={tooltip}>
      {isActive && <span className={styles.activeBar} style={{ background: activeColor }} />}
      <div
        className={`${styles.iconInner} ${isActive ? styles.iconActive : ''}`}
        style={{ '--hover-color': activeColor }}
      >
        <span style={{ color: isActive ? activeColor : colors.iconOff, display: 'flex' }}>
          {icon}
        </span>
      </div>
      <span className={styles.tooltip}>{tooltip}</span>
    </div>
  )
}

function CollapsedView({
  go,
  isChatOpen,
  setIsChatOpen,
  unreadCount = 0,
  unreadPosts = 0,
  mode,
  setMode,
  sessionId,
}) {
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
  const isSocial = mode === 'social'
  // False only while Sentinel is still forging the avatar on its first-ever
  // visit (T-099). Every other load this is true before the first paint, so
  // there is no boot-shaped code path in the ordinary case.
  const avatarIntegrated = useAvatarIntegrated()

  const handleMoonClick = useCallback((e) => {
    e.preventDefault()
    go('/home', 'Home')
  }, [go])

  // One button for both directions, showing the mode it switches *to* rather
  // than the one you're in. That's why it carries no active bar: it's an
  // action, not a destination, so highlighting it as "current" would be a lie.
  const toggleMode = useCallback(() => {
    if (isSocial) {
      go('/home', 'Home')
      return
    }
    // Social has no landing page of its own; the feed is the entry point, so
    // there is no separate Home icon below to reach it with.
    setMode('social')
    go('/social/feed', 'social-feed')
  }, [isSocial, go, setMode])

  return (
    <div className="flex flex-col items-center justify-between h-full">

      <a href="/home" onClick={handleMoonClick} className={styles.moonLink}>
        <img src={moonLogo} alt="Home" className={styles.moonLogo} />
      </a>

      <div className={styles.nav}>
        {/* While in Academia this is the only social icon on the bar, so it
            carries everything waiting over there: new posts and unread chat as
            one number. In Social it becomes the Academia button, which has
            nothing to report, and the chat icon below takes over the messages
            half. */}
        <NotificationBadge
          count={!isSocial ? unreadCount + unreadPosts : 0}
          max={10}
          variant="count"
          position="top-right"
          showZero={false}
        >
          <SidebarIcon
            icon={
              isSocial
                ? <BookOpen size={20} weight="regular" />
                : <Globe size={20} weight="regular" />
            }
            tooltip={isSocial ? 'Academia' : 'Social'}
            onClick={toggleMode}
          />
        </NotificationBadge>

        {isSocial && (
          <NotificationBadge
            count={!isChatOpen && unreadCount > 0 ? unreadCount : 0}
            max={10}
            variant="count"
            position="top-right"
            showZero={false}
          >
            <SidebarIcon
              icon={<ChatCircle size={20} weight="regular" />}
              tooltip="Community Chat"
              isActive={isChatOpen}
              onClick={() => setIsChatOpen?.((p) => !p)}
            />
          </NotificationBadge>
        )}
      </div>

      <div className={styles.bottom}>
        <div className={styles.divider} />

        <div
          className={styles.avatarContainer}
          title="Appearance"
          role="button"
          tabIndex={0}
          aria-label="Appearance settings"
          onClick={() => setIsAppearanceOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsAppearanceOpen(true)
            }
          }}
        >
          {/* Grey until Sentinel hands the avatar over: the real seeded avatar
              under a filter, never a different seed. Swapping seeds would
              change the *pattern*, which reads as one avatar replacing another
              rather than as this one gaining colour.

              The `layoutId` is claimed only once integrated, and that timing is
              the whole trick. It is the same id the boot's forge carries, and
              exactly one element may hold it at a time: the forge unmounts on
              the same render this claims it, so motion animates the avatar from
              the middle of the screen down into this slot. Holding it from
              first paint instead meant two live claimants, and the forge flew
              *up out of this corner* when it mounted. */}
          <motion.div
            // The `key` is what makes the flight happen, not just the
            // `layoutId`. Motion starts a shared-layout transition when an
            // element bearing the id *mounts*; merely granting the id to an
            // element that was already on screen registers it silently and
            // animates nothing. Flipping the key forces a fresh mount on the
            // same render the forge unmounts, which is the pairing motion
            // matches on.
            key={avatarIntegrated ? 'avatar-integrated' : 'avatar-pending'}
            layoutId={avatarIntegrated ? 'sentinel-avatar' : undefined}
            style={{
              lineHeight: 0,
              borderRadius: '50%',
              filter: avatarIntegrated ? 'none' : 'grayscale(1) brightness(0.75)',
              // Slow, and eased at both ends: the colour coming up is the
              // payoff of the whole sequence, and at 600ms it was over before
              // the eye had followed the avatar down here.
              transition: 'filter 1400ms cubic-bezier(0.65, 0, 0.35, 1)',
            }}
            transition={{ duration: 1.5, ease: [0.65, 0, 0.35, 1] }}
          >
            <ChatAvatar sessionId={sessionId} size={26} />
          </motion.div>
        </div>

        <AppearanceDialog
          open={isAppearanceOpen}
          onClose={() => setIsAppearanceOpen(false)}
          sessionId={sessionId}
        />
      </div>
    </div>
  )
}

export default memo(CollapsedView)
