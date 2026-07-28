import { forwardRef } from 'react'
import NoteEditor from './NoteEditor'
import EditorErrorBoundary from './EditorErrorBoundary'

// Wrapped here (rather than at each call site) so every consumer of this
// module gets the crash containment for free — see EditorErrorBoundary.
// `resetKey` identifies the open note (NoteEditor itself never remounts on
// note switch — content is pushed in via prop/effect — so without this the
// boundary would keep showing the first note's crash forever, even after
// navigating to an unrelated, perfectly fine note).
export default forwardRef(function NoteEditorWithBoundary({ resetKey, ...props }, ref) {
  return (
    <EditorErrorBoundary resetKey={resetKey}>
      <NoteEditor {...props} ref={ref} />
    </EditorErrorBoundary>
  )
})
