import { memo, useCallback } from 'react'
import { BookOpen, ChatCircle, Globe, House } from '@phosphor-icons/react'
import ChatAvatar from '../../../../features/chat/components/ChatAvatar/ChatAvatar'
import NotificationBadge from '../../../effects/smoothui/components/notification-badge'
import { colors } from '../../../../constants/colors'
import styles from '../Sidebar.module.css'
import moonLogo from '../../../../img/moon.svg'
import { STANDALONE_TOOLS, PACKAGE_JSON, findActiveModule, primaryTool } from '../modules'

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
  onOpenPackageJson,
  setIsExpanded,
}) {
  const handleMoonClick = useCallback((e) => {
    e.preventDefault()
    go('/tree', 'btree')
  }, [go])

  const activeModule = findActiveModule(path)

  const handleModuleClick = (m) => {
    const tool = primaryTool(m)
    if (tool) return go(tool.route, tool.id)
    alert(`${m.label} — coming soon`)
  }

  return (
    <div className="flex flex-col items-center justify-between h-full">

      <a href="/tree" onClick={handleMoonClick} className={styles.moonLink}>
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
        ) : (
          <>
            {/* {MODULES.map((m) => (
              <SidebarIcon
                key={m.id}
                icon={<m.Icon size={20} weight="regular" />}
                tooltip={m.label}
                isActive={activeModule?.id === m.id}
                activeColor={colors.iconActive}
                onClick={() => handleModuleClick(m)}
              />
            ))}

            <div className={styles.divider} />

            <SidebarIcon
              icon={<PACKAGE_JSON.Icon size={20} weight="regular" />}
              tooltip={PACKAGE_JSON.label}
              isActive={false}
              activeColor={colors.iconActiveAlt}
              onClick={() => onOpenPackageJson?.()}
            />

            {STANDALONE_TOOLS.map((t) => (
              <SidebarIcon
                key={t.id}
                icon={<t.Icon size={20} weight="regular" />}
                tooltip={t.label}
                isActive={path === t.route}
                activeColor={colors.iconActiveAlt}
                onClick={() => go(t.route, t.id)}
              />
            ))} */}
          </>
        )}
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

          <div className={styles.iconWrapper} onClick={() => {
            setMode('academia')
            setIsExpanded(true)
          }} title="Academia">
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

        <div className={styles.avatarContainer}>
          <ChatAvatar sessionId={sessionId} size={26} />
        </div>
      </div>
    </div>
  )
}

export default memo(CollapsedView)
