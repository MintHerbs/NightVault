// Renders a single B+ tree node with alternating pointer slots and key slots
import styles from './TreeNode.module.css'
import { getNodeSlots } from '../../../../lib/treeLayout'

// Corner radius for the node shell. The slot rects tile the full width, so they
// are clipped to this same rounded shape — otherwise their square corners fill
// the rounded ones back in and the node reads as a plain rectangle.
const RADIUS = 10

function TreeNode({ node, mark = null, hoveredKey = null, onKeyEnter, onKeyLeave }) {
  const { id, x, y, keys, width, height, isLeaf, keySlotWidths = [] } = node

  // Get slot layout for this node
  const slots = getNodeSlots(keys.length, keySlotWidths)

  // `mark` is the current step's highlight, already narrowed to this node by the
  // canvas. Keys are only marked inside marked nodes: the same value can sit in a
  // leaf as a record and higher up as a separator copy, and lighting both would
  // claim the tree stores it twice.
  const intent = mark?.intent ?? null
  const markedKeys = mark?.keys ?? null

  const clipId = `btree-node-clip-${id}`

  return (
    <g
      className={styles.node}
      data-intent={intent || undefined}
      data-pulse={mark?.pulse ? '' : undefined}
      // Positioned via the CSS transform property rather than the SVG transform
      // attribute so it can be transitioned: nodes glide to their new places when
      // a split or merge reshapes the level instead of teleporting between steps.
      style={{ transform: `translate(${x - width / 2}px, ${y - height / 2}px)` }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={width} height={height} rx={RADIUS} />
        </clipPath>
      </defs>

      {/* Shell fill and its glow. Separate from the border so the border can be
          stroked over the slots without the glow being clipped away with them. */}
      <rect className={styles.nodeBack} width={width} height={height} rx={RADIUS} />

      <g clipPath={`url(#${clipId})`}>
        {slots.map((slot, index) => {
          if (slot.type === 'pointer') {
            return (
              <rect
                key={`slot-${index}`}
                className={styles.pointerSlot}
                x={slot.x}
                y={0}
                width={slot.width}
                height={height}
              />
            )
          }

          const keyValue = keys[slot.keyIndex]
          const isMarked = markedKeys?.some(
            (k) => String(k).toLowerCase() === String(keyValue).toLowerCase()
          )
          const isHovered =
            hoveredKey?.nodeId === id && hoveredKey?.keyIndex === slot.keyIndex

          return (
            <g
              key={`slot-${index}`}
              className={styles.keyGroup}
              data-marked={isMarked ? '' : undefined}
              onMouseEnter={
                onKeyEnter
                  ? () =>
                      onKeyEnter({
                        nodeId: id,
                        keyIndex: slot.keyIndex,
                        keyValue,
                        isLeaf,
                        // Centre of this slot in the node's own space; the canvas
                        // adds the node offset and maps it to screen coordinates.
                        localX: slot.x + slot.width / 2,
                        nodeX: x - width / 2,
                        nodeY: y - height / 2,
                        height
                      })
                  : undefined
              }
              onMouseLeave={onKeyLeave}
            >
              <rect
                className={styles.keySlot}
                x={slot.x}
                y={0}
                width={slot.width}
                height={height}
              />
              {/* Inset chip, so a marked key reads as a filled token rather than
                  just recoloured text at 14px. */}
              {(isMarked || isHovered) && (
                <rect
                  className={isMarked ? styles.keyChip : styles.keyChipHover}
                  x={slot.x + 3}
                  y={5}
                  width={slot.width - 6}
                  height={height - 10}
                  rx={6}
                />
              )}
              <text
                className={styles.keyText}
                x={slot.x + slot.width / 2}
                y={height / 2}
              >
                {keyValue}
              </text>
            </g>
          )
        })}
      </g>

      <rect className={styles.nodeBorder} width={width} height={height} rx={RADIUS} />

      {/* Leaf indicator (optional visual cue) */}
      {isLeaf && (
        <text className={styles.leafLabel} x={width / 2} y={height + 16}>
          leaf
        </text>
      )}
    </g>
  )
}

export default TreeNode
