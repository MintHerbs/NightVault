import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import styles from './MusicPlayer.module.css'

// YouTube IFrame API player state codes.
const YT_ENDED = 0
const YT_PLAYING = 1
const YT_PAUSED = 2

const MusicPlayer = forwardRef(({
  videoId = 'wjJ3-SzxhCk',
  autoplayOnChange = true,
  onPlayingChange,
  onTrackEnd
}, ref) => {
  const playerRef = useRef(null)
  // The YT event handlers are captured once, at player construction, so they
  // have to read through refs or they close over first-render props forever.
  const videoIdRef = useRef(videoId)
  const autoplayOnChangeRef = useRef(autoplayOnChange)
  const onPlayingChangeRef = useRef(onPlayingChange)
  const onTrackEndRef = useRef(onTrackEnd)

  videoIdRef.current = videoId
  autoplayOnChangeRef.current = autoplayOnChange
  onPlayingChangeRef.current = onPlayingChange
  onTrackEndRef.current = onTrackEnd

  // `new YT.Player()` hands back an object immediately, but the API attaches
  // its methods asynchronously and only finishes by onReady. So the ref being
  // non-null is not enough: every call has to check the method itself, which
  // is what getProgress below already did and the other three did not:
  // `playerRef.current?.unMute()` threw a TypeError out of App's
  // first-interaction handler whenever someone clicked before the iframe came
  // up (a fast click, a slow connection, or YouTube blocked outright).
  const call = (method) => {
    const player = playerRef.current
    if (!player || typeof player[method] !== 'function') return false
    player[method]()
    return true
  }

  useImperativeHandle(ref, () => ({
    play: () => call('playVideo'),
    pause: () => call('pauseVideo'),
    // Returns whether it actually happened, so the caller can keep waiting.
    // App unmutes on the first interaction and then stops listening; without
    // this it would spend that one chance on a player that was not ready yet
    // and stay muted for the rest of the session.
    unmute: () => call('unMute'),
    // Polled by the island's music panel for its progress ring. Returns a
    // 0..1 fraction, or 0 while the player can't answer yet.
    getProgress: () => {
      const player = playerRef.current
      if (!player || typeof player.getDuration !== 'function') return 0
      const duration = player.getDuration()
      if (!duration) return 0
      return Math.min(player.getCurrentTime() / duration, 1)
    }
  }))

  useEffect(() => {
    // Only inject script once globally
    if (!window.YT && !document.getElementById('yt-api-script')) {
      const script = document.createElement('script')
      script.id = 'yt-api-script'
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        // Through the ref, not the prop: the track can change before the
        // API finishes loading, and the closure would pin the stale one.
        videoId: videoIdRef.current,
        playerVars: {
          autoplay: 1,
          controls: 0,
          // No loop/playlist pair here on purpose. Those only apply to the
          // video the player was constructed with, so after the first
          // loadVideoById looping silently stopped working and the track
          // fell silent at its end. onStateChange handles ENDED instead,
          // which also lets the playlist advance (T-079).
          // Start muted: browsers block unmuted autoplay without prior
          // user interaction. We unmute on the page's first click/keypress.
          mute: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => {
            if (e.data === YT_ENDED) {
              onTrackEndRef.current?.()
              return
            }
            // Only committed play/pause transitions are reported. Buffering
            // and cued are transient, and forwarding them would make the
            // pill's icon flicker mid-load.
            if (e.data === YT_PLAYING) onPlayingChangeRef.current?.(true)
            if (e.data === YT_PAUSED) onPlayingChangeRef.current?.(false)
          }
        }
      })
    }

    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
      }
    }
  }, [])

  // Load new video when videoId prop changes
  useEffect(() => {
    if (!videoId) return

    const player = playerRef.current
    if (!player || typeof player.loadVideoById !== 'function') return

    // loadVideoById always autoplays, which is right when a track ended and
    // the playlist is rolling on, and wrong when the visitor skipped while
    // paused — that used to start audio while the pill still showed ▶.
    // cueVideoById loads without playing, leaving the transport honest.
    if (autoplayOnChangeRef.current) {
      player.loadVideoById(videoId)
    } else {
      player.cueVideoById(videoId)
    }
  }, [videoId])

  /**
   * The wrapper is load-bearing, not styling.
   *
   * `new YT.Player('yt-player')` *replaces* the element it is given with an
   * iframe, so the node React thinks is its child stops being in the document
   * the moment the API loads. Any later sibling insertion in App then asks the
   * DOM to `insertBefore` that missing node and throws, taking the render with
   * it — which is what happened the first time a sibling became conditional
   * (T-096 made the global Sidebar unmount for the circuit sandbox).
   *
   * Wrapping gives React a child it still owns. The API only ever swaps the
   * inner div, which nothing reconciles against afterwards.
   */
  return (
    <div className={styles.hidden}>
      <div id="yt-player" />
    </div>
  )
})

MusicPlayer.displayName = 'MusicPlayer'

export default MusicPlayer
