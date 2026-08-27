import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, Animated, Platform, Easing, ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../lib/theme'
import { getMapLocations, type MapLocation } from '../lib/mapApi'
import MapLibreView from '../components/map/MapLibreView'
import HealthcareLocationSheet from '../components/map/HealthcareLocationSheet'
import { getCurrentLocation } from '../lib/geolocate'
import { notify } from '../lib/notify'
import MapFilterChips, { type MapFilter } from '../components/map/MapFilterChips'

// The Lebanon healthcare map.
//
// Everything is loaded once and filtered in memory: the dataset is small
// (hospitals and registered clinics in one country), and filtering locally is
// what makes the chips feel instant instead of round-tripping per tap.
export default function MapScreen({
  onBack, onPickDoctor,
}: {
  onBack: () => void
  onPickDoctor: (doctorId: string, locationId: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [all, setAll] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<MapFilter>({ kind: 'all' })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MapLocation | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)

  // Cinematic entrance — the map fades up rather than snapping in.
  const enter = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 520, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [enter])

  useEffect(() => {
    let active = true
    getMapLocations()
      .then((locs) => {
        if (!active) return
        setAll(locs)
        setError('')
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load the map') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // Speciality chips come from the doctors already on the map, so a chip can
  // never be offered that would return nothing.
  const availableSpecialties = useMemo(() => {
    const found = new Map<string, string>()
    for (const l of all) {
      for (const d of l.doctors) {
        if (d.specialty_slug && d.specialty && !found.has(d.specialty_slug)) {
          found.set(d.specialty_slug, d.specialty)
        }
      }
    }
    return [...found].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [all])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((l) => {
      if (filter.kind === 'type') {
        // "Clinics" covers every non-hospital place, which is what a patient means.
        const isHospital = l.type === 'hospital'
        if (filter.value === 'hospital' && !isHospital) return false
        if (filter.value === 'clinic' && isHospital) return false
      }
      if (filter.kind === 'specialty'
        && !l.doctors.some((d) => d.specialty_slug === filter.value)) return false

      if (q) {
        const hay = `${l.name} ${l.city ?? ''} ${l.governorate ?? ''} ${l.address ?? ''} `
          + l.doctors.map((d) => `${d.full_name} ${d.specialty ?? ''}`).join(' ')
        if (!hay.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [all, filter, query])

  // Search results shown as a list until one is chosen.
  const showResults = query.trim().length > 1 && !selected

  const choose = useCallback((loc: MapLocation) => {
    setSelected(loc)
    setFocus({ lat: loc.latitude, lng: loc.longitude, zoom: 15 })
  }, [])

  // Finding yourself on the map. Permission is only ever asked for after a
  // deliberate tap, never on load, because a map that demands your location
  // before showing you anything is a map people close.
  const [locating, setLocating] = useState(false)
  const [showUser, setShowUser] = useState(false)

  async function locateMe() {
    setLocating(true)
    try {
      const res = await getCurrentLocation()
      if (!res.ok) {
        notify(
          res.reason === 'denied' ? 'Location is off' : 'Could not find you',
          res.reason === 'denied'
            ? 'Allow location access to see where you are on the map.'
            : 'Your position was not available. Check that location is switched on.',
        )
        return
      }
      setShowUser(true)
      setSelected(null)
      setFocus({ lat: res.fix.latitude, lng: res.fix.longitude, zoom: 13 })
    } finally {
      setLocating(false)
    }
  }

  const chipTop = Math.max(insets.top, Platform.OS === 'web' ? 16 : 12) + 68

  return (
    <Animated.View style={[styles.root, { opacity: enter }]}>
      <MapLibreView
        locations={visible}
        selectedId={selected?.id ?? null}
        onSelect={(loc) => (loc ? choose(loc) : setSelected(null))}
        focus={focus}
        showUser={showUser}
      />

      {/* Search */}
      <View style={[styles.searchWrap, { top: Math.max(insets.top, Platform.OS === 'web' ? 16 : 12) }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.search}>
          <Feather name="search" size={17} color={colors.textFaint} />
          <TextInput
            style={styles.input}
            placeholder="Search doctor, specialty, clinic or hospital"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={(t) => { setQuery(t); if (t) setSelected(null) }}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <MapFilterChips
        active={filter}
        specialties={availableSpecialties}
        onChange={(f) => { setFilter(f); setSelected(null) }}
        topInset={chipTop}
      />

      {/* Search results — choosing one flies the camera and opens its sheet */}
      {showResults ? (
        <View style={[styles.results, { top: chipTop + 52 }]}>
          {visible.length === 0 ? (
            <View style={{ padding: 18 }}>
              <Text style={type.h2}>Nothing found</Text>
              <Text style={[type.sub, { marginTop: 4 }]}>
                Try a speciality like “cardiology”, or a city like “Tripoli”.
              </Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
              {visible.slice(0, 12).map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => { setQuery(''); choose(l) }}
                  style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.brandSofter }]}
                >
                  <View style={styles.resultIcon}>
                    <Feather name={l.type === 'hospital' ? 'plus-square' : 'map-pin'} size={15} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2} numberOfLines={1}>{l.name}</Text>
                    <Text style={[type.sub, { marginTop: 1 }]} numberOfLines={1}>
                      {[l.city, l.doctor_count > 0 ? `${l.doctor_count} doctor${l.doctor_count === 1 ? '' : 's'}` : null]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {/* States that are not the map itself */}
      {!loading && all.length === 0 ? (
        <View style={styles.empty} pointerEvents="box-none">
          <View style={styles.emptyCard}>
            <Feather name="map-pin" size={22} color={colors.brand} />
            <Text style={[type.h2, { marginTop: 10, textAlign: 'center' }]}>No places on the map yet</Text>
            <Text style={[type.sub, { marginTop: 5, textAlign: 'center' }]}>
              {error || 'Hospitals and clinics appear here as doctors add their workplaces.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Find me. Sits above the count pill so neither covers the other. */}
      {!selected && !showResults ? (
        <Pressable
          onPress={locateMe}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          style={({ pressed }) => [
            styles.locateBtn,
            { bottom: Math.max(insets.bottom, 16) + 62 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          {locating
            ? <ActivityIndicator size="small" color={colors.brand} />
            : <MaterialCommunityIcons name="crosshairs-gps" size={21} color={colors.brand} />}
        </Pressable>
      ) : null}

      {/* Count pill — quiet confirmation that filters did something */}
      {!loading && all.length > 0 && !selected && !showResults ? (
        <View style={[styles.countPill, { bottom: Math.max(insets.bottom, 16) + 16 }]} pointerEvents="none">
          <Text style={styles.countText}>
            {visible.length} {visible.length === 1 ? 'place' : 'places'}
            {filter.kind === 'specialty' ? ` · ${filter.label}` : ''}
          </Text>
        </View>
      ) : null}

      <HealthcareLocationSheet
        location={selected}
        onClose={() => setSelected(null)}
        onPickDoctor={onPickDoctor}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  locateBtn: {
    position: 'absolute', right: 16,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.raised,
  },
  root: { flex: 1, backgroundColor: colors.bg },
  searchWrap: {
    position: 'absolute', left: 0, right: 0, zIndex: 25,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: radius.full,
    paddingHorizontal: 16, height: 44, ...shadow.card,
  },
  input: { flex: 1, fontSize: 14.5, color: colors.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null) },
  results: {
    position: 'absolute', left: 16, right: 16, zIndex: 24,
    backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow.raised,
  },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  resultIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: radius.xl, padding: 24,
    alignItems: 'center', maxWidth: 320, ...shadow.raised,
  },
  countPill: {
    position: 'absolute', alignSelf: 'center', zIndex: 15,
    backgroundColor: 'rgba(13,21,38,0.82)', borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  countText: { color: '#fff', fontSize: 13, fontWeight: '700' },
})
