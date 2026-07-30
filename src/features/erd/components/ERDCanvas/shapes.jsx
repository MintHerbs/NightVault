// Pure SVG shape functions for Chen notation ERD elements — textbook colour scheme

export function EntityRectangle({ x, y, width, height, label }) {
  return (
    <g>
      <rect x={x - width / 2} y={y - height / 2} width={width} height={height}
        fill="#0e7490" stroke="#67e8f9" strokeWidth="1.5" rx="3" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function WeakEntityRectangle({ x, y, width, height, label }) {
  return (
    <g>
      <rect x={x - width / 2} y={y - height / 2} width={width} height={height}
        fill="#0e7490" stroke="#67e8f9" strokeWidth="1.5" rx="3" />
      <rect x={x - width / 2 + 4} y={y - height / 2 + 4} width={width - 8} height={height - 8}
        fill="none" stroke="#67e8f9" strokeWidth="1" rx="2" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function AttributeEllipse({ x, y, width, height, label }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2}
        fill="#7a4300" stroke="#ffd08a" strokeWidth="1.5" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function KeyAttributeEllipse({ x, y, width, height, label }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2}
        fill="#7a4300" stroke="#ffd08a" strokeWidth="1.5" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle" textDecoration="underline">{label}</text>
    </g>
  )
}

export function PartialKeyAttributeEllipse({ x, y, width, height, label }) {
  const textW = label.length * 6.5
  return (
    <g>
      <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2}
        fill="#7a4300" stroke="#ffd08a" strokeWidth="1.5" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
      <line x1={x - textW / 2} y1={y + 7} x2={x + textW / 2} y2={y + 7}
        stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" />
    </g>
  )
}

export function MultiValuedAttributeEllipse({ x, y, width, height, label }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2}
        fill="#7a4300" stroke="#ffd08a" strokeWidth="1.5" />
      <ellipse cx={x} cy={y} rx={width / 2 - 3} ry={height / 2 - 3}
        fill="none" stroke="#ffd08a" strokeWidth="1" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function DerivedAttributeEllipse({ x, y, width, height, label }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2}
        fill="#7a4300" stroke="#ffd08a" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function RelationshipDiamond({ x, y, width, height, label }) {
  const hw = width / 2, hh = height / 2
  const points = `${x},${y - hh} ${x + hw},${y} ${x},${y + hh} ${x - hw},${y}`
  return (
    <g>
      <polygon points={points} fill="#92400e" stroke="#fcd34d" strokeWidth="1.5" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

export function IdentifyingRelationshipDiamond({ x, y, width, height, label }) {
  const hw = width / 2, hh = height / 2
  const inset = 5
  const outer = `${x},${y - hh} ${x + hw},${y} ${x},${y + hh} ${x - hw},${y}`
  const inner = `${x},${y - hh + inset} ${x + hw - inset},${y} ${x},${y + hh - inset} ${x - hw + inset},${y}`
  return (
    <g>
      <polygon points={outer} fill="#92400e" stroke="#fcd34d" strokeWidth="1.5" />
      <polygon points={inner} fill="none" stroke="#fcd34d" strokeWidth="1" />
      <text x={x} y={y} fill="#ffffff" fontSize="13" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

// Both orientations are in common textbook use for the same hierarchy. Upright
// points the apex at the superclass; inverted meets it with the flat edge.
// The label sits toward the wide end so it stays inside the shape.
export function IsATriangle({ x, y, width, height, label, orientation = 'upright' }) {
  const hw = width / 2
  const hh = height / 2
  const inverted = orientation === 'inverted'

  const points = inverted
    ? `${x - hw},${y - hh} ${x + hw},${y - hh} ${x},${y + hh}`
    : `${x},${y - hh} ${x + hw},${y + hh} ${x - hw},${y + hh}`

  return (
    <g>
      <polygon points={points} fill="#065f46" stroke="#6ee7b7" strokeWidth="1.5" />
      <text x={x} y={inverted ? y - 6 : y + 6} fill="#ffffff" fontSize="12" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}
