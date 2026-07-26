// Router shell — global UI + state. Route table lives in src/routes/index.jsx.
import { BrowserRouter, useLocation } from 'react-router-dom'
import { createContext, useRef, useState, Suspense, useEffect } from 'react'
import { usePresence } from './hooks/usePresence'
import useChat from './hooks/useChat'
import { ThemeProvider } from './hooks/useTheme'
import MusicPlayer from './components/layout/MusicPlayer/MusicPlayer'
import DynamicIsland from './components/layout/DynamicIsland'
import Sidebar from './components/layout/Sidebar'
import Starfield from './components/effects/Starfield/Starfield'
import { ChatPanel, ChatDimOverlay } from './features/chat/components'
import { AppRoutes, preloadRoutes } from './routes'

export const OnlineCountContext = createContext(1)

function AppContent() {
  const location = useLocation()
  const { onlineCount } = usePresence()
  const musicPlayerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [aiState, setAIState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [activeChild, setActiveChild] = useState('btree')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [currentSongId, setCurrentSongId] = useState('wjJ3-SzxhCk')
  const sessionId = localStorage.getItem('session_id') || 'anonymous'
  const { unreadCount } = useChat(isChatOpen)

  const isToolsRoute = location.pathname.startsWith('/tools/')
  const isAdminRoute = location.pathname.startsWith('/admin')
  // Notes keep the flat reading background (no Starfield) but the global
  // Sidebar now persists here too (reverses T-035's full-bleed suppression;
  // owner decision 2026-07-23 — sidebar is persistent, incl. on notes).
  const isNoteRoute = location.pathname.startsWith('/notes/')

  useEffect(() => {
    const t = setTimeout(preloadRoutes, 3000)
    import('./pages/HomeFeedPage')
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    // Player autoplays muted (browsers block unmuted autoplay). Unmute
    // as soon as the visitor interacts with the page in any way.
    const unmuteOnInteraction = () => {
      musicPlayerRef.current?.unmute()
      window.removeEventListener('pointerdown', unmuteOnInteraction)
      window.removeEventListener('keydown', unmuteOnInteraction)
    }

    window.addEventListener('pointerdown', unmuteOnInteraction)
    window.addEventListener('keydown', unmuteOnInteraction)

    return () => {
      window.removeEventListener('pointerdown', unmuteOnInteraction)
      window.removeEventListener('keydown', unmuteOnInteraction)
    }
  }, [])

  const handlePlayPause = () => {
    if (isPlaying) {
      musicPlayerRef.current?.pause()
    } else {
      musicPlayerRef.current?.play()
    }
    setIsPlaying(prev => !prev)
  }

  const handleAIStateChange = (newState, message = '') => {
    setAIState(newState)
    setErrorMessage(message)

    // Auto-reset error state after 3 seconds
    if (newState === 'error') {
      setTimeout(() => {
        setAIState('idle')
        setErrorMessage('')
      }, 3000)
    }
  }

  return (
    <>
      {!isAdminRoute && !isNoteRoute && <Starfield />}
      {isChatOpen && !isToolsRoute && <ChatDimOverlay />}
      <DynamicIsland
        onlineCount={onlineCount}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        aiState={aiState}
        errorMessage={errorMessage}
        onSongChange={setCurrentSongId}
      />
      {/* Global sidebar - persists on every route EXCEPT admin, which has its
          own AdminBrowser + EditorNavbar chrome (owner decision 2026-07-23:
          sidebar persistent incl. on notes, but not over the admin panel). */}
      {!isAdminRoute && (
        <Sidebar
          defaultOpenGroup="database"
          activeChild={activeChild}
          onChildSelect={setActiveChild}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          unreadCount={unreadCount}
        />
      )}
      <MusicPlayer ref={musicPlayerRef} videoId={currentSongId} />

      {/* Only routes fade — nothing else */}
      <div style={{
        opacity: isChatOpen ? 0 : 1,
        pointerEvents: isChatOpen ? 'none' : 'auto',
        transition: 'opacity 0.3s ease'
      }}>
        <Suspense fallback={null}>
          <OnlineCountContext.Provider value={onlineCount}>
            <AppRoutes
              onAIStateChange={setAIState}
              onChatOpen={() => setIsChatOpen(true)}
            />
          </OnlineCountContext.Provider>
        </Suspense>
      </div>

      {/* Chat panel outside the fading wrapper */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        sessionId={sessionId}
      />
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
