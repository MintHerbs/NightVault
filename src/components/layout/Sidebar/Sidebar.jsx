/**
 * Sidebar — a static activity bar (T-049): no hover/click expand into a file
 * tree anymore, Academia navigates straight to /home. On mobile it's still an
 * off-canvas drawer toggled by the hamburger (content pages assume the
 * sidebar isn't docked below the 968px breakpoint — see PageShell), but the
 * drawer is the same static bar, never a wider expanded panel.
 */
import { memo, useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Sidebar.module.css'
import CollapsedView from './CollapsedView/CollapsedView'
import useSessionId from '../../../lib/sessionId'

function Sidebar({ activeChild, onChildSelect, isChatOpen, setIsChatOpen, unreadCount = 0, unreadPosts = 0 }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const sessionId = useSessionId()
  const [mode, setMode] = useState('academia')
  const [isMobile, setIsMobile] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const path = location.pathname

  const go = useCallback((route, childId) => {
    setIsChatOpen?.(false)
    onChildSelect?.(childId)
    navigate(route)
    if (isMobile) setIsOpen(false)
  }, [navigate, onChildSelect, setIsChatOpen, isMobile])

  // Detect mobile, for the off-canvas drawer toggle below.
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 968)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Keep the mode in step with the URL, so arriving at a social route any way
  // other than the globe button (a landing-page card, a direct link, a
  // refresh) still shows the social icons. Keyed on `path` alone, so the
  // Academia button can still switch mode without navigating away.
  useEffect(() => {
    setMode(path.startsWith('/social') ? 'social' : 'academia')
  }, [path])

  const handleOverlayClick = (e) => {
    if (isMobile && isOpen && e.target === e.currentTarget) setIsOpen(false)
  }

  return (
    <>
      {isMobile && isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 59,
          }}
          onClick={handleOverlayClick}
        />
      )}

      {isMobile && (
        <button
          type="button"
          className={styles.hamburgerButton}
          onClick={() => setIsOpen((p) => !p)}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isOpen}
        >
          <span className={styles.hamburgerBars} />
        </button>
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <CollapsedView
          go={go}
          activeChild={activeChild}
          onChildSelect={onChildSelect}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          unreadCount={unreadCount}
          unreadPosts={unreadPosts}
          mode={mode}
          setMode={setMode}
          sessionId={sessionId}
        />
      </aside>
    </>
  )
}

export default memo(Sidebar)
