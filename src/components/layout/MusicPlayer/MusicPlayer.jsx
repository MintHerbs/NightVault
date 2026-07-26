import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import styles from './MusicPlayer.module.css'

const MusicPlayer = forwardRef(({ videoId = 'wjJ3-SzxhCk' }, ref) => {
  const playerRef = useRef(null)

  useImperativeHandle(ref, () => ({
    play: () => {
      playerRef.current?.playVideo()
    },
    pause: () => {
      playerRef.current?.pauseVideo()
    },
    unmute: () => {
      playerRef.current?.unMute()
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
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          // Start muted: browsers block unmuted autoplay without prior
          // user interaction. We unmute on the page's first click/keypress.
          mute: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (e) => e.target.playVideo()
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
    
    // If the YouTube player is ready, load the new video
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById(videoId)
    }
  }, [videoId])

  return <div id="yt-player" className={styles.hidden} />
})

MusicPlayer.displayName = 'MusicPlayer'

export default MusicPlayer
