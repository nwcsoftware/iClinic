import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, type } from '../lib/theme'
import type { VisitLocation } from '../lib/api'

// ---------------------------------------------------------------------------
// Where a visit is.
//
// Used before booking, to show the patient where they would be going, and
// afterwards on the appointment itself. Same component both times, so the two
// can never drift into describing the same place differently.
// ---------------------------------------------------------------------------

const ICON: Record<VisitLocation['type'], string> = {
  hospital: 'hospital-building',
  clinic: 'stethoscope',
  private_clinic: 'door',
  medical_center: 'medical-bag',
}

const LABEL: Record<VisitLocation['type'], string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  private_clinic: 'Private clinic',
  medical_center: 'Medical center',
}

/**
 * Opens the place in whatever maps app the device uses.
 *
 * Coordinates are preferred over the name: they are what the doctor confirmed,
 * and a search by name can land on a different branch of the same hospital.
 */
export function openDirections(place: VisitLocation) {
  const { latitude: lat, longitude: lng } = place
  if (lat != null && lng != null) {
    const label = encodeURIComponent(place.name)
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    })
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
    })
    return
  }
  if (place.google_maps_url) { Linking.openURL(place.google_maps_url); return }
  const query = encodeURIComponent([place.name, place.city, 'Lebanon'].filter(Boolean).join(', '))
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
}

export default function VisitLocationCard({
  place, compact = false,
}: {
  place: VisitLocation | null
  /** Tighter version for a row inside an appointment card. */
  compact?: boolean
}) {
  if (!place) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact, styles.unknown]}>
        <Feather name="help-circle" size={compact ? 15 : 17} color={colors.textFaint} />
        <Text style={[type.small, { flex: 1 }]}>
          The doctor has not set a location for this visit yet. They will confirm where to go.
        </Text>
      </View>
    )
  }

  // "Minieh, Minieh" happens whenever a small place's address and city are the
  // same word, so repeated parts are dropped.
  const where = place.formatted_address ?? (() => {
    const seen = new Set<string>()
    return [place.address, place.city, place.governorate]
      .filter((part): part is string => {
        const key = (part ?? '').trim().toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .join(', ')
  })()
  const canRoute = (place.latitude != null && place.longitude != null) || !!place.google_maps_url

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.icon, compact && styles.iconCompact]}>
        <MaterialCommunityIcons
          name={ICON[place.type] as never}
          size={compact ? 15 : 18}
          color={colors.brand}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={compact ? styles.nameCompact : type.h2} numberOfLines={2}>{place.name}</Text>
        <Text style={[type.small, { marginTop: 1 }]}>
          {LABEL[place.type]}{where ? ` · ${where}` : ''}
        </Text>

        {compact ? null : (
          <View style={styles.actions}>
            {canRoute ? (
              <Pressable onPress={() => openDirections(place)} style={styles.action} hitSlop={6}>
                <Feather name="navigation" size={13} color={colors.brand} />
                <Text style={styles.actionText}>Directions</Text>
              </Pressable>
            ) : null}
            {place.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${place.phone}`)}
                style={styles.action}
                hitSlop={6}
              >
                <Feather name="phone" size={13} color={colors.brand} />
                <Text style={styles.actionText}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {compact && canRoute ? (
        <Pressable
          onPress={() => openDirections(place)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Directions to ${place.name}`}
          style={styles.compactRoute}
        >
          <Feather name="navigation" size={15} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: colors.brandSofter, borderRadius: radius.md, padding: 13,
  },
  wrapCompact: { padding: 10, gap: 9, alignItems: 'center' },
  unknown: { backgroundColor: colors.bg, alignItems: 'center' },
  icon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCompact: { width: 28, height: 28, borderRadius: 14 },
  nameCompact: { fontSize: 14, fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
  compactRoute: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
})
