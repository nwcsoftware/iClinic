import { View, Text } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, type } from '../../lib/theme'
import type { MapLocation } from '../../lib/mapApi'

// Native fallback.
//
// iClinic ships as a web PWA today, and the map is MapLibre GL JS — a browser
// library. Metro picks MapLibreView.web.tsx for web and this file everywhere
// else, so a native build still compiles and every other screen keeps working.
// A native map (react-native-maps or a MapLibre native binding) would slot in
// here behind the same props.
export default function MapLibreView(_props: {
  locations: MapLocation[]
  selectedId: string | null
  onSelect: (loc: MapLocation | null) => void
  onReady?: () => void
  focus?: { lat: number; lng: number; zoom?: number } | null
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
      <Feather name="map" size={30} color={colors.textFaint} />
      <Text style={[type.h2, { marginTop: 14, textAlign: 'center' }]}>Map needs the web app</Text>
      <Text style={[type.sub, { marginTop: 6, textAlign: 'center' }]}>
        Open iClinic in your browser to browse hospitals and clinics across Lebanon.
      </Text>
    </View>
  )
}
