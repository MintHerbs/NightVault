import { useState, useEffect } from 'react'
import { X, Link as LinkIcon } from '@phosphor-icons/react'
import { isSafeUrl } from '../../lib/url'
import { extractYouTubeId, youtubeThumbnailSrc } from '../../lib/youtube'
import styles from './SocialLinkModal.module.css'

function escapeAttr(value) {
  return value.replace(/"/g, '\\"')
}

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: '#E4405F' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', color: '#0A66C2' },
]

export default function SocialLinkModal({ open, onClose, onInsert, onInsertVideo }) {
  const [platform, setPlatform] = useState('youtube')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meta, setMeta] = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [urlError, setUrlError] = useState('')

  // YouTube gets a playable embed (T-055), not the static link chip — no
  // Title/Description/etc. needed, the video ID is enough to render it.
  const isVideoEmbed = platform === 'youtube'
  const videoId = isVideoEmbed ? extractYouTubeId(url.trim()) : null

  useEffect(() => {
    if (!open) {
      setPlatform('youtube')
      setUrl('')
      setTitle('')
      setDescription('')
      setMeta('')
      setActionLabel('')
      setUrlError('')
    } else {
      // Set default action labels based on platform
      if (platform === 'youtube') {
        setActionLabel('Watch video')
      } else if (platform === 'instagram') {
        setActionLabel('View profile')
      } else if (platform === 'linkedin') {
        setActionLabel('Connect')
      }
    }
  }, [open, platform])

  const handleInsert = () => {
    if (!url.trim()) return

    if (!isSafeUrl(url.trim())) {
      setUrlError('Enter a valid http(s):// or mailto: link')
      return
    }

    if (isVideoEmbed) {
      if (!videoId) {
        setUrlError('Enter a valid YouTube video link')
        return
      }
      onInsertVideo(videoId)
      onClose()
      return
    }

    if (!title.trim()) return

    // Generate the rich popover markdown syntax
    const richPopover = `<RichPopover
  platform="${platform}"
  href="${escapeAttr(url)}"
  title="${escapeAttr(title)}"
  ${description ? `description="${escapeAttr(description)}"` : ''}
  ${meta ? `meta="${escapeAttr(meta)}"` : ''}
  ${actionLabel ? `actionLabel="${escapeAttr(actionLabel)}"` : ''}
/>`

    onInsert(richPopover)
    onClose()
  }

  if (!open) return null

  const selectedPlatform = PLATFORMS.find(p => p.id === platform)

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Insert Social Link</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Platform</label>
            <div className={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  className={`${styles.platformButton} ${platform === p.id ? styles.active : ''}`}
                  onClick={() => setPlatform(p.id)}
                  type="button"
                >
                  <span className={styles.platformIcon}>{p.icon}</span>
                  <span className={styles.platformLabel}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>URL *</label>
            <input
              type="url"
              className={styles.input}
              placeholder={`https://${platform}.com/...`}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (urlError) setUrlError('')
              }}
              required
            />
            {urlError && <div className={styles.errorText}>{urlError}</div>}
          </div>

          {isVideoEmbed ? (
            videoId && (
              <div className={styles.preview}>
                <div className={styles.previewLabel}>Preview:</div>
                <img
                  className={styles.videoPreviewThumb}
                  src={youtubeThumbnailSrc(videoId)}
                  alt="Video thumbnail preview"
                />
              </div>
            )
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., My YouTube Channel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Brief description of the link..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Meta (optional)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g., 1.2M followers"
                    value={meta}
                    onChange={(e) => setMeta(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Action Label (optional)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g., Watch now"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.preview}>
                <div className={styles.previewLabel}>Preview:</div>
                <div className={styles.previewBox}>
                  <div className={styles.previewPlatform} style={{ backgroundColor: selectedPlatform?.color }}>
                    {selectedPlatform?.icon}
                  </div>
                  <div className={styles.previewContent}>
                    <div className={styles.previewTitle}>{title || 'Title'}</div>
                    {description && <div className={styles.previewDescription}>{description}</div>}
                    <div className={styles.previewMeta}>
                      {meta && <span className={styles.previewMetaText}>{meta}</span>}
                      {actionLabel && <span className={styles.previewAction}>{actionLabel}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.insertButton}
            onClick={handleInsert}
            disabled={isVideoEmbed ? !url.trim() : !url.trim() || !title.trim()}
          >
            {isVideoEmbed ? 'Insert Video' : 'Insert Link'}
          </button>
        </div>
      </div>
    </>
  )
}
