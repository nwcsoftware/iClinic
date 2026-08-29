// Lebanon, drawn straight in geographic coordinates.
//
// The viewBox is longitude by negative latitude, so the border and the cities
// share one space and both land where they belong without a projection step,
// a map tile, or a request to anyone at load time.

// Lebanon's actual border, from geoBoundaries ADM0 (public domain), reduced
// with Douglas-Peucker at a 0.004 degree tolerance. At the size this renders,
// one pixel is roughly 0.0036 degrees, so the discarded detail is smaller than
// anything that could be drawn — 602 source points become 232 for 3.3KB, and
// the shape is the real one rather than a good guess.
//
// Coordinates are longitude and negative latitude, which is the viewBox's own
// space, so no projection step is needed and the cities below land on their
// true positions.
const BORDER = "M36.384 -34.632L36.353 -34.655L36.347 -34.663L36.353 -34.68L36.335 -34.693L36.307 -34.68L36.3 -34.664L36.306 -34.655L36.296 -34.636L36.265 -34.627L36.244 -34.634L36.225 -34.626L36.19 -34.637L36.172 -34.627L36.124 -34.643L36.093 -34.63L36.081 -34.635L36.074 -34.629L36.063 -34.636L36.052 -34.628L36.037 -34.629L36.007 -34.646L35.982 -34.651L35.975 -34.631L35.991 -34.59L35.991 -34.548L35.982 -34.524L35.945 -34.509L35.907 -34.47L35.853 -34.457L35.809 -34.457L35.805 -34.449L35.808 -34.431L35.818 -34.422L35.815 -34.407L35.775 -34.385L35.738 -34.377L35.714 -34.307L35.705 -34.305L35.69 -34.314L35.677 -34.309L35.655 -34.276L35.661 -34.24L35.651 -34.215L35.635 -34.196L35.634 -34.162L35.626 -34.148L35.641 -34.134L35.642 -34.121L35.65 -34.113L35.65 -34.088L35.622 -34.023L35.641 -34.01L35.642 -33.997L35.635 -33.986L35.617 -33.986L35.603 -33.972L35.581 -33.917L35.567 -33.902L35.551 -33.898L35.508 -33.909L35.475 -33.903L35.468 -33.897L35.481 -33.862L35.478 -33.795L35.448 -33.746L35.437 -33.699L35.415 -33.687L35.417 -33.66L35.4 -33.644L35.399 -33.615L35.387 -33.603L35.386 -33.587L35.368 -33.563L35.357 -33.517L35.314 -33.471L35.287 -33.458L35.276 -33.439L35.256 -33.391L35.244 -33.329L35.222 -33.304L35.214 -33.278L35.196 -33.275L35.197 -33.266L35.21 -33.255L35.211 -33.224L35.19 -33.173L35.18 -33.162L35.166 -33.161L35.145 -33.124L35.113 -33.109L35.107 -33.092L35.155 -33.088L35.157 -33.083L35.177 -33.091L35.199 -33.082L35.215 -33.098L35.241 -33.089L35.296 -33.102L35.307 -33.095L35.322 -33.096L35.328 -33.088L35.325 -33.08L35.344 -33.059L35.376 -33.05L35.384 -33.056L35.433 -33.061L35.455 -33.089L35.506 -33.087L35.506 -33.111L35.522 -33.113L35.531 -33.126L35.53 -33.143L35.545 -33.196L35.539 -33.222L35.569 -33.285L35.58 -33.284L35.59 -33.263L35.628 -33.239L35.621 -33.255L35.624 -33.27L35.646 -33.278L35.664 -33.275L35.71 -33.303L35.723 -33.326L35.75 -33.324L35.815 -33.356L35.816 -33.371L35.828 -33.397L35.937 -33.461L35.947 -33.482L35.937 -33.49L35.931 -33.507L35.944 -33.525L35.967 -33.534L35.969 -33.544L35.986 -33.549L36 -33.538L36.011 -33.544L36.023 -33.541L36.058 -33.577L36.043 -33.601L36.02 -33.617L35.978 -33.633L35.977 -33.64L35.957 -33.635L35.938 -33.64L35.936 -33.65L35.946 -33.671L35.964 -33.677L35.958 -33.69L35.965 -33.697L35.931 -33.721L35.99 -33.746L36.008 -33.772L36.026 -33.766L36.057 -33.814L36.105 -33.826L36.109 -33.842L36.131 -33.836L36.145 -33.861L36.174 -33.842L36.188 -33.846L36.206 -33.832L36.221 -33.851L36.233 -33.846L36.239 -33.859L36.276 -33.853L36.315 -33.836L36.386 -33.837L36.392 -33.847L36.379 -33.858L36.374 -33.876L36.355 -33.899L36.295 -33.896L36.28 -33.888L36.262 -33.897L36.321 -33.97L36.336 -33.977L36.347 -33.992L36.359 -33.989L36.377 -34.012L36.384 -34.034L36.397 -34.033L36.396 -34.045L36.403 -34.051L36.414 -34.048L36.422 -34.058L36.433 -34.059L36.471 -34.047L36.493 -34.055L36.508 -34.08L36.502 -34.101L36.54 -34.135L36.559 -34.14L36.584 -34.185L36.619 -34.205L36.614 -34.233L36.589 -34.268L36.587 -34.284L36.592 -34.296L36.554 -34.313L36.56 -34.329L36.547 -34.34L36.53 -34.369L36.557 -34.397L36.561 -34.422L36.514 -34.439L36.495 -34.455L36.502 -34.463L36.47 -34.462L36.459 -34.478L36.438 -34.478L36.449 -34.507L36.417 -34.512L36.393 -34.499L36.35 -34.508L36.387 -34.545L36.41 -34.554L36.412 -34.565L36.398 -34.576L36.404 -34.609L36.413 -34.611L36.433 -34.594L36.45 -34.593L36.46 -34.61L36.454 -34.624L36.463 -34.637L36.444 -34.638L36.422 -34.626L36.4 -34.638L36.384 -34.632Z"

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

export default function LebanonMap({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="35.047 -34.753 1.632 1.763"
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
        d={BORDER}
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
