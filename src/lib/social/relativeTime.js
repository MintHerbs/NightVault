// Short relative timestamps for the feed and comment threads. PostCard and
// CommentItem each carried a byte-identical private copy of this before
// T-087; the chat needs the absolute variants alongside it, so all four
// formatters live here.

/** "12s ago" / "4m ago" / "3h ago" / "6d ago". Empty string for bad input. */
export function formatRelativeTime(iso) {
  const ts = new Date(iso).getTime()
  if (!Number.isFinite(ts)) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${Math.max(sec, 0)}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

/** Full timestamp for a `title` attribute, so the short form stays hoverable. */
export function formatAbsoluteTime(iso) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** "14:32" — the per-message stamp in chat. */
export function formatClockTime(iso) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "Today" / "Yesterday" / "12 March 2026" — chat day dividers. */
export function formatDayLabel(iso) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

/** True when two ISO stamps fall on different calendar days. */
export function isDifferentDay(aIso, bIso) {
  const a = new Date(aIso)
  const b = new Date(bIso)
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  )
}
