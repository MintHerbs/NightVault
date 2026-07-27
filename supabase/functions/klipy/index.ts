import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// KLIPY puts the API key in the request *path*
// (https://api.klipy.com/api/v1/{API_KEY}/gifs/search), so it can never be
// called straight from the browser — a VITE_-prefixed key would be readable in
// the JS bundle by anyone who opens devtools. This function is the only place
// the key exists. Set it with:
//
//   supabase secrets set KLIPY_API_KEY=...
//
// The social feed is anonymous, so there is no admin check here; the caller is
// authenticated only as the anon role via supabase-js `functions.invoke`.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BASE = 'https://api.klipy.com/api/v1'
const KINDS = new Set(['gifs', 'stickers'])
const MIN_PER_PAGE = 8
const MAX_PER_PAGE = 50

type MediaFile = { url: string; width: number; height: number; ext: string }

/**
 * KLIPY nests its renditions a few levels deep and the exact key names are not
 * pinned down anywhere we can rely on, so rather than hardcode a path we walk
 * the payload for anything that looks like a rendition. That keeps the picker
 * working if they rename or add a size tier.
 */
function collectFiles(node: unknown, out: MediaFile[] = [], depth = 0): MediaFile[] {
  if (!node || typeof node !== 'object' || depth > 5) return out

  const record = node as Record<string, unknown>
  const url = typeof record.url === 'string' ? record.url : null

  if (url) {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
    out.push({
      url,
      width: Number(record.width) || 0,
      height: Number(record.height) || 0,
      ext,
    })
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') collectFiles(value, out, depth + 1)
  }

  return out
}

function area(file: MediaFile) {
  return (file.width || 0) * (file.height || 0)
}

function pickRenditions(item: Record<string, unknown>) {
  const files = collectFiles(item.file ?? item.files ?? item.media ?? item)
  if (!files.length) return null

  // Animated stills only. mp4 would need a <video> and autoplay handling that
  // the feed's <img> rendering does not have.
  const animated = files.filter((f) => f.ext === 'gif' || f.ext === 'webp')
  const usable = animated.length ? animated : files
  const bySize = [...usable].sort((a, b) => area(a) - area(b))

  // Smallest for the grid thumbnail, a mid tier for the post itself so a
  // 4K rendition never lands in the feed.
  const preview = bySize.find((f) => f.ext === 'webp') ?? bySize[0]
  const full = bySize[Math.min(bySize.length - 1, Math.floor(bySize.length / 2))] ?? bySize[0]

  return { preview, full }
}

function normalize(payload: Record<string, unknown>) {
  const outer = (payload?.data ?? {}) as Record<string, unknown>
  const rows = Array.isArray(outer.data) ? outer.data : []

  const items = rows
    .map((raw) => {
      const item = raw as Record<string, unknown>
      const picked = pickRenditions(item)
      if (!picked) return null
      return {
        id: String(item.id ?? item.slug ?? picked.full.url),
        title: typeof item.title === 'string' ? item.title : '',
        previewUrl: picked.preview.url,
        fullUrl: picked.full.url,
        width: picked.preview.width || null,
        height: picked.preview.height || null,
      }
    })
    .filter(Boolean)

  return {
    items,
    page: Number(outer.current_page) || 1,
    hasNext: Boolean(outer.has_next),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('KLIPY_API_KEY')
    if (!apiKey) {
      return json({ error: 'KLIPY is not configured' }, 503)
    }

    const body = await req.json().catch(() => ({}))
    const kind = String(body.kind || 'gifs')
    if (!KINDS.has(kind)) {
      return json({ error: `Unsupported kind: ${kind}` }, 400)
    }

    const query = String(body.q || '').trim()
    const page = Math.max(1, Number(body.page) || 1)
    const perPage = Math.min(MAX_PER_PAGE, Math.max(MIN_PER_PAGE, Number(body.perPage) || 24))
    const customerId = String(body.customerId || '').slice(0, 100)

    const path = query ? 'search' : 'trending'
    const url = new URL(`${BASE}/${apiKey}/${kind}/${path}`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(perPage))
    if (query) url.searchParams.set('q', query)
    if (customerId) url.searchParams.set('customer_id', customerId)

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return json({ error: `KLIPY request failed (${res.status})` }, 502)
    }

    const payload = await res.json()
    if (payload?.result === false) {
      return json({ error: 'KLIPY returned an error' }, 502)
    }

    return json(normalize(payload))
  } catch (error) {
    return json({ error: (error as Error).message || 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
