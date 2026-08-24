// A stylised Lebanon, drawn straight in geographic coordinates.
//
// The viewBox is longitude by negative latitude, so every city below sits at
// its true position without a projection step or a map tile to download. It is
// a silhouette, not a survey — the coastline is simplified — but nothing on it
// is in the wrong place.

const OUTLINE = [
  // Coast, north to south
  [35.98, 34.63], [35.90, 34.60], [35.82, 34.50], [35.78, 34.44], [35.70, 34.35],
  [35.65, 34.22], [35.58, 34.10], [35.52, 33.98], [35.48, 33.88], [35.42, 33.75],
  [35.36, 33.62], [35.28, 33.48], [35.20, 33.35], [35.12, 33.20], [35.10, 33.09],
  // Southern border, west to east
  [35.30, 33.09], [35.42, 33.10], [35.55, 33.24], [35.62, 33.24], [35.72, 33.30],
  [35.83, 33.38], [35.90, 33.45],
  // Eastern border, south to north
  [36.02, 33.62], [36.30, 33.65], [36.42, 33.83], [36.30, 34.02], [36.40, 34.20],
  [36.44, 34.32], [36.36, 34.45], [36.20, 34.55], [36.08, 34.62],
] as const

const CITIES = [
  { name: 'Tripoli',  lng: 35.8497, lat: 34.4367, anchor: 'start' as const, dx: 0.045, dy: 0.018 },
  { name: 'Byblos',   lng: 35.6489, lat: 34.1211, anchor: 'end' as const,   dx: -0.04, dy: 0.018 },
  { name: 'Baalbek',  lng: 36.2181, lat: 34.0058, anchor: 'start' as const, dx: 0.045, dy: 0.018 },
  { name: 'Beirut',   lng: 35.5018, lat: 33.8938, anchor: 'end' as const,   dx: -0.045, dy: 0.018 },
  { name: 'Zahlé',    lng: 35.9019, lat: 33.8463, anchor: 'start' as const, dx: 0.045, dy: 0.018 },
  { name: 'Saida',    lng: 35.3714, lat: 33.5571, anchor: 'end' as const,   dx: -0.04, dy: 0.018 },
  { name: 'Nabatieh', lng: 35.4836, lat: 33.3789, anchor: 'start' as const, dx: 0.045, dy: 0.018 },
  { name: 'Tyre',     lng: 35.2038, lat: 33.2733, anchor: 'end' as const,   dx: -0.04, dy: 0.018 },
]

const path = `M ${OUTLINE.map(([lng, lat]) => `${lng} ${-lat}`).join(' L ')} Z`

export default function LebanonMap({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="35.0 -34.75 1.72 1.78"
      className={className}
      role="img"
      aria-label="Map of Lebanon showing Tripoli, Byblos, Baalbek, Beirut, Zahlé, Saida, Nabatieh and Tyre"
    >
      <defs>
        <linearGradient id="icl-land" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.30" />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.16" />
        </linearGradient>
        <filter id="icl-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.012" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={path}
        fill="url(#icl-land)"
        stroke="#818cf8"
        strokeOpacity="0.65"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {CITIES.map((c, i) => (
        <g key={c.name} transform={`translate(${c.lng} ${-c.lat})`}>
          <circle
            className="icl-ping"
            r="0.016"
            fill="#5eead4"
            style={{ animationDelay: `${i * 0.34}s` }}
          />
          <circle r="0.016" fill="#2dd4bf" filter="url(#icl-glow)" />
          <text
            x={c.dx}
            y={c.dy}
            textAnchor={c.anchor}
            fontSize="0.062"
            fill="#cbd5e1"
            style={{ fontWeight: 600, letterSpacing: '0.004em' }}
          >
            {c.name}
          </text>
        </g>
      ))}
    </svg>
  )
}
