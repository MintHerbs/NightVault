/**
 * GatePalette - the parts dock (T-089 phase 2, reshaped in T-095 and T-096).
 *
 * A floating icon strip along the bottom of the canvas, the way FigJam docks its
 * shape tools. T-095 had it as a full-width labelled toolbar above the canvas;
 * that is a band of chrome in the one mode whose whole point is canvas.
 *
 * Icon-only, because for the gates the icon *is* the label — the silhouette is
 * the thing the student has to learn to read, and a word next to it is the
 * crutch that stops them. Every button still carries its name as a tooltip and
 * as its accessible name.
 *
 * Two ways to place, and both had to exist:
 *
 *  - **click** — lands at the next free spot the model finds. Works from the
 *    keyboard, works on a touchscreen, and is the fast path for laying out a
 *    row of inputs.
 *  - **drag** — lands where you drop it. This is the gesture anyone who has used
 *    a diagram editor reaches for first, and its absence was why the toolbar
 *    read as a list rather than a palette.
 */
import { PALETTE } from '../../../../lib/circuits/sandboxModel'
import GateIcon from '../GateIcon/GateIcon'
import styles from './GatePalette.module.css'

export default function GatePalette({ onPlace, onCarryStart }) {
  return (
    <div className={styles.dock} role="toolbar" aria-label="Components">
      {PALETTE.map((group, index) => (
        <div key={group.group} className={styles.group}>
          {index > 0 && <span className={styles.divider} aria-hidden="true" />}
          {group.items.map(item => (
            <button
              key={item.kind}
              type="button"
              className={styles.item}
              onClick={() => onPlace(item.kind)}
              // Left button only: a right-click on the dock should reach the
              // browser menu, not start a placement that never finishes.
              onPointerDown={(event) => {
                if (event.button !== 0) return
                onCarryStart?.(item.kind, event)
              }}
              title={`${item.label}${item.hint ? ` — ${item.hint}` : ''}`}
              aria-label={`Place ${item.label}`}
            >
              <GateIcon kind={item.kind} size={24} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
