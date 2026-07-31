// Number and date formatting for the analytics dashboard (T-086).

/** 1234 -> "1.2k". Keeps ranked rows aligned without a monospace font. */
export function formatCount(value) {
  const n = Number(value) || 0
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`
  }
  return `${(n / 1_000_000).toFixed(1)}M`
}

/** 0.42 -> "42%". */
export function formatPercent(ratio) {
  const n = Number(ratio)
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(n * 100)}%`
}

/** 32.4 -> "32.4", 5 -> "5". Avoids "5.0" on whole numbers. */
export function formatRatio(value) {
  const n = Number(value) || 0
  if (n === 0) return '0'
  return n < 10 ? n.toFixed(1) : String(Math.round(n))
}

/** '2026-07-31' -> '31 Jul'. Parsed as a plain date, never through a timezone. */
export function formatDay(day) {
  if (typeof day !== 'string') return ''
  const [year, month, date] = day.slice(0, 10).split('-').map(Number)
  if (!year || !month || !date) return ''
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${date} ${MONTHS[month - 1]}`
}

/**
 * "3 days ago". Deliberately coarse: on a notes dashboard the useful question is
 * whether something is fresh or stale, not the hour it was saved.
 */
export function formatAgo(timestamp) {
  if (!timestamp) return ''
  const then = new Date(timestamp).getTime()
  if (!Number.isFinite(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}
