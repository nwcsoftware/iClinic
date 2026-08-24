import { useEffect, useRef } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Animated, Easing, Platform, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../../lib/theme'
import { Avatar, Rating } from '../ui'
import { LOCATION_LABEL, type LocationDoctor, type MapLocation } from '../../lib/mapApi'

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The card that rises when a marker is tapped. Deliberately a sheet rather than
// a route change: the map stays visible behind it, so the relationship between
// the pin and the card is never lost.
export default function HealthcareLocationSheet({
  location, onClose, onPickDoctor,
}: {
  location: MapLocation | null
  onClose: () => void
  onPickDoctor: (doctorId: string, locationId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const slide = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(slide, {
      toValue: location ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
      damping: 20,
      stiffness: 190,
      mass: 0.9,
    }).start()
  }, [location, slide])

  if (!location) return null

  function directions() {
    const l = location as MapLocation
    const q = `${l.latitude},${l.longitude}`
    const label = encodeURIComponent(l.name)
    // Hands off to whatever maps app the device has, with the destination
    // already filled in — in-app turn-by-turn is not worth building here.
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${q}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`
    Linking.openURL(url).catch(() => {})
  }

  const accent = location.type === 'hospital' ? colors.brand : colors.doc

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [340, 0] }) }],
        },
      ]}
    >
      <View style={styles.grabber} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingHorizontal: 20 }}>
        <View style={[styles.icon, { backgroundColor: location.type === 'hospital' ? colors.brandSoft : colors.docSoft }]}>
          <MaterialCommunityIcons
            name={location.type === 'hospital' ? 'hospital-building' : 'stethoscope'}
            size={22}
            color={accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h1} numberOfLines={2}>{location.name}</Text>
          <Text style={[type.sub, { marginTop: 3 }]}>
            {LOCATION_LABEL[location.type]}
            {location.city ? ` · ${location.city}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
          <Feather name="x" size={19} color={colors.textFaint} />
        </Pressable>
      </View>

      {location.address ? (
        <View style={styles.row}>
          <Feather name="map-pin" size={15} color={colors.textFaint} />
          <Text style={[type.sub, { flex: 1 }]}>{location.address}</Text>
        </View>
      ) : null}

      {location.phone ? (
        <Pressable style={styles.row} onPress={() => Linking.openURL(`tel:${location.phone}`)}>
          <Feather name="phone" size={15} color={colors.textFaint} />
          <Text style={[type.sub, { flex: 1, color: accent, fontWeight: '700' }]}>{location.phone}</Text>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 }}>
        <Pressable
          onPress={directions}
          style={({ pressed }) => [styles.primary, { backgroundColor: accent }, pressed && { opacity: 0.85 }]}
        >
          <Feather name="navigation" size={16} color="#fff" />
          <Text style={styles.primaryText}>Directions</Text>
        </Pressable>
      </View>

      <ScrollView style={{ marginTop: 18, maxHeight: 300 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.label, { paddingHorizontal: 20, marginBottom: 10 }]}>
          {location.doctor_count === 0
            ? 'No doctors listed here yet'
            : `${location.doctor_count} doctor${location.doctor_count === 1 ? '' : 's'} here`}
        </Text>

        {location.doctors.length === 0 ? (
          <Text style={[type.sub, { paddingHorizontal: 20, paddingBottom: 20 }]}>
            When a doctor adds this place as one of their workplaces, they will appear here.
          </Text>
        ) : (
          location.doctors.map((d) => (
            <DoctorRow key={d.id} doctor={d} onPress={() => onPickDoctor(d.id, location.id)} />
          ))
        )}
      </ScrollView>
    </Animated.View>
  )
}

function DoctorRow({ doctor, onPress }: { doctor: LocationDoctor; onPress: () => void }) {
  const days = doctor.working_days.length > 0
    ? doctor.working_days.map((d) => DAY_LABEL[d]).join(' · ')
    : null
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.doctorRow, pressed && { backgroundColor: colors.brandSofter }]}
    >
      <Avatar name={doctor.full_name} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={type.h2} numberOfLines={1}>{doctor.full_name}</Text>
        <Text style={[type.sub, { marginTop: 1 }]} numberOfLines={1}>
          {doctor.specialty ?? 'Specialist'}
        </Text>
        {days ? <Text style={[type.small, { marginTop: 2 }]}>{days}</Text> : null}
        <View style={{ marginTop: 3 }}>
          <Rating rating={doctor.rating} count={doctor.review_count} />
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textFaint} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: 10, ...shadow.raised,
  },
  grabber: {
    width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 14,
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginTop: 12,
  },
  primary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.md,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  doctorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
})
