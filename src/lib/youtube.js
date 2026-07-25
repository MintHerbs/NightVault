// A valid YouTube video ID is always exactly 11 characters of this alphabet —
// used both to validate extraction results and to gate untrusted `id`
// attributes coming back out of stored Markdown (e.g. a hand-edited note).
export const YOUTUBE_ID_RE = /^[\w-]{11}$/

const URL_PATTERNS = [
  /(?:youtube(?:-nocookie)?\.com)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
]

// Extracts a YouTube video ID from a URL (long form, youtu.be short link, or
// /shorts/) with any query params/timestamps ignored. Returns null for
// anything else — no network call, no trust placed in anything but the
// 11-char ID itself.
export function extractYouTubeId(url) {
  if (!url) return null
  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(url)
    if (match && YOUTUBE_ID_RE.test(match[1])) return match[1]
  }
  return null
}

export function youtubeThumbnailSrc(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function youtubeEmbedSrc(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`
}
