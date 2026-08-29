// A stylised Lebanon, drawn straight in geographic coordinates.
//
// The viewBox is longitude by negative latitude, so every city below sits at
// its true position without a projection step or a map tile to download.
//
// The outline is a simplified silhouette rather than a survey, but it is
// simplified where the country is straight and detailed where it bends: the
// coast between Beirut and Tyre, and the eastern bulge around Baalbek, are
// what make the shape recognisable as Lebanon rather than as a blob.

const OUTLINE = [
  // Coast, Arida down to Naqoura. Denser through the middle, where the
  // shoreline actually bends, and sparser along the straighter stretches.
  [35.98, 34.63], [35.90, 34.61], [35.87, 34.52], [35.82, 34.46], [35.74, 34.42],
  [35.69, 34.35], [35.66, 34.28], [35.64, 34.20], [35.62, 34.12], [35.59, 34.04],
  [35.55, 33.98], [35.53, 33.92], [35.50, 33.87], [35.46, 33.80], [35.43, 33.72],
  [35.39, 33.64], [35.36, 33.56], [35.31, 33.46], [35.26, 33.38], [35.21, 33.29],
  [35.16, 33.20], [35.11, 33.09],
  // Southern border, west to east, up to the Hermon foothills.
  [35.25, 33.09], [35.36, 33.06], [35.45, 33.09], [35.51, 33.17], [35.55, 33.24],
  [35.63, 33.24], [35.72, 33.32], [35.82, 33.41],
  // Eastern border, south to north, following the Anti-Lebanon range and the
  // bulge around Baalbek before it narrows again into Akkar.
  [35.90, 33.50], [36.00, 33.62], [36.15, 33.72], [36.30, 33.83], [36.38, 33.92],
  [36.33, 34.02], [36.31, 34.10], [36.36, 34.20], [36.44, 34.30], [36.40, 34.42],
  [36.30, 34.50], [36.18, 34.58], [36.06, 34.63],
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
