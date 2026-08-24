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

// Marker DOM. Built by hand rather than with an image so it can carry CSS
// transitions, a pulse, and a selected state.
function markerElement(loc: MapLocation, selected: boolean): HTMLElement {
  const hospital = loc.type === 'hospital'
  const accent = hospital ? colors.brand : '#0F766E'

  const el = document.createElement('div')
  el.style.cssText = `
    position:relative;width:${selected ? 46 : 38}px;height:${selected ? 46 : 38}px;
    cursor:pointer;transition:width .22s cubic-bezier(.2,.9,.3,1),height .22s cubic-bezier(.2,.9,.3,1);
  `

  if (loc.doctor_count > 0) {
    const ring = document.createElement('div')
    ring.style.cssText = `
      position:absolute;inset:-6px;border-radius:50%;
      border:2px solid ${accent};opacity:.35;
      animation:iclinicPulse 2.4s ease-out infinite;
    `
    el.appendChild(ring)
  }

  const pin = document.createElement('div')
  pin.style.cssText = `
    position:absolute;inset:0;border-radius:50%;
    background:${selected ? accent : '#FFFFFF'};
    border:2.5px solid ${accent};
    box-shadow:0 6px 18px rgba(16,28,61,${selected ? 0.34 : 0.18});
    display:flex;align-items:center;justify-content:center;
    transform:scale(${selected ? 1.06 : 1});
    transition:transform .22s cubic-bezier(.2,.9,.3,1),background .22s ease;
  `
  pin.innerHTML = hospital
    ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${selected ? '#fff' : accent}" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${selected ? '#fff' : accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`
  el.appendChild(pin)

  if (loc.doctor_count > 0) {
    const badge = document.createElement('div')
    badge.textContent = String(loc.doctor_count)
    badge.style.cssText = `
      position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;
      border-radius:9px;background:${accent};color:#fff;font:700 11px/18px -apple-system,Segoe UI,Roboto,sans-serif;
      text-align:center;box-shadow:0 2px 6px rgba(16,28,61,.28);
    `
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
      0%   { transform: scale(.85); opacity:.45; }
      70%  { transform: scale(1.5);  opacity:0;   }
      100% { transform: scale(1.5);  opacity:0;   }
    }
    .maplibregl-ctrl-attrib { font-size:10px; opacity:.55; }
    .maplibregl-canvas { outline:none; }
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
  const [ready, setReady] = useState(false)

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

        m.on('load', () => {
          if (cancelled) return
          applyBrandStyle(m)
          setReady(true)
          onReady?.()
        })
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
        // Rebuild only the element that changed state, not the marker.
        const fresh = markerElement(loc, isSelected)
        const el = existing.getElement()
        el.replaceChildren(...Array.from(fresh.childNodes))
        el.style.cssText = fresh.style.cssText
        continue
      }
      const el = markerElement(loc, isSelected)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onSelectRef.current(loc)
      })
      const mk = new maplibregl.Marker({ element: el, anchor: 'center' })
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
      {!ready ? <MapSkeleton /> : null}
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
