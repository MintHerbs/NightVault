import { useEffect, useState } from 'react'

// Shared "which course am I looking at" state (T-051 follow-up) — persisted
// so picking a course on the Team page and switching to the content browser
// (or vice versa) land on the same course instead of each page defaulting
// back to your own. Only the primary owner ever writes a value that isn't
// their own course_id; everyone else is locked to it regardless of what's
// in storage (a stale value from a previous primary-owner session on the
// same browser must never leak into a course-locked account's view).
const STORAGE_KEY = 'admin-active-course-id'

export function useActiveCourse(profile, isPrimaryOwner) {
  const [activeCourseId, setActiveCourseIdState] = useState(() => (
    typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  ))

  useEffect(() => {
    if (!profile) return
    if (!isPrimaryOwner) { setActiveCourseIdState(profile.course_id); return }
    setActiveCourseIdState((prev) => prev ?? profile.course_id)
  }, [profile, isPrimaryOwner])

  const setActiveCourseId = (id) => {
    setActiveCourseIdState(id)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id)
  }

  return [activeCourseId, setActiveCourseId]
}

/** Call on sign-out — otherwise the next login on this browser (possibly a
 * different account entirely) inherits whatever course the previous primary
 * owner session last switched to, which may be empty or not theirs. */
export function clearActiveCourse() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}
