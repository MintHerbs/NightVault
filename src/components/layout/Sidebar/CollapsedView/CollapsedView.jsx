import { memo, useCallback, useState } from 'react'
import { BookOpen, ChatCircle, Globe, House } from '@phosphor-icons/react'
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
  path,
  go,
  isChatOpen,
  setIsChatOpen,
  unreadCount = 0,
  mode,
  setMode,
  sessionId,
}) {
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)

  const handleMoonClick = useCallback((e) => {
    e.preventDefault()
    go('/home', 'Home')
  }, [go])

  return (
    <div className="flex flex-col items-center justify-between h-full">

      <a href="/home" onClick={handleMoonClick} className={styles.moonLink}>
        <img src={moonLogo} alt="Home" className={styles.moonLogo} />
      </a>

      <div className={styles.nav}>
        {mode === 'social' ? (
          <>
            <SidebarIcon
              icon={<House size={20} weight="regular" />}
              tooltip="Home Feed"
              isActive={path.startsWith('/social/feed') && !isChatOpen}
              activeColor={colors.iconActive}
              onClick={() => go('/social/feed', 'social-feed')}
            />

            <NotificationBadge
              count={!isChatOpen && unreadCount > 0 ? unreadCount : 0}
              max={10}
              variant="count"
              position="top-right"
              showZero={false}
            >
              <div
                className={styles.iconWrapper}
                onClick={() => setIsChatOpen?.((p) => !p)}
                title="Community Chat"
              >
                {isChatOpen && <span className={styles.activeBar} style={{ background: colors.iconActive }} />}
                <div className={styles.iconInner} style={{ '--hover-color': colors.iconActive }}>
                  <ChatCircle
                    size={20}
                    weight="regular"
                    style={{ color: isChatOpen ? colors.iconActive : colors.iconOff }}
                  />
                </div>
                <span className={styles.tooltip}>Community Chat</span>
              </div>
            </NotificationBadge>
          </>
        ) : null}
      </div>

      <div className={styles.bottom}>
        <div className={styles.divider} />
        <div className={styles.modeSwitch}>
          <NotificationBadge
            count={mode !== 'social' && unreadCount > 0 ? unreadCount : 0}
            max={10}
            variant="count"
            position="top-right"
            showZero={false}
          >
            <div
              className={styles.iconWrapper}
              onClick={() => {
                setMode('social')
                go('/social/feed', 'social-feed')
              }}
              title="Social"
            >
              {mode === 'social' && <span className={styles.activeBar} style={{ background: colors.iconActive }} />}
              <div className={styles.iconInner} style={{ '--hover-color': colors.iconActive }}>
                <Globe
                  size={20}
                  weight="regular"
                  style={{ color: mode === 'social' ? colors.iconActive : colors.iconOff }}
                />
              </div>
              <span className={styles.tooltip}>Social</span>
            </div>
          </NotificationBadge>

          <div className={styles.iconWrapper} onClick={() => go('/home', 'Home')} title="Academia">
            {mode === 'academia' && <span className={styles.activeBar} style={{ background: colors.iconActive }} />}
            <div className={styles.iconInner} style={{ '--hover-color': colors.iconActive }}>
              <BookOpen
                size={20}
                weight="regular"
                style={{ color: mode === 'academia' ? colors.iconActive : colors.iconOff }}
              />
            </div>
            <span className={styles.tooltip}>Academia</span>
          </div>
        </div>

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
