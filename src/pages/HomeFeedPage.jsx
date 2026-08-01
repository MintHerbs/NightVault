import { useEffect, useLayoutEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Starfield from '../components/effects/Starfield/Starfield'
import PostComposer from '../components/social/PostComposer/PostComposer'
import PostCard from '../components/social/PostCard/PostCard'
import OnboardingCarousel from '../components/social/OnboardingCarousel/OnboardingCarousel'
import { usePosts } from '../hooks/usePosts'
import { useRateLimit } from '../hooks/useRateLimit'
import styles from './HomeFeedPage.module.css'

const SKELETON_ROWS = [
  ['96%', '88%', '72%'],
  ['92%', '64%'],
  ['98%', '90%', '84%', '58%'],
]

function FeedSkeleton() {
  return (
    <div className={styles.skeletonList} aria-hidden="true">
      {SKELETON_ROWS.map((rows, i) => (
        <motion.div
          key={i}
          className={styles.skeletonCard}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: i * 0.07, ease: [0.2, 0, 0, 1] }}
        >
          <div className={styles.skeletonHeader}>
            <div className={styles.skeletonAvatar}>
              <div className={styles.shimmer} />
            </div>
            <div className={styles.skeletonMeta}>
              <div className={styles.pulseLine} style={{ width: '104px', height: '11px' }}>
                <div className={styles.shimmer} />
              </div>
              <div className={styles.pulseLine} style={{ width: '58px', height: '9px' }}>
                <div className={styles.shimmer} />
              </div>
            </div>
          </div>

          <div className={styles.skeletonContent}>
            {rows.map((width, r) => (
              <div key={r} className={styles.pulseLine} style={{ width, height: '11px' }}>
                <div className={styles.shimmer} />
              </div>
            ))}
          </div>

          <div className={styles.skeletonActions}>
            <div
              className={styles.pulseLine}
              style={{ width: '104px', height: '36px', borderRadius: '18px' }}
            >
              <div className={styles.shimmer} />
            </div>
            <div
              className={styles.pulseLine}
              style={{ width: '72px', height: '36px', borderRadius: '18px' }}
            >
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
              >
                <p className={styles.emptyTitle}>Nothing here yet</p>
                Be the first to post something. Questions, snippets, half-formed
                thoughts all welcome.
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

      {showCarousel && <OnboardingCarousel onComplete={() => setShowCarousel(false)} />}
    </div>
  )
}
