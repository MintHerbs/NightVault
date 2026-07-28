import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Search, X } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'
import { EMOJI_ITEMS } from './emojiData'
import styles from './MediaPicker.module.css'

const DEFAULT_TABS = [
  { key: 'gifs', label: 'GIFs' },
  { key: 'stickers', label: 'Stickers' },
]

const PER_PAGE = 24
const DEBOUNCE_MS = 350

export default function MediaPicker({ onSelect, onClose, tabs = DEFAULT_TABS }) {
  const [kind, setKind] = useState(tabs[0].key)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const inputRef = useRef(null)
  // Guards against a slow page-1 response landing after a newer query and
  // repopulating the grid with stale results.
  const requestId = useRef(0)

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query])

  const load = useCallback(
    async (nextPage, { append }) => {
      if (kind === 'emoji') return
      const ticket = ++requestId.current
      setStatus(append ? 'loadingMore' : 'loading')
      setError(null)

      const { data, error: fnError } = await supabase.functions.invoke('klipy', {
        body: { kind, q: debouncedQuery, page: nextPage, perPage: PER_PAGE },
      })

      if (ticket !== requestId.current) return

      if (fnError || data?.error) {
        setError(data?.error || 'Could not reach the GIF library')
        setStatus('error')
        if (!append) setItems([])
        return
      }

      setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []))
      setPage(data.page || nextPage)
      setHasNext(Boolean(data.hasNext))
      setStatus('ready')
    },
    [kind, debouncedQuery]
  )

  useEffect(() => {
    load(1, { append: false })
  }, [load])

  // Emoji is a static local list — filtered on every keystroke, no debounce
  // or network round trip needed the way the KLIPY-backed tabs require.
  const emojiItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? EMOJI_ITEMS.filter((e) => e.name.includes(q)) : EMOJI_ITEMS
    return matches.map((e) => ({ id: e.char, title: e.name, char: e.char }))
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose?.()
    }
  }

  const skeletons = useMemo(() => Array.from({ length: 9 }, (_, i) => i), [])
  const isEmoji = kind === 'emoji'
  const displayItems = isEmoji ? emojiItems : items
  const isInitialLoad = !isEmoji && status === 'loading'

  return (
    <div className={styles.panel} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist" aria-label="Media type">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={kind === tab.key}
              className={`${styles.tab} ${kind === tab.key ? styles.tabActive : ''}`}
              onClick={() => setKind(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close media picker">
          <X size={16} />
        </button>
      </div>

      <div className={styles.searchField}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.searchInput}
          placeholder={`Search ${kind === 'gifs' ? 'GIFs' : kind === 'stickers' ? 'stickers' : 'emoji'}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${kind}`}
        />
        {query && (
          <button type="button" className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {!isEmoji && !debouncedQuery && !isInitialLoad && status !== 'error' && items.length > 0 && (
        <div className={styles.sectionLabel}>Trending</div>
      )}

      <div className={`${styles.grid} ${isEmoji ? styles.gridEmoji : ''}`} role="list">
        {isInitialLoad
          ? skeletons.map((i) => <div key={i} className={styles.skeleton} />)
          : displayItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="listitem"
                className={`${styles.thumbBtn} ${isEmoji ? styles.emojiBtn : ''}`}
                onClick={() => {
                  onSelect?.(item, kind)
                  if (!isEmoji) onClose?.()
                }}
                title={item.title || 'Select'}
              >
                {isEmoji ? (
                  <span className={styles.emojiGlyph}>{item.char}</span>
                ) : (
                  <img
                    className={styles.thumbImg}
                    src={item.previewUrl}
                    alt={item.title || ''}
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </button>
            ))}
      </div>

      {!isEmoji && status === 'error' && (
        <div className={styles.state} role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
          <button type="button" className={styles.retryBtn} onClick={() => load(1, { append: false })}>
            Retry
          </button>
        </div>
      )}

      {status !== 'error' && !isInitialLoad && displayItems.length === 0 && (
        <div className={styles.state}>
          <span>No results{(isEmoji ? query.trim() : debouncedQuery) ? ` for “${isEmoji ? query.trim() : debouncedQuery}”` : ''}.</span>
        </div>
      )}

      {!isEmoji && (
        <div className={styles.footer}>
          {hasNext && status !== 'error' && (
            <button
              type="button"
              className={styles.moreBtn}
              onClick={() => load(page + 1, { append: true })}
              disabled={status === 'loadingMore'}
            >
              {status === 'loadingMore' ? 'Loading…' : 'Load more'}
            </button>
          )}
          <span className={styles.attribution}>Powered by KLIPY</span>
        </div>
      )}
    </div>
  )
}
