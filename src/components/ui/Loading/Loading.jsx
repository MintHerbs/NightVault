import { useEffect, useState } from 'react'
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import styles from './Loading.module.css'

export default function Loading({ size = 45, color = 'var(--color-accent)', className = '' }) {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)

  // Respect user's motion preferences — see docs/design/motion.md
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setShouldReduceMotion(motionQuery.matches)

    const handleMotionChange = (e) => setShouldReduceMotion(e.matches)
    motionQuery.addEventListener('change', handleMotionChange)

    return () => motionQuery.removeEventListener('change', handleMotionChange)
  }, [])

  return (
    <div className={`${styles.loading} ${className}`.trim()} role="status" aria-label="Loading">
      {shouldReduceMotion ? (
        <div className={styles.staticDot} style={{ width: size, height: size, background: color }} />
      ) : (
        <Quantum size={size} speed="1.75" color={color} />
      )}
    </div>
  )
}
