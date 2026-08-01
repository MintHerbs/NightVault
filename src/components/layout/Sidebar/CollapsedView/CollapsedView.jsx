import { memo, useCallback, useState } from 'react'
import { BookOpen, ChatCircle, Globe } from '@phosphor-icons/react'
import ChatAvatar from '../../../../features/chat/components/ChatAvatar/ChatAvatar'
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
          <ChatAvatar sessionId={sessionId} size={26} />
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
