import { View, Text } from 'react-native'
import { colors, type } from '../../lib/theme'

// Native fallback. MapLibre GL JS is browser-only; Metro picks the .web.tsx
// file for web and this one elsewhere, so a native build still compiles.
// The confirm step shows the coordinates as text either way, so a doctor on
// native can still verify and save — they just cannot drag the pin.
export default function MapPointPicker({
  latitude, longitude,
}: {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={[type.sub, { textAlign: 'center' }]}>
        Map preview needs the web app.
      </Text>
      <Text style={[type.small, { marginTop: 6, color: colors.textMuted }]}>
        {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </Text>
    </View>
  )
}
