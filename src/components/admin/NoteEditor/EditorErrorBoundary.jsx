import { Component } from 'react'
import { Warning } from '@phosphor-icons/react'
import styles from './EditorErrorBoundary.module.css'

// Nothing above NoteEditor caught render-phase exceptions, so any of them —
// KaTeX throwing on a malformed formula (see the throwOnError guard in
// NoteEditor.jsx), a third-party editor plugin bug, anything — unmounted the
// entire admin app. This is the last line of defence: it can't repair the
// note, but it keeps the rest of the admin UI (navbar, route) alive instead
// of a blank screen with only a console trace.
export default class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('NoteEditor crashed:', error, info.componentStack)
  }

  // Without this, switching to a different (perfectly fine) note wouldn't
  // recover — NoteEditor is never remounted on note switch, only `resetKey`
  // (the route params) changes, so the boundary must clear itself explicitly.
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.fallback}>
          <Warning size={32} weight="bold" className={styles.icon} />
          <p className={styles.title}>This note couldn't be displayed</p>
          <p className={styles.detail}>
            Its content likely has a malformed formula. Reloading won't fix the
            note itself, but you can then edit its Markdown to correct it.
          </p>
          <button
            type="button"
            className={styles.reload}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
