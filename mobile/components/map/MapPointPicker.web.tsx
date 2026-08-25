import { useEffect, useRef, useState } from 'react'
import { colors } from '../../lib/theme'

// ---------------------------------------------------------------------------
// A small map for placing one point precisely.
//
// Deliberately separate from the browsing map: this one has a single draggable
// pin, no clustering, no sheets, no filters. Reuses the MapLibre instance
// already loaded from the CDN by MapLibreView, so opening this costs nothing
// extra once the main map has been seen.
//
// The pin is dragged AND the map is click-to-place, because on a phone dragging
// a small target is fiddly, and on a desktop clicking is faster.
// ---------------------------------------------------------------------------

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

type AnyMap = {
  on: (ev: string, cb: (e: { lngLat: { lat: number; lng: number } }) => void) => void
  remove: () => void
  setCenter: (c: [number, number]) => void
  getCenter: () => { lat: number; lng: number }
  easeTo: (o: Record<string, unknown>) => void
}
type AnyMarker = {
  setLngLat: (c: [number, number]) => AnyMarker
  addTo: (m: AnyMap) => AnyMarker
  on: (ev: string, cb: () => void) => void
  getLngLat: () => { lat: number; lng: number }
  remove: () => void
}

declare global {
  // eslint-disable-next-line no-var
  var maplibregl: {
    Map: new (o: Record<string, unknown>) => AnyMap
    Marker: new (o?: Record<string, unknown>) => AnyMarker
  } | undefined
}

function load(): Promise<NonNullable<typeof globalThis.maplibregl>> {
  if (globalThis.maplibregl) return Promise.resolve(globalThis.maplibregl)
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'; css.href = MAPLIBRE_CSS
      document.head.appendChild(css)
    }
    const s = document.createElement('script')
    s.src = MAPLIBRE_JS; s.async = true
    s.onload = () => (globalThis.maplibregl ? resolve(globalThis.maplibregl) : reject(new Error('no maplibre')))
    s.onerror = () => reject(new Error('Could not load the map'))
    document.head.appendChild(s)
  })
}

export default function MapPointPicker({
  latitude, longitude, onChange,
}: {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const map = useRef<AnyMap | null>(null)
  const marker = useRef<AnyMarker | null>(null)
  const [err, setErr] = useState('')

  // Latest callback without re-creating the map on every parent render.
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    let dead = false
    load().then((ml) => {
      if (dead || !box.current) return
      const m = new ml.Map({
        container: box.current,
        style: BASEMAP,
        center: [longitude, latitude],
        zoom: 16,
        attributionControl: { compact: true },
      })
      map.current = m

      const el = document.createElement('div')
      el.style.cssText = `
        width:28px;height:34px;cursor:grab;
        filter:drop-shadow(0 3px 7px rgba(16,28,61,.35));
      `
      el.innerHTML = `
        <svg width="28" height="34" viewBox="0 0 30 37" fill="none">
          <path d="M8 20 L15 35 L22 20 Z" fill="${colors.doc}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="15" cy="13.5" r="11.5" fill="${colors.doc}" stroke="#fff" stroke-width="2"/>
          <circle cx="15" cy="13.5" r="4" fill="#fff"/>
        </svg>`

      const mk = new ml.Marker({ element: el, anchor: 'bottom', draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(m)
      marker.current = mk

      mk.on('dragend', () => {
        const p = mk.getLngLat()
        cb.current(p.lat, p.lng)
      })
      // Tap anywhere to move the pin — easier than dragging on a phone.
      m.on('click', (e) => {
        mk.setLngLat([e.lngLat.lng, e.lngLat.lat])
        cb.current(e.lngLat.lat, e.lngLat.lng)
      })
    }).catch((e) => { if (!dead) setErr(e instanceof Error ? e.message : 'Map failed') })

    return () => {
      dead = true
      marker.current?.remove()
      map.current?.remove()
      map.current = null
    }
    // Created once; external position changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the position when the parent changes it (e.g. a new GPS fix),
  // but never fight the user mid-drag.
  useEffect(() => {
    if (!marker.current || !map.current) return
    const cur = marker.current.getLngLat()
    if (Math.abs(cur.lat - latitude) < 1e-9 && Math.abs(cur.lng - longitude) < 1e-9) return
    marker.current.setLngLat([longitude, latitude])
    map.current.easeTo({ center: [longitude, latitude], duration: 500 })
  }, [latitude, longitude])

  if (err) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: colors.textMuted, fontSize: 13, padding: 16, textAlign: 'center',
      }}>
        {err}. You can still save. The coordinates below are what get used.
      </div>
    )
  }

  return <div ref={box} style={{ position: 'absolute', inset: 0 }} />
}
