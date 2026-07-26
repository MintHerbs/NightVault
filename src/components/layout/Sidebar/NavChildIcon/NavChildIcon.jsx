/**
 * NavChildIcon - Child navigation icon with SVG or Lucide icon support
 * 
 * Displays either SVG-based icons (iconOff/iconOn) or a Lucide icon.
 * Shows inactive state at reduced opacity, full opacity on hover/active.
 * Active state applies color tinting via activeColor prop.
 * Hover state applies color tinting via hoverColor prop.
 * Tooltip appears on hover to the right of the icon.
 * 
 * @param {Object} props
 * @param {string} [props.iconOff] - Path to off-state SVG (optional if using lucideIcon)
 * @param {string} [props.iconOn] - Path to on-state SVG (optional if using lucideIcon)
 * @param {React.ReactNode} [props.lucideIcon] - Lucide icon component (optional if using SVG paths)
 * @param {string} props.tooltip - Tooltip text to display on hover
 * @param {boolean} props.isActive - Whether this icon is currently active
 * @param {string} [props.activeColor='#ffa31a'] - Color to apply when active
 * @param {string} [props.hoverColor] - Color to apply on hover (defaults to activeColor)
 * @param {Function} props.onClick - Click handler callback
 */
import { useState } from 'react'
import styles from './NavChildIcon.module.css'

export default function NavChildIcon({
  iconOff,
  iconOn,
  iconHover,
  lucideIcon,
  tooltip,
  isActive,
  activeColor = '#ffa31a',
  hoverColor,
  onClick
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Use hoverColor if provided, otherwise use activeColor
  const effectiveHoverColor = hoverColor || activeColor
  
  // Determine which icon to show
  const shouldShowActive = isActive
  const shouldShowHover = isHovered && !isActive
  
  // Determine opacity: full when active or hovered, reduced otherwise
  const opacity = shouldShowActive || shouldShowHover ? 1.0 : 0.5

  // Render SVG-based icon
  if (iconOff && iconOn) {
    let currentIcon = iconOff
    if (shouldShowActive) {
      currentIcon = iconOn
    } else if (shouldShowHover && iconHover) {
      currentIcon = iconHover
    }
    
    return (
      <div 
        className={styles.iconContainer}
        style={{ opacity }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img 
          src={currentIcon} 
          alt={tooltip}
          className={styles.icon}
          style={isActive ? { filter: `brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(236deg) brightness(118%) contrast(119%)` } : {}}
        />
        
        {isHovered && (
          <div className={styles.tooltip}>
            {tooltip}
          </div>
        )}
      </div>
    )
  }

  // Render Lucide icon
  if (lucideIcon) {
    // Determine color: active uses activeColor, hover uses hoverColor, inactive uses grey
    let iconColor = '#555555'
    if (isActive) {
      iconColor = activeColor
    } else if (isHovered) {
      iconColor = effectiveHoverColor
    }
    
    return (
      <div 
        className={styles.iconContainer}
        style={{ opacity }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className={styles.lucideIconWrapper}
          style={{ color: iconColor }}
        >
          {lucideIcon}
        </div>
        
        {isHovered && (
          <div className={styles.tooltip}>
            {tooltip}
          </div>
        )}
      </div>
    )
  }

  return null
}
