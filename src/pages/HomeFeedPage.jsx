import { useEffect, useLayoutEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Starfield from '../components/effects/Starfield/Starfield'
import PostComposer from '../components/social/PostComposer/PostComposer'
import PostCard from '../components/social/PostCard/PostCard'
import OnboardingCarousel from '../components/social/OnboardingCarousel/OnboardingCarousel'
import { usePosts } from '../hooks/usePosts'
import { useRateLimit } from '../hooks/useRateLimit'
import styles from './HomeFeedPage.module.css'

function FeedSkeleton() {
  return (
    <div className={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <motion.div 
          key={i} 
          className={styles.skeletonCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
        >
          {/* Header with avatar and meta */}
          <div className={styles.skeletonHeader}>
            <div className={styles.skeletonAvatar}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.skeletonMeta}>
              <div className={styles.pulseLine} style={{ width: '80px', height: '12px', marginBottom: '6px' }}>
                <div className={styles.shimmer} />
              </div>
              <div className={styles.pulseLine} style={{ width: '50px', height: '10px' }}>
                <div className={styles.shimmer} />
              </div>
            </div>
          </div>

          {/* Content lines */}
          <div className={styles.skeletonContent}>
            <div className={styles.pulseLine} style={{ width: '100%', height: '12px' }}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.pulseLine} style={{ width: '95%', height: '12px' }}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.pulseLine} style={{ width: '88%', height: '12px' }}>
              <div className={styles.shimmer} />
            </div>
          </div>

          {/* Actions area */}
          <div className={styles.skeletonActions}>
            <div className={styles.pulseLine} style={{ width: '60px', height: '32px', borderRadius: '8px' }}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.pulseLine} style={{ width: '60px', height: '32px', borderRadius: '8px' }}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.pulseLine} style={{ width: '60px', height: '32px', borderRadius: '8px' }}>
              <div className={styles.shimmer} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default function HomeFeedPage({ onAIStateChange }) {
  const sessionId = localStorage.getItem('session_id') || 'anonymous'
  const [showCarousel, setShowCarousel] = useState(false)
  const [navOffset, setNavOffset] = useState(64)

  useRateLimit()

  const {
    posts,
    isLoading,
    userVotes,
    userFlags,
    userPosts,
    createPost,
    updatePost,
    deletePost,
    votePost,
    votePoll,
    flagPost,
  } = usePosts()

  useEffect(() => {
    onAIStateChange?.('idle')
  }, [onAIStateChange])

  useLayoutEffect(() => {
    const updateNavOffset = () => {
      const navHeight = document.querySelector('[data-navbar]')?.offsetHeight ?? 64
      setNavOffset(navHeight)
      document.documentElement.style.setProperty('--nav-offset', `${navHeight}px`)
    }

    updateNavOffset()
    window.addEventListener('resize', updateNavOffset)
    return () => window.removeEventListener('resize', updateNavOffset)
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('social_onboarded')) setShowCarousel(true)
  }, [])

  const feedPosts = posts || []

  return (
    <div className={styles.page}>
      <Starfield />

      <div className={styles.feedColumn} style={{ '--nav-offset': `${navOffset}px` }}>
        <main className={styles.main}>
          <PostComposer sessionId={sessionId} onPost={(postData) => createPost?.(postData)} />

          {isLoading && <FeedSkeleton />}

          <AnimatePresence mode="wait">
            {!isLoading && feedPosts.length === 0 && (
              <motion.div 
                className={styles.empty}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                No posts yet. Be the first to share something.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scalar props, not a spread-rebuilt post object: a vote changes only
              the one post's identity, so React.memo keeps the other cards (and
              their syntax highlighting) from re-rendering. The handlers below
              are stable useCallbacks from usePosts for the same reason. */}
          <AnimatePresence>
            {!isLoading &&
              feedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  sessionId={sessionId}
                  isOwnPost={!!userPosts[post.id]}
                  userVote={userVotes[post.id] ?? null}
                  hasFlagged={!!userFlags[post.id]}
                  onVote={votePost}
                  onFlag={flagPost}
                  onEdit={updatePost}
                  onDelete={deletePost}
                  onPollVote={votePoll}
                />
              ))}
          </AnimatePresence>
        </main>
      </div>

      {showCarousel && (
        <OnboardingCarousel onComplete={() => setShowCarousel(false)} />
      )}
    </div>
  )
}
