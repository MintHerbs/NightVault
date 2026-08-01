// Attachment state for PostComposer: which tray is open, and the poll / code
// / GIF each one holds. Split out so PostComposer stays about the text, the
// posting call and the error, and stays under the 200-line rule in
// docs/design.md.
import { useCallback, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Code2, ImagePlay } from 'lucide-react'
import { detectCodeLanguage, normalizeLanguage } from '../lib/social/codeHighlighter'

export default function useComposerAttachments({ onOpen } = {}) {
  const [activeFeature, setActiveFeature] = useState(null)
  const [poll, setPoll] = useState(null)
  const [code, setCode] = useState(null)
  const [codeLanguage, setCodeLanguage] = useState('auto')
  const [gif, setGif] = useState(null)

  const open = useCallback(
    (key) => {
      setActiveFeature(key)
      onOpen?.()
    },
    [onOpen]
  )

  const clearFeature = useCallback(() => setActiveFeature(null), [])

  /** Both poll chips share one tray, so re-pressing the chip matching the
      attached poll's type clears it — regardless of which tray is currently
      open, matching the chips' own "attached" indicator below. */
  const togglePoll = useCallback(
    (type) => {
      const isBinary = type === 'binary'
      if (poll && (poll.type === 'binary') === isBinary) {
        setActiveFeature(null)
        setPoll(null)
        return
      }
      open('poll')
      setPoll(isBinary ? { type: 'binary', options: ['Yes', 'No'] } : { type: 'poll', options: ['', ''] })
    },
    [open, poll]
  )

  const toggleCode = useCallback(() => {
    if (activeFeature === 'code') {
      setActiveFeature(null)
      return
    }
    open('code')
    setCode((prev) => (prev == null ? '' : prev))
  }, [activeFeature, open])

  const toggleGif = useCallback(() => {
    if (activeFeature === 'gif') {
      setActiveFeature(null)
      return
    }
    open('gif')
  }, [activeFeature, open])

  const changeCode = useCallback((nextCode, lang) => {
    setCode(nextCode)
    setCodeLanguage(lang)
  }, [])

  const reset = useCallback(() => {
    setActiveFeature(null)
    setPoll(null)
    setCode(null)
    setCodeLanguage('auto')
    setGif(null)
  }, [])

  const features = useMemo(
    () => [
      {
        key: 'vote',
        icon: CheckCircle2,
        label: 'Vote',
        hint: 'Attach a yes / no vote',
        active: poll?.type === 'binary',
        onClick: () => togglePoll('binary'),
      },
      {
        key: 'poll',
        icon: BarChart3,
        label: 'Poll',
        hint: 'Attach a multi-option poll',
        active: poll != null && poll.type !== 'binary',
        onClick: () => togglePoll('poll'),
      },
      {
        key: 'code',
        icon: Code2,
        label: 'Code',
        hint: 'Attach a code snippet',
        active: activeFeature === 'code' || code != null,
        onClick: toggleCode,
      },
      {
        key: 'gif',
        icon: ImagePlay,
        label: 'GIF',
        hint: 'Attach a GIF or sticker',
        active: activeFeature === 'gif' || !!gif,
        onClick: toggleGif,
      },
    ],
    [activeFeature, code, gif, poll?.type, toggleCode, toggleGif, togglePoll]
  )

  /** The attachment half of the createPost payload, language already resolved. */
  const buildPayload = useCallback(() => {
    const normalized = normalizeLanguage(codeLanguage)
    return {
      code: code ? String(code) : undefined,
      codeLanguage: code
        ? normalized === 'auto'
          ? detectCodeLanguage(code)
          : normalized
        : undefined,
      poll: poll || undefined,
      gifUrl: gif?.fullUrl || undefined,
    }
  }, [code, codeLanguage, gif, poll])

  return {
    activeFeature,
    poll,
    code,
    codeLanguage,
    gif,
    features,
    hasAttachment: !!poll || code != null || !!gif,
    setPoll,
    setGif,
    changeCode,
    clearFeature,
    reset,
    buildPayload,
  }
}
