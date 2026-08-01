// Router shell — global UI + state. Route table lives in src/routes/index.jsx.
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useRef, useState, Suspense, useEffect } from 'react'
import { usePresence } from './hooks/usePresence'
import useChat from './hooks/useChat'
import usePostAlerts from './hooks/usePostAlerts'
import { ThemeProvider } from './hooks/useTheme'
import { AIActivityProvider } from './hooks/useAIActivity'
import useIslandDock from './hooks/useIslandDock'
import MusicPlayer from './components/layout/MusicPlayer/MusicPlayer'
import DynamicIsland from './components/layout/DynamicIsland'
import Sidebar from './components/layout/Sidebar'
import Starfield from './components/effects/Starfield/Starfield'
import { ChatPanel, ChatDimOverlay } from './features/chat/components'
import { AppRoutes, preloadRoutes } from './routes'
import { trackPageView } from './lib/analytics/tracker'
import { allowsIslandNotifications } from './lib/notificationScope'
import { songs } from './config/songs'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { onlineCount, presenceSynced } = usePresence()
  const musicPlayerRef = useRef(null)
  // Starts false and is corrected by the player's own state events. Assuming
  // playback here made the pill's icon lie from first paint whenever the
  // browser blocked autoplay, with nothing to ever correct it (T-079).
  const [isPlaying, setIsPlaying] = useState(false)
  const [aiState, setAIState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  // Set by whichever surface is showing; see src/hooks/useIslandDock.js.
  const islandDock = useIslandDock()
  const [activeChild, setActiveChild] = useState('btree')
  const [isChatOpen, setIsChatOpen] = useState(false)
  // Which surface opened chat. The island only offers its "Back" shortcut for
  // a chat it opened itself (T-080), so this has to be state rather than a
  // ref — the island re-renders on it.
  const [chatSource, setChatSource] = useState(null)
  // Single source of truth for the track: the island used to keep its own
  // index alongside this, synced one way, free to drift.
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  // Whether the next track change should start playing or just cue. A track
  // ending should roll on; a visitor skipping while paused should stay paused.
  const [autoplayOnTrackChange, setAutoplayOnTrackChange] = useState(true)
  const sessionId = localStorage.getItem('session_id') || 'anonymous'
  const { unreadCount, lastIncoming } = useChat(isChatOpen)
  // A new post is only news while you aren't already looking at the feed. Chat
  // covering the feed still counts as away from it.
  const isViewingFeed = location.pathname === '/social/feed' && !isChatOpen
  const {
    unreadCount: unreadPosts,
    lastIncoming: lastIncomingPost,
  } = usePostAlerts(isViewingFeed)

  const currentSong = songs[currentSongIndex]

  const isToolsRoute = location.pathname.startsWith('/tools/')
  const isAdminRoute = location.pathname.startsWith('/admin')
  // Notes keep the flat reading background (no Starfield) but the global
  // Sidebar now persists here too (reverses T-035's full-bleed suppression;
  // owner decision 2026-07-23 — sidebar is persistent, incl. on notes).
  const isNoteRoute = location.pathname.startsWith('/notes/')
  // ERD renders its own comet-free Starfield; a second global one would run
  // behind .erdPage's opaque background, costing frames while never being seen
  const isERDRoute = location.pathname.startsWith('/erd')
  // The Digital Logic sandbox is a workbench rather than something to read over
  // a backdrop: stars drifting behind a schematic compete with the wires for
  // the same attention, and the canvas covers the whole viewport anyway. The
  // sidebar rail goes with it (T-096) — the mode is a bare canvas with floating
  // controls, and its own transport dock carries the way back out.
  const isCircuitSandbox = location.pathname === '/arch/digital-logic'
    && new URLSearchParams(location.search).get('mode') === 'sandbox'

  useEffect(() => {
    const t = setTimeout(preloadRoutes, 3000)
    import('./pages/HomeFeedPage')
    return () => clearTimeout(t)
  }, [])

  // T-086: the single place every navigation passes through, so route analytics
  // needs one hook rather than one per page. Keyed on pathname only — a ?mode=
  // change inside the Grade Toolkit is not a new pageview, and the toolkit
  // rewrites that param on every mode switch (it reports its own tool event
  // instead). trackPageView swallows its own failures; it must never be able to
  // break navigation.
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])

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
    // Deliberately not flipped optimistically here — the player reports back
    // through onPlayingChange, which is the only thing that knows what
    // actually happened (a blocked autoplay, a buffer stall, an ad).
  }

  const skipTrack = (delta) => {
    setAutoplayOnTrackChange(isPlaying)
    setCurrentSongIndex((prev) => (prev + delta + songs.length) % songs.length)
  }

  const handleTrackEnd = () => {
    setAutoplayOnTrackChange(true)
    setCurrentSongIndex((prev) => (prev + 1) % songs.length)
  }

  // Stable identity: the island restarts its progress poll whenever this
  // changes, so an inline arrow would restart it on every render.
  const getProgress = useCallback(() => musicPlayerRef.current?.getProgress() ?? 0, [])

  const openChatFromIsland = useCallback(() => {
    setChatSource('island')
    setIsChatOpen(true)
  }, [])

  const openFeedFromIsland = useCallback(() => {
    setIsChatOpen(false)
    navigate('/social/feed')
  }, [navigate])

  // The island shows one thing at a time, so the two streams feed one slot and
  // whichever arrives last wins. Each stream pushes its own arrival rather than
  // the two being compared by created_at: usePostAlerts awaits an ownership RPC
  // before publishing, so a post can reach state after a chat message that was
  // written later, and picking by timestamp would hand back the message the
  // island had already shown. Its lastSeenId guard would then treat the loser
  // as a repeat and drop it outright. Arrival order has no such hole.
  //
  // Tagging the chat side here rather than inside useChat keeps that hook
  // unaware of the island's event vocabulary.
  const [islandEvent, setIslandEvent] = useState(null)

  useEffect(() => {
    if (!lastIncoming) return
    setIslandEvent({ ...lastIncoming, kind: 'chat' })
  }, [lastIncoming])

  useEffect(() => {
    if (!lastIncomingPost) return
    setIslandEvent(lastIncomingPost)
  }, [lastIncomingPost])

  const closeChat = useCallback(() => setIsChatOpen(false), [])

  // Sidebar toggles with a functional updater, so this has to forward whatever
  // it passes rather than assuming a boolean.
  const setChatOpenFromSidebar = useCallback((next) => {
    setChatSource('sidebar')
    setIsChatOpen(next)
  }, [])

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
    <AIActivityProvider>
      {!isAdminRoute && !isNoteRoute && !isERDRoute && !isCircuitSandbox && <Starfield />}
      {isChatOpen && !isToolsRoute && <ChatDimOverlay />}
      <DynamicIsland
        onlineCount={onlineCount}
        presenceSynced={presenceSynced}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        aiState={aiState}
        errorMessage={errorMessage}
        dock={islandDock}
        currentSong={currentSong}
        onSkipBack={() => skipTrack(-1)}
        onSkipForward={() => skipTrack(1)}
        getProgress={getProgress}
        lastIncoming={islandEvent}
        isChatOpen={isChatOpen}
        isViewingFeed={isViewingFeed}
        interruptible={allowsIslandNotifications(location.pathname)}
        chatOpenedFromIsland={chatSource === 'island'}
        onOpenChat={openChatFromIsland}
        onOpenFeed={openFeedFromIsland}
        onCloseChat={closeChat}
      />
      {/* Global sidebar - persists on every route EXCEPT admin, which has its
          own AdminBrowser + EditorNavbar chrome (owner decision 2026-07-23:
          sidebar persistent incl. on notes, but not over the admin panel). */}
      {!isAdminRoute && !isCircuitSandbox && (
        <Sidebar
          defaultOpenGroup="database"
          activeChild={activeChild}
          onChildSelect={setActiveChild}
          isChatOpen={isChatOpen}
          setIsChatOpen={setChatOpenFromSidebar}
          unreadCount={unreadCount}
          unreadPosts={unreadPosts}
        />
      )}
      {/* Rendered on every route, including /admin. Gating this on
          !isAdminRoute destroyed the player mid-song on navigation there and
          left the island's transport controls no-oping against a null ref
          while the pill still displayed them (T-079). */}
      <MusicPlayer
        ref={musicPlayerRef}
        videoId={currentSong.id}
        autoplayOnChange={autoplayOnTrackChange}
        onPlayingChange={setIsPlaying}
        onTrackEnd={handleTrackEnd}
      />

      {/* Only routes fade — nothing else */}
      <div style={{
        opacity: isChatOpen ? 0 : 1,
        pointerEvents: isChatOpen ? 'none' : 'auto',
        transition: 'opacity 0.3s ease'
      }}>
        <Suspense fallback={null}>
          {/* handleAIStateChange, not setAIState: the wrapper is what carries
              the error message through and auto-clears the error state, and
              wiring the raw setter here meant neither ever happened. */}
          <AppRoutes
            onAIStateChange={handleAIStateChange}
            onChatOpen={() => setIsChatOpen(true)}
          />
        </Suspense>
      </div>

      {/* Chat panel outside the fading wrapper. Online count is deliberately
          not passed in: the Dynamic Island already owns that display, and
          the panel doesn't repeat it. */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={closeChat}
        sessionId={sessionId}
      />
    </AIActivityProvider>
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
