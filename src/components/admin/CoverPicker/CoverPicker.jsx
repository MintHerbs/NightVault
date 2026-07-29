// CoverPicker — choose a course card's ASCII cover animation (T-077).
//
// Two ways in: pick one of the named presets, or upload an image and have it
// converted to character art in the browser (src/lib/asciiArt/imageToAscii.js).
// Every option previews live using the same AsciiCanvas the real card renders
// with, so what's shown here is what ships — no separate preview path to drift.
import { useMemo, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Trash, UploadSimple } from '@phosphor-icons/react'
import AsciiCanvas from '../../ui/AsciiCard/AsciiCanvas'
import { COVER_PRESETS, resolveCoverField } from '../../../constants/coverPresets'
import { makeBitmapField, invertGrid, BITMAP_ANIMATION_KEYS } from '../../../lib/asciiArt/bitmapField'
import { imageToAsciiGrid } from '../../../lib/asciiArt/imageToAscii'
import { setCourseCover } from '../../../lib/coursesApi'
import styles from './CoverPicker.module.css'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export default function CoverPicker({ course, onClose, onSaved, showToast }) {
  // Local draft: either a preset key or an uploaded grid, never both — the
  // same exclusivity setCourseCover enforces when it writes.
  const [preset, setPreset] = useState(course.coverAscii ? null : course.coverPreset ?? null)
  const [ascii, setAscii] = useState(course.coverAscii ?? null)
  const [anim, setAnim] = useState(course.coverAnim ?? 'scanline')
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // What the card would look like right now, through the same resolver the
  // live card uses — so "no choice yet" previews the hashed default rather
  // than a blank box.
  const previewField = useMemo(
    () => (ascii
      ? makeBitmapField(ascii, { animation: anim })
      : resolveCoverField({ ...course, coverPreset: preset, coverAscii: null })),
    [ascii, anim, preset, course],
  )

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so re-picking the same file fires change again
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('That file isn\'t an image', 'error')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast('Image is too large (max 12 MB)', 'error')
      return
    }
    setConverting(true)
    try {
      const grid = await imageToAsciiGrid(file, { invert: false })
      setAscii(grid)
      setPreset(null)
    } catch (error) {
      showToast(`Couldn't convert that image: ${error.message}`, 'error')
    } finally {
      setConverting(false)
    }
  }

  // Re-run the conversion from the original file isn't possible once it's
  // dropped, so invert flips the stored grid's ramp in place instead.
  const invert = () => setAscii((grid) => (grid ? invertGrid(grid) : grid))

  const save = async () => {
    setSaving(true)
    try {
      await setCourseCover(course.id, { preset, ascii, anim })
      onSaved({
        ...course,
        coverPreset: ascii ? null : preset,
        coverAscii: ascii,
        coverAnim: ascii ? anim : null,
      })
      showToast('Cover updated', 'success')
      onClose()
    } catch (error) {
      showToast(`Failed to save cover: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const clear = () => {
    setPreset(null)
    setAscii(null)
  }

  return (
    <Popover.Root open onOpenChange={(open) => !open && onClose()}>
      <Popover.Anchor className={styles.topAnchor} />
      <Popover.Portal>
        <Popover.Content
          className={styles.panel}
          align="center"
          sideOffset={0}
          collisionPadding={16}
        >
          <div className={styles.header}>
            <h3 className={styles.title}>Cover for {course.name}</h3>
            <button className={styles.btnText} onClick={clear} title="Back to the automatic cover">
              Reset
            </button>
          </div>

          <div className={styles.previewRow}>
            <div className={styles.preview}>
              <AsciiCanvas field={previewField} />
            </div>
            <div className={styles.previewMeta}>
              <span className={styles.previewLabel}>
                {ascii ? 'Uploaded image' : preset ? presetLabel(preset) : 'Automatic'}
              </span>
              {ascii && (
                <>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Animation</span>
                    <select
                      className={styles.select}
                      value={anim}
                      onChange={(e) => setAnim(e.target.value)}
                    >
                      {BITMAP_ANIMATION_KEYS.map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                  <button className={styles.btnText} onClick={invert}>Invert</button>
                  <button className={styles.btnText} onClick={() => setAscii(null)}>
                    <Trash size={14} weight="bold" /> Remove image
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            className={styles.uploadButton}
            onClick={() => fileRef.current?.click()}
            disabled={converting}
          >
            <UploadSimple size={16} weight="bold" />
            {converting ? 'Converting…' : 'Upload an image'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={onFile}
          />

          <div className={styles.presetsLabel}>Or pick a preset</div>
          <div className={styles.presetGrid}>
            {COVER_PRESETS.map((p) => (
              <button
                key={p.key}
                className={`${styles.presetCell} ${!ascii && preset === p.key ? styles.presetActive : ''}`}
                onClick={() => { setPreset(p.key); setAscii(null) }}
                title={p.label}
              >
                <span className={styles.presetCanvas}>
                  <AsciiCanvas field={p.field} cols={26} />
                </span>
                <span className={styles.presetName}>{p.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <button className={styles.btnText} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={save} disabled={saving || converting}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function presetLabel(key) {
  return COVER_PRESETS.find((p) => p.key === key)?.label ?? 'Preset'
}
