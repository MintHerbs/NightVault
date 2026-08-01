// The four attachment states the composer can be in, each wrapped in the same
// tray. Split out of PostComposer so that file stays about composer state
// rather than about which panel is open.
import { AnimatePresence } from 'motion/react'
import { BarChart3, CheckCircle2, Code2, ImagePlay } from 'lucide-react'
import AttachmentTray from '../AttachmentTray/AttachmentTray'
import PollBuilder from '../PollBuilder/PollBuilder'
import CodeAttachment from '../CodeAttachment/CodeAttachment'
import MediaPicker from '../../../ui/MediaPicker/MediaPicker'
import styles from './ComposerAttachments.module.css'

export default function ComposerAttachments({
  activeFeature,
  poll,
  code,
  codeLanguage,
  gif,
  onPollChange,
  onCodeChange,
  onGifChange,
  onClearFeature,
}) {
  return (
    <AnimatePresence mode="wait">
      {activeFeature === 'poll' && poll && (
        <AttachmentTray
          key="poll"
          icon={poll.type === 'binary' ? CheckCircle2 : BarChart3}
          label={poll.type === 'binary' ? 'Yes / no vote' : 'Poll'}
          onRemove={() => {
            onPollChange(null)
            onClearFeature()
          }}
        >
          <PollBuilder poll={poll} onChange={onPollChange} />
        </AttachmentTray>
      )}

      {activeFeature === 'code' && (
        <AttachmentTray
          key="code"
          icon={Code2}
          label="Code snippet"
          onRemove={() => {
            onCodeChange(null, 'auto')
            onClearFeature()
          }}
        >
          <CodeAttachment code={code || ''} language={codeLanguage} onChange={onCodeChange} />
        </AttachmentTray>
      )}

      {/* Picking and previewing are two trays, not one panel with a preview
          stuck underneath it: once a GIF is chosen the browser is noise. */}
      {activeFeature === 'gif' && !gif && (
        <AttachmentTray
          key="gif-picker"
          icon={ImagePlay}
          label="GIF or sticker"
          onRemove={onClearFeature}
        >
          <MediaPicker
            onSelect={(item) => {
              onGifChange({ previewUrl: item.previewUrl, fullUrl: item.fullUrl })
              onClearFeature()
            }}
            onClose={onClearFeature}
          />
        </AttachmentTray>
      )}

      {gif && (
        <AttachmentTray
          key="gif-preview"
          icon={ImagePlay}
          label="GIF or sticker"
          onRemove={() => {
            onGifChange(null)
            // This preview renders regardless of which tray is open (a poll
            // or code tray can be open at the same time as a GIF is
            // attached), so only close the tray here if it is this one —
            // otherwise removing the GIF would also collapse an unrelated
            // open tray.
            if (activeFeature === 'gif') onClearFeature()
          }}
        >
          <img className={styles.preview} src={gif.previewUrl} alt="Selected GIF" />
        </AttachmentTray>
      )}
    </AnimatePresence>
  )
}
