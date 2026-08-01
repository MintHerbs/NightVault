/**
 * SandboxControls - the transport dock (T-089 phase 2, reshaped in T-093).
 *
 * Floats over the top-left corner of the canvas rather than sitting in a row
 * above it, which is the FigJam shape the owner asked for: the canvas is the
 * page, and every control is a thing on top of it.
 *
 * Everything that acts on the circuit as a whole lives here — leave, run, step,
 * reset, undo, redo, delete, timing — because splitting them across a navbar and
 * a toolbar is what gave the sandbox four bands of chrome.
 *
 * T-093 dropped the speed control ("the free run is 2 Hz, and picking a
 * frequency was a question nobody asked"). Reinstated by later owner request:
 * free run now visibly pulses the clock rather than completing a full edge
 * between renders, and once a clock actually blinks, how fast it blinks is a
 * real question again.
 *
 * Deliberately not LogicStepControls. That bar drives a pre-computed steps[]
 * array and knows about "at the end"; this one drives real time and has no end,
 * so sharing it would mean adding a mode to a component another tool owns.
 */
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  SkipForward,
  Trash2,
  Undo2,
} from 'lucide-react'
import { IconButton, md } from '../md'
import styles from './SandboxControls.module.css'

// The pulse interval free run toggles the clock at. Values in ms; labelled in
// seconds since that is how the owner asked for it ("each second").
export const PULSE_PRESETS = [250, 500, 1000, 2000, 4000]
export const DEFAULT_PULSE_MS = 1000

const pulseLabel = (ms) => (ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`)

export default function SandboxControls({
  onBack,
  running,
  onToggleRun,
  onStep,
  onReset,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onDelete,
  canDelete,
  unstable,
  invalid,
  waveformOpen,
  onToggleWaveform,
  pulseMs = DEFAULT_PULSE_MS,
  onPulseMsChange,
}) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Circuit controls">
      {onBack && (
        <>
          <IconButton label="Back to the Digital Logic Lab" onClick={onBack}>
            <ArrowLeft size={20} aria-hidden="true" />
          </IconButton>
          <span className={styles.divider} aria-hidden="true" />
        </>
      )}

      <IconButton
        variant="filled"
        label={running ? 'Pause' : 'Run'}
        onClick={onToggleRun}
        aria-pressed={running}
      >
        {running ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
      </IconButton>

      <IconButton label="Step one clock cycle" onClick={onStep} disabled={running}>
        <SkipForward size={20} aria-hidden="true" />
      </IconButton>

      <IconButton label="Reset every flip-flop" onClick={onReset}>
        <RotateCcw size={20} aria-hidden="true" />
      </IconButton>

      {onPulseMsChange && (
        <select
          className={styles.pulseRate}
          aria-label="Pulse rate while running"
          title="Pulse rate while running"
          value={pulseMs}
          onChange={(event) => onPulseMsChange(Number(event.target.value))}
        >
          {PULSE_PRESETS.map((ms) => (
            <option key={ms} value={ms}>{pulseLabel(ms)}</option>
          ))}
        </select>
      )}

      <span className={styles.divider} aria-hidden="true" />

      <IconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={20} aria-hidden="true" />
      </IconButton>

      <IconButton label="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={20} aria-hidden="true" />
      </IconButton>

      <IconButton label="Delete selected" onClick={onDelete} disabled={!canDelete}>
        <Trash2 size={20} aria-hidden="true" />
      </IconButton>

      {onToggleWaveform && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <IconButton
            variant={waveformOpen ? 'tonal' : 'standard'}
            label="Timing diagram"
            onClick={onToggleWaveform}
            aria-expanded={waveformOpen}
          >
            <Activity size={20} aria-hidden="true" />
          </IconButton>
        </>
      )}

      {/* Only two states are worth interrupting for, and both mean the circuit
          is telling the truth about something the student built. */}
      {(unstable || invalid) && (
        <p className={`${styles.alert} ${md.bodySmall}`} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          {unstable
            ? 'Never settles — there is a feedback loop that keeps flipping.'
            : 'A flip-flop is in its forbidden input state.'}
        </p>
      )}
    </div>
  )
}
