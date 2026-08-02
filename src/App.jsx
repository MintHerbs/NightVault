// Router shell — global UI + state. Route table lives in src/routes/index.jsx.
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useRef, useState, Suspense, useEffect } from 'react'
import { usePresence } from './hooks/usePresence'
import useChat from './hooks/useChat'
import usePostAlerts from './hooks/usePostAlerts'
import { ThemeProvider } from './hooks/useTheme'
import { AIActivityProvider } from './hooks/useAIActivity'
import useIslandDock from './hooks/useIslandDock'
import useSessionId from './lib/sessionId'
import MusicPlayer from './components/layout/MusicPlayer/MusicPlayer'
import DynamicIsland from './components/layout/DynamicIsland'
import Sidebar from './components/layout/Sidebar'
import Starfield from './components/effects/Starfield/Starfield'
import { ChatPanel, ChatDimOverlay } from './features/chat/components'
import { AppRoutes, preloadRoutes } from './routes'
import { trackPageView } from './lib/analytics/tracker'
import { fireQuip } from './hooks/useSentinelQuip'
import { routeQuipContext } from './lib/sentinel/routeQuips'
import { INITIAL_AI_MEMORY, nextAIMemory } from './lib/sentinel/aiMoments'
import useSentinelSignals from './hooks/useSentinelSignals'
import useSentinelPersonality from './hooks/useSentinelPersonality'
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
  // The aiState stream's own memory: an error run to notice, and when the
  // current piece of work started. A ref, because nothing renders from it.
  const aiMemoryRef = useRef({ memory: INITIAL_AI_MEMORY, previous: 'idle' })
  const [errorMessage, setErrorMessage] = useState('')
  // Set by whichever surface is showing; see src/hooks/useIslandDock.js.
  const islandDock = useIslandDock()
  const sentinelPersonality = useSentinelPersonality()
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
  const sessionId = useSessionId()
  const { unreadCount, lastIncoming } = useChat(isChatOpen)
  // A new post is only news while you aren't already looking at the feed. Chat
  // covering the feed still counts as away from it.
  const isViewingFeed = location.pathname === '/social/feed' && !isChatOpen
  const {
    unreadCount: unreadPosts,
    lastIncoming: lastIncomingPost,
  } = usePostAlerts(isViewingFeed)

  const currentSong = songs[currentSongIndex]

  // Everything Sentinel notices without a page's help: connectivity, copying,
  // printing, a file dragged in, a long absence, the hour you turned up, and
  // the egg. One mount, all passive listeners.
  useSentinelSignals({ enabled: sentinelPersonality })

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

  // Sentinel's reaction to arriving somewhere (T-094). Keyed on search as well
  // as pathname, unlike the pageview above: the four Digital Logic tools share
  // one path and differ only by ?mode=, so dropping search would give all four
  // the same remark. fireQuip gates itself and never throws, so this cannot
  // affect navigation.
  useEffect(() => {
    const context = routeQuipContext(location.pathname, location.search)
    // Deferred when the island is busy rather than dropped: a fresh load
    // straight onto a tool page arrives while the pill is still doing its
    // entrance, so without this every tool would be silent to anyone who
    // opened it in a new tab.
    if (context) fireQuip(context, { deferIfBusy: true })
  }, [location.pathname, location.search])

  // Chat opens from the sidebar, the island and its own route, so this watches
  // the flag rather than any one of those doors.
  useEffect(() => {
    if (isChatOpen) fireQuip({ kind: 'chrome', id: 'chat' }, { deferIfBusy: true })
  }, [isChatOpen])

  // Tool reactions, derived from the aiState stream every tool already reports
  // through (docs/rules.md §15). Wired once here rather than ten times: a new
  // tool inherits "there we go", "take your time" and "too easy" by reporting
  // its state at all, without knowing Sentinel exists.
  useEffect(() => {
    const previous = aiMemoryRef.current.previous
    if (previous === aiState) return
    const { memory, moment } = nextAIMemory(aiMemoryRef.current.memory, {
      previous,
      next: aiState,
      now: Date.now(),
    })
    aiMemoryRef.current = { memory, previous: aiState }
    if (moment) fireQuip(moment)
  }, [aiState])

  useEffect(() => {
    // Player autoplays muted (browsers block unmuted autoplay). Unmute
    // as soon as the visitor interacts with the page in any way.
    //
    // Only stops listening once the unmute actually took. The YouTube iframe
    // API attaches its methods asynchronously, so an interaction that lands
    // before the player is ready cannot be honoured, and this used to spend
    // its one chance on it anyway (in fact it threw, which is the only reason
    // the listeners survived to try again). Now it simply waits for the next
    // interaction.
    const unmuteOnInteraction = () => {
      if (!musicPlayerRef.current?.unmute()) return
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

  // Three skips inside this window reads as nothing on the playlist landing,
  // which is the only thing worth remarking on. A track ending on its own does
  // not count: handleTrackEnd is a separate path deliberately.
  const RESTLESS_WINDOW_MS = 15000
  const skipTimes = useRef([])

  const skipTrack = (delta) => {
    const now = Date.now()
    skipTimes.current = [...skipTimes.current, now].filter((t) => now - t < RESTLESS_WINDOW_MS)
    if (skipTimes.current.length >= 3) {
      skipTimes.current = []
      // Always deferred in practice: the skip buttons only exist inside the
      // open music panel, which is itself a state that outranks a quip, so
      // firing this inline would drop it every single time. It surfaces when
      // the panel closes.
      fireQuip({ kind: 'chrome', id: 'music-restless' }, { deferIfBusy: true })
    }
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
