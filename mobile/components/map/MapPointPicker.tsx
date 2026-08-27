import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Map as MapLibreMap, Camera, Marker, type CameraRef } from '@maplibre/maplibre-react-native'
import { colors } from '../../lib/theme'

// ---------------------------------------------------------------------------
// Placing one point precisely, on a device.
//
// The web build lets the doctor drag the pin; here they tap where it belongs,
// which is the easier gesture on a phone anyway and the one the web build
// added for the same reason. Same basemap as everywhere else.
// ---------------------------------------------------------------------------

const BASEMAP = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

export default function MapPointPicker({
  latitude, longitude, onChange,
}: {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}) {
  const camera = useRef<CameraRef | null>(null)

  // Follow the pin when the parent moves it, for instance after a fresh GPS fix.
  useEffect(() => {
    camera.current?.easeTo({ center: [longitude, latitude], zoom: 16, duration: 500 })
  }, [latitude, longitude])

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={BASEMAP}
        attributionPosition={{ bottom: 6, right: 6 }}
        onPress={(e) => {
          const [lng, lat] = e.nativeEvent.lngLat
          onChange(lat, lng)
        }}
      >
        <Camera ref={camera} initialViewState={{ center: [longitude, latitude], zoom: 16 }} />

        <Marker lngLat={[longitude, latitude]} anchor="bottom">
          <View style={styles.pinWrap} pointerEvents="none">
            <View style={styles.pin}>
              <View style={styles.ring} />
            </View>
            <View style={styles.tail} />
          </View>
        </Marker>
      </MapLibreMap>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Tap the map to move the pin</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center', width: 34, height: 42 },
  pin: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.doc,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#101c3d', shadowOpacity: 0.35, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  ring: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  tail: {
    marginTop: -2, width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: colors.doc,
  },
  hint: {
    position: 'absolute', left: 0, right: 0, bottom: 10,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(13, 21, 38, 0.72)', color: '#fff',
    fontSize: 12, fontWeight: '700',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    overflow: 'hidden',
  },
})
