/**
 * NavGroupIcon - Primary parent navigation icon with open/close state
 * 
 * Displays a group icon (Lucide or SVG) that toggles a navigation group.
 * When open, icon color changes to orange (var(--color-accent-alt)) and a horizontal line
 * appears below the icon as a visual indicator.
 * Tooltip appears on hover to the right of the icon.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon to display (Lucide icon or SVG img element)
 * @param {string} props.label - Tooltip text to display on hover
 * @param {boolean} props.isOpen - Whether this group is currently open
 * @param {Function} props.onClick - Click handler callback
 */
import { useState } from 'react'
import styles from './NavGroupIcon.module.css'

export default function NavGroupIcon({
  icon,
  label,
  isOpen,
  onClick
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Determine opacity and color based on open state
  const opacity = isOpen ? 1.0 : 0.5
  const iconColor = isOpen ? 'var(--color-accent-alt)' : '#555555'

  // Check if icon is an img element (SVG file) vs Lucide icon
  const isImgElement = icon?.type === 'img'

  return (
    <div className={styles.groupIconContainer}>
      <div 
        className={styles.iconContainer}
        style={{ opacity }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className={styles.iconWrapper}
          style={isImgElement ? {} : { color: iconColor }}
        >
          {icon}
        </div>
        
        {isHovered && (
          <div className={styles.tooltip}>
            {label}
          </div>
        )}
      </div>

      {/* Active indicator line - shows when group is open */}
      {isOpen && (
        <div className={styles.activeLine} />
      )}
    </div>
  )
}
