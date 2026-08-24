import { useEffect, useRef, useState } from 'react'
import { colors } from '../../lib/theme'
import { LEBANON_BOUNDS, LEBANON_CENTER, type MapLocation } from '../../lib/mapApi'

// ---------------------------------------------------------------------------
// The Lebanon healthcare map.
//
// MapLibre GL JS is loaded from a CDN at runtime rather than bundled. The Expo
// web export is a fragile pipeline (icon fonts already needed post-processing
// to survive it) and MapLibre is browser-only, so keeping it out of Metro
// avoids breaking native bundling and the export in one go.
//
// The basemap is CARTO Positron — free, no API key — then restyled in place:
// water takes the brand indigo, land is flattened to a soft neutral, and every
// POI label from the stock style is removed so the only things with icons on
// this map are hospitals and clinics.
// ---------------------------------------------------------------------------

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

type MapLibreModule = {
  Map: new (opts: Record<string, unknown>) => MapInstance
  Marker: new (opts?: Record<string, unknown>) => MarkerInstance
  LngLatBounds: new (sw: [number, number], ne: [number, number]) => unknown
}
type MapInstance = {
  on: (ev: string, cb: () => void) => void
  remove: () => void
  getStyle: () => { layers: { id: string; type: string }[] }
  setPaintProperty: (layer: string, prop: string, value: unknown) => void
  removeLayer: (id: string) => void
  flyTo: (opts: Record<string, unknown>) => void
  fitBounds: (b: unknown, opts?: Record<string, unknown>) => void
  getZoom: () => number
  getCanvas: () => HTMLCanvasElement
}
type MarkerInstance = {
  setLngLat: (c: [number, number]) => MarkerInstance
  addTo: (m: MapInstance) => MarkerInstance
  remove: () => void
  getElement: () => HTMLElement
}

declare global {
  interface Window { maplibregl?: MapLibreModule }
}

let loader: Promise<MapLibreModule> | null = null

function loadMapLibre(): Promise<MapLibreModule> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl)
  if (loader) return loader

  loader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = MAPLIBRE_CSS
      document.head.appendChild(css)
    }
    const script = document.createElement('script')
    script.src = MAPLIBRE_JS
    script.async = true
    script.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error('maplibre missing')))
    script.onerror = () => reject(new Error('Could not load the map library'))
    document.head.appendChild(script)
  })
  return loader
}

// Repaint the stock basemap in the app's palette and strip everything that is
// not a road, a place name or water.
function applyBrandStyle(map: MapInstance) {
  let layers: { id: string; type: string }[] = []
  try { layers = map.getStyle().layers ?? [] } catch { return }

  for (const layer of layers) {
    const id = layer.id.toLowerCase()

    // Stock POIs compete with our markers — remove them entirely.
    if (id.includes('poi') || id.includes('shop') || id.includes('restaurant')) {
      try { map.removeLayer(layer.id) } catch { /* already gone */ }
      continue
    }

    try {
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#F5F6FA')
      } else if (id.includes('water')) {
        map.setPaintProperty(layer.id, 'fill-color', '#D7DEF6')
      } else if (id.includes('park') || id.includes('green') || id.includes('wood')) {
        map.setPaintProperty(layer.id, 'fill-color', '#E4EEE7')
      } else if (id.includes('building')) {
        map.setPaintProperty(layer.id, 'fill-color', '#E9ECF3')
        map.setPaintProperty(layer.id, 'fill-opacity', 0.6)
      } else if (layer.type === 'line' && (id.includes('road') || id.includes('street') || id.includes('motorway'))) {
        map.setPaintProperty(layer.id, 'line-color', id.includes('motorway') ? '#FFFFFF' : '#FBFCFE')
      }
    } catch { /* layer does not take that property in this style */ }
  }
}

// ---------------------------------------------------------------------------
// Markers.
//
// MapLibre positions the exact element passed to `new Marker({element})` by
// writing its own `transform` on that element on every pan/zoom frame — that
// element is not ours to style. The previous version replaced its whole
// `style.cssText` on every selection change, which wiped MapLibre's transform
// and left the pin sitting at (0,0) until the next camera move recalculated
// it — the "floating during zoom" bug.
//
// The fix is structural: the root element we pass to Marker gets NOTHING but
// class names, ever, from us — no inline style, before or after creation.
// Everything visual (colour, size, the selected scale-up, the pulse) lives on
// a child we fully own and is driven entirely by CSS classes, so there is
// nothing left for a later update to clobber.
// ---------------------------------------------------------------------------

const PIN_W = 30
const PIN_H = 37

function pinSvg(hospital: boolean): string {
  // One silhouette for every marker: a circular head merging into a pointed
  // tip, anchor='bottom' below aligns that tip exactly on the coordinate.
  // The triangle is drawn first and the head circle on top of it, so the
  // circle's own stroke hides the triangle's top edge and only its two
  // slanted sides remain visible — one continuous outline, no seam.
  const icon = hospital
    // Hospital: a bold filled cross — the one symbol that reads instantly at
    // marker size, worldwide.
    ? `<path class="icl-pin-icon" d="M13.4 8.6h3.2v3.8H20.4v3.2h-3.8v3.8h-3.2v-3.8H9.6v-3.2h3.8z" fill="#fff"/>`
    // Clinic: a simple ring — deliberately quieter than the hospital cross.
    : `<circle class="icl-pin-icon" cx="15" cy="13.5" r="4.2" fill="none" stroke="#fff" stroke-width="2.4"/>`

  return `
    <svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 30 37" fill="none">
      <path class="icl-pin-fill icl-pin-stroke" d="M8 20 L15 35 L22 20 Z" stroke-width="2" stroke-linejoin="round"/>
      <circle class="icl-pin-fill icl-pin-stroke" cx="15" cy="13.5" r="11.5" stroke-width="2"/>
      ${icon}
    </svg>`
}

// Built once per location; after that only classList and the badge text ever
// change — see the note above for why.
function buildMarkerElement(loc: MapLocation): HTMLElement {
  const hospital = loc.type === 'hospital'
  const hasDoctors = loc.doctor_count > 0

  const el = document.createElement('div')
  el.className = `icl-mk ${hospital ? 'type-hospital' : 'type-clinic'}`

  const inner = document.createElement('div')
  inner.className = 'icl-inner'
  inner.innerHTML = pinSvg(hospital)

  if (hasDoctors) {
    const pulse = document.createElement('div')
    pulse.className = 'icl-pulse'
    inner.appendChild(pulse)
  }

  el.appendChild(inner)

  if (hasDoctors) {
    const badge = document.createElement('div')
    badge.className = 'icl-badge'
    badge.textContent = String(loc.doctor_count)
    el.appendChild(badge)
  }

  return el
}

function injectKeyframes() {
  if (document.getElementById('iclinic-map-css')) return
  const style = document.createElement('style')
  style.id = 'iclinic-map-css'
  style.textContent = `
    @keyframes iclinicPulse {
      0%   { transform: scale(.7); opacity:.5; }
      100% { transform: scale(1.9); opacity:0;   }
    }
    .maplibregl-ctrl-attrib { font-size:10px; opacity:.55; }
    .maplibregl-canvas { outline:none; }

    /* The root marker element: MapLibre owns its position/transform. We only
       ever touch its className, never its style, at any point. */
    .icl-mk { cursor: pointer; }
    .icl-mk.type-hospital { --icl-accent: ${colors.brand}; --icl-accent-dark: ${colors.brandDark}; }
    .icl-mk.type-clinic   { --icl-accent: #0F766E; --icl-accent-dark: #0B5A54; }

    .icl-mk .icl-inner {
      position: relative;
      width: ${PIN_W}px; height: ${PIN_H}px;
      /* Scaling from the tip (bottom-centre) means the point never drifts
         off the coordinate when a marker grows on selection. */
      transform-origin: 50% 100%;
      transition: transform .2s cubic-bezier(.2,.9,.3,1);
      filter: drop-shadow(0 3px 8px rgba(16,28,61,.30));
    }
    .icl-mk.sel .icl-inner { transform: scale(1.14); }

    .icl-mk .icl-pin-fill { fill: var(--icl-accent); }
    .icl-mk .icl-pin-stroke { stroke: #fff; }
    .icl-mk.sel .icl-pin-fill { fill: var(--icl-accent-dark); }

    .icl-mk .icl-pulse {
      position: absolute; left: 15px; top: 13.5px; width: 23px; height: 23px;
      margin-left: -11.5px; margin-top: -11.5px; border-radius: 50%;
      border: 2px solid var(--icl-accent);
      animation: iclinicPulse 2.2s ease-out infinite;
      pointer-events: none;
    }
    .icl-mk.sel .icl-pulse { display: none; }

    .icl-mk .icl-badge {
      position: absolute; top: -3px; right: -1px;
      min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px;
      background: var(--icl-accent-dark); color: #fff;
      font: 700 10.5px/17px -apple-system,Segoe UI,Roboto,sans-serif;
      text-align: center; box-shadow: 0 2px 5px rgba(16,28,61,.32);
    }
  `
  document.head.appendChild(style)
}

export default function MapLibreView({
  locations, selectedId, onSelect, onReady, focus,
}: {
  locations: MapLocation[]
  selectedId: string | null
  onSelect: (loc: MapLocation | null) => void
  onReady?: () => void
  /** Fly the camera here when it changes. */
  focus?: { lat: number; lng: number; zoom?: number } | null
}) {
  const container = useRef<HTMLDivElement | null>(null)
  const map = useRef<MapInstance | null>(null)
  const markers = useRef<Map<string, MarkerInstance>>(new Map())
  const [error, setError] = useState('')
  // "The map object exists" — enough to attach markers.
  const [ready, setReady] = useState(false)
  // "Tiles are actually painted" — only controls the loading shimmer.
  const [painted, setPainted] = useState(false)

  // Keep the latest handler without re-creating the map.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let cancelled = false
    injectKeyframes()

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled || !container.current) return
        const m = new maplibregl.Map({
          container: container.current,
          style: BASEMAP,
          center: [LEBANON_CENTER.lng, LEBANON_CENTER.lat],
          zoom: 7.6,
          maxBounds: LEBANON_BOUNDS,
          minZoom: 6.5,
          maxZoom: 18,
          attributionControl: { compact: true },
        })
        map.current = m

        // Markers are DOM overlays, so they can attach the moment the map
        // object exists. Gating them on 'load' meant one failed sprite or
        // glyph fetch in the basemap left the map permanently empty.
        setReady(true)
        onReady?.()

        // Restyling does need the style, so it waits — and 'styledata' covers
        // the case where 'load' never fires because a sub-resource 404s.
        let styled = false
        const restyle = () => {
          if (cancelled || styled) return
          styled = true
          applyBrandStyle(m)
        }
        m.on('load', restyle)
        m.on('styledata', restyle)
        m.on('idle', () => { if (!cancelled) setPainted(true) })
        // Tapping empty map closes whatever sheet is open.
        m.on('click', () => onSelectRef.current(null))
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Map failed to load') })

    return () => {
      cancelled = true
      markers.current.forEach((mk) => mk.remove())
      markers.current.clear()
      map.current?.remove()
      map.current = null
    }
  }, [onReady])

  // Markers follow the (already filtered) location list.
  useEffect(() => {
    const m = map.current
    const maplibregl = window.maplibregl
    if (!m || !maplibregl || !ready) return

    const wanted = new Set(locations.map((l) => l.id))
    for (const [id, mk] of markers.current) {
      if (!wanted.has(id)) { mk.remove(); markers.current.delete(id) }
    }

    for (const loc of locations) {
      const existing = markers.current.get(loc.id)
      const isSelected = loc.id === selectedId
      if (existing) {
        // Only the selected state ever changes after creation, and it is a
        // class toggle — never touch this element's `style` (see the note
        // above `pinSvg`), or MapLibre's own positioning gets wiped.
        existing.getElement().classList.toggle('sel', isSelected)
        continue
      }
      const el = buildMarkerElement(loc)
      el.classList.toggle('sel', isSelected)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onSelectRef.current(loc)
      })
      // 'bottom': the pin's point, not its centre, sits on the coordinate —
      // what makes a map pin read as anchored rather than floating above it.
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(m)
      markers.current.set(loc.id, mk)
    }
  }, [locations, selectedId, ready])

  // Cinematic camera move when something is chosen from search or a marker tap.
  useEffect(() => {
    if (!map.current || !ready || !focus) return
    map.current.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 14.5,
      duration: 1400,
      curve: 1.42,
      essential: true,
    })
  }, [focus, ready])

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colors.bg, padding: 24, textAlign: 'center',
      }}>
        <div>
          <p style={{ color: colors.ink, fontWeight: 700, fontSize: 16, margin: 0 }}>Map unavailable</p>
          <p style={{ color: colors.textMuted, fontSize: 14, marginTop: 6 }}>
            {error}. Check your connection and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: colors.bg }}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {!painted ? <MapSkeleton /> : null}
    </div>
  )
}

// Shown while tiles load — a soft shimmer rather than a spinner.
function MapSkeleton() {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: colors.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: colors.brandSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'iclinicPulse 1.8s ease-out infinite',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.brand}
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" />
        </svg>
      </div>
    </div>
  )
}
