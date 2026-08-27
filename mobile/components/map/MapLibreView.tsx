import { useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Map as MapLibreMap, Camera, Marker, type CameraRef } from '@maplibre/maplibre-react-native'
import { LEBANON_BOUNDS, type MapLocation } from '../../lib/mapApi'
import { colors } from '../../lib/theme'

// ---------------------------------------------------------------------------
// The map, on a real device.
//
// Same CARTO Positron basemap as the web build, so the two look like the same
// product, and same free tiles — no Google Maps key, no billing account, no
// per-load quota to watch.
//
// Props match MapLibreView.web.tsx exactly. Metro picks the .web file for the
// browser and this one for iOS and Android, and MapScreen never learns which
// it got.
// ---------------------------------------------------------------------------

const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

// Web draws a teardrop in SVG. Views cannot make that shape without pulling in
// a drawing library, so native uses a disc with a tail: same colours, same
// scale-up when selected, recognisably the same pin.
const PIN = 30

function Pin({ hospital, selected, count }: { hospital: boolean; selected: boolean; count: number }) {
  const accent = hospital ? colors.brand : colors.doc
  const accentDark = hospital ? colors.brandDark : colors.docDark
  const size = selected ? PIN * 1.14 : PIN

  return (
    <View style={styles.pinWrap} pointerEvents="none">
      <View
        style={[
          styles.pin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: selected ? accentDark : accent,
          },
        ]}
      >
        {hospital ? (
          <>
            <View style={styles.crossV} />
            <View style={styles.crossH} />
          </>
        ) : (
          <View style={styles.ring} />
        )}
      </View>

      {/* The tail, so the pin reads as pointing at a place rather than floating */}
      <View
        style={[
          styles.tail,
          { borderTopColor: selected ? accentDark : accent },
        ]}
      />

      {count > 1 ? (
        <View style={[styles.badge, { backgroundColor: accentDark }]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </View>
  )
}

export default function MapLibreView({
  locations, selectedId, onSelect, onReady, focus,
}: {
  locations: MapLocation[]
  selectedId: string | null
  onSelect: (loc: MapLocation | null) => void
  onReady?: () => void
  focus?: { lat: number; lng: number; zoom?: number } | null
}) {
  const camera = useRef<CameraRef | null>(null)

  // Only places with coordinates can be drawn; the rest are still listed in
  // the sheet, they simply have no pin.
  const pinned = useMemo(
    () => locations.filter((l) => l.latitude != null && l.longitude != null),
    [locations],
  )

  // Focus wins over everything: it is how tapping a result moves the map.
  useEffect(() => {
    if (!focus || !camera.current) return
    camera.current.easeTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? 14,
      duration: 600,
    })
  }, [focus])

  return (
    <View style={{ flex: 1 }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={BASEMAP}
        attributionPosition={{ bottom: 8, right: 8 }}
        onDidFinishLoadingMap={onReady}
        // Tapping bare map closes the sheet, matching the web build.
        onPress={() => onSelect(null)}
      >
        <Camera
          ref={camera}
          // The whole country in view on first paint, same as the web build.
          initialViewState={{
            bounds: [
              LEBANON_BOUNDS[0][0], LEBANON_BOUNDS[0][1],
              LEBANON_BOUNDS[1][0], LEBANON_BOUNDS[1][1],
            ],
          }}
        />

        {pinned.map((loc) => (
          <Marker
            key={loc.id}
            id={loc.id}
            lngLat={[loc.longitude, loc.latitude]}
            anchor="bottom"
            onPress={() => onSelect(loc)}
          >
            <Pin
              hospital={loc.type === 'hospital'}
              selected={loc.id === selectedId}
              count={loc.doctor_count ?? 0}
            />
          </Marker>
        ))}
      </MapLibreMap>
    </View>
  )
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center', width: PIN * 1.3, height: PIN * 1.5 },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#101c3d',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  // A plus sign for hospitals, a ring for everything else: the same two marks
  // the web pin uses.
  crossV: { position: 'absolute', width: 3.2, height: 13, borderRadius: 2, backgroundColor: '#fff' },
  crossH: { position: 'absolute', width: 13, height: 3.2, borderRadius: 2, backgroundColor: '#fff' },
  ring: { width: 9, height: 9, borderRadius: 5, borderWidth: 2.4, borderColor: '#fff' },
  tail: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
})
