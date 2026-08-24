import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform, Animated, Easing,
} from 'react-native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { resolveLocation, type ResolvedLocation, type LocationSource } from '../../lib/mapApi'
import { colors, radius, shadow, type } from '../../lib/theme'
import MapPointPicker from './MapPointPicker'

// ---------------------------------------------------------------------------
// Choosing exactly where a clinic is.
//
// Four ways in, because a doctor setting this up could be at their desk with a
// link in the clipboard, or standing in the clinic with GPS. Whatever the
// route, it converges on the same confirm step: pin on a map, address shown,
// "is this right?" — nothing is saved until they say yes.
// ---------------------------------------------------------------------------

export type ConfirmedLocation = {
  latitude: number
  longitude: number
  name: string | null
  formatted_address: string | null
  city: string | null
  governorate: string | null
  google_maps_url: string | null
  location_source: LocationSource
}

type Method = 'google_maps_link' | 'current_location' | 'map_picker' | 'address_search'

const METHODS: { key: Method; label: string; hint: string; icon: string }[] = [
  { key: 'google_maps_link', label: 'Paste a Google Maps link', hint: 'Most accurate', icon: 'google-maps' },
  { key: 'current_location', label: 'Use my current location', hint: "If you're at the clinic now", icon: 'crosshairs-gps' },
  { key: 'map_picker', label: 'Choose on the map', hint: 'Drop the pin yourself', icon: 'map-search-outline' },
  { key: 'address_search', label: 'Search an address', hint: 'Find by street or area', icon: 'magnify' },
]

export default function LocationPicker({
  onConfirm, onCancel,
}: {
  onConfirm: (loc: ConfirmedLocation) => void
  onCancel: () => void
}) {
  const [method, setMethod] = useState<Method | null>(null)
  const [link, setLink] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResolvedLocation | null>(null)
  // Live pin position while the doctor drags it, before confirming.
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)

  const grow = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(grow, {
      toValue: method ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [method, grow])

  const run = useCallback(async (input: Parameters<typeof resolveLocation>[0]) => {
    setBusy(true); setError('')
    try {
      const r = await resolveLocation(input)
      if (!r.resolved) {
        // Keep any link so it can still be saved next to a hand-placed pin.
        setError(r.reason ?? 'Could not work out that location.')
        if (input.mode === 'google_maps_link') {
          setResult({ resolved: false, google_maps_url: r.google_maps_url ?? input.url, name: r.name })
          setMethod('map_picker')
        }
        return
      }
      setResult(r)
      setPin({ lat: r.latitude as number, lng: r.longitude as number })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }, [])

  function useCurrentLocation() {
    setError('')
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('This device cannot share its location. Try one of the other options.')
      return
    }
    setBusy(true)
    // Permission is only requested here — after an explicit tap, never on load.
    navigator.geolocation.getCurrentPosition(
      (pos) => run({
        mode: 'current_location',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err) => {
        setBusy(false)
        setError(
          err.code === 1
            ? 'Location permission was denied. Paste a Google Maps link or drop the pin instead.'
            : 'Could not get your location. Try another option.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  function confirm() {
    if (!pin) return
    onConfirm({
      latitude: pin.lat,
      longitude: pin.lng,
      name: result?.name ?? null,
      formatted_address: result?.formatted_address ?? null,
      city: result?.city ?? null,
      governorate: result?.governorate ?? null,
      google_maps_url: result?.google_maps_url ?? null,
      // If they moved the pin after resolving, the pin is the real source.
      location_source: movedPin() ? 'map_picker' : (result?.location_source ?? 'map_picker'),
    })
  }

  function movedPin(): boolean {
    if (!result?.latitude || !pin) return true
    return Math.abs(result.latitude - pin.lat) > 1e-6
        || Math.abs((result.longitude as number) - pin.lng) > 1e-6
  }

  // ---- Confirm step: shared by every method --------------------------------
  if (pin) {
    const outside = result?.outside_lebanon
    const approximate = result?.precision === 'approximate' && !movedPin()
    return (
      <View style={styles.card}>
        <Text style={type.h2}>Is this the right spot?</Text>
        <Text style={[type.sub, { marginTop: 3 }]}>
          Drag the pin if it is not exactly on the building.
        </Text>

        <View style={styles.mapBox}>
          <MapPointPicker
            latitude={pin.lat}
            longitude={pin.lng}
            onChange={(lat, lng) => setPin({ lat, lng })}
          />
        </View>

        {result?.name ? (
          <Text style={[type.h2, { marginTop: 12 }]} numberOfLines={2}>{result.name}</Text>
        ) : null}
        {result?.formatted_address ? (
          <Text style={[type.sub, { marginTop: 3 }]} numberOfLines={3}>{result.formatted_address}</Text>
        ) : null}

        {approximate ? (
          <View style={[styles.note, { backgroundColor: colors.amberBg }]}>
            <Feather name="alert-triangle" size={14} color={colors.amber} />
            <Text style={[styles.noteText, { color: colors.amber }]}>
              This came from the map view rather than the place marker, so it may be a little off.
              Please check the pin.
            </Text>
          </View>
        ) : null}

        {outside ? (
          <View style={[styles.note, { backgroundColor: colors.dangerBg }]}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={[styles.noteText, { color: colors.danger }]}>
              This point is outside Lebanon. You can still save it, but patients search Lebanon.
            </Text>
          </View>
        ) : null}

        <Text style={styles.coords}>
          {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => { setPin(null); setResult(null); setMethod(null) }} style={styles.secondary}>
            <Text style={styles.secondaryText}>Start over</Text>
          </Pressable>
          <Pressable onPress={confirm} style={styles.primary}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.primaryText}>Confirm location</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // ---- Method chooser ------------------------------------------------------
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.h2, { flex: 1 }]}>Add clinic location</Text>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Feather name="x" size={19} color={colors.textFaint} />
        </Pressable>
      </View>

      <View style={{ marginTop: 14, gap: 9 }}>
        {METHODS.map((m) => {
          const active = m.key === method
          return (
            <View key={m.key}>
              <Pressable
                onPress={() => {
                  setError('')
                  setMethod(active ? null : m.key)
                  if (m.key === 'current_location' && !active) useCurrentLocation()
                  if (m.key === 'map_picker' && !active) {
                    // Start the picker over Beirut; they pan from there.
                    setResult({ resolved: true, location_source: 'map_picker' })
                    setPin({ lat: 33.8938, lng: 35.5018 })
                  }
                }}
                style={({ pressed }) => [
                  styles.method, active && styles.methodOn, pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.methodIcon, active && { backgroundColor: colors.doc }]}>
                  <MaterialCommunityIcons
                    name={m.icon as never} size={19} color={active ? '#fff' : colors.doc}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={type.small}>{m.hint}</Text>
                </View>
                {busy && active ? <ActivityIndicator size="small" color={colors.doc} /> : null}
              </Pressable>

              {/* The chosen method expands in place rather than replacing the list */}
              {active && m.key === 'google_maps_link' ? (
                <Animated.View style={[styles.expand, { opacity: grow }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Paste a Google Maps link"
                    placeholderTextColor={colors.textFaint}
                    value={link}
                    onChangeText={(v) => { setLink(v); if (error) setError('') }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                  />
                  <Text style={[type.small, { marginTop: 6 }]}>
                    Open your clinic in Google Maps, tap Share, copy the link, then paste it here.
                  </Text>
                  <Pressable
                    onPress={() => run({ mode: 'google_maps_link', url: link })}
                    disabled={busy || !link.trim()}
                    style={[styles.go, (busy || !link.trim()) && { opacity: 0.5 }]}
                  >
                    <Text style={styles.goText}>Find this place</Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              {active && m.key === 'address_search' ? (
                <Animated.View style={[styles.expand, { opacity: grow }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Hamra Street, Beirut"
                    placeholderTextColor={colors.textFaint}
                    value={address}
                    onChangeText={(v) => { setAddress(v); if (error) setError('') }}
                    onSubmitEditing={() => run({ mode: 'address_search', query: address })}
                    returnKeyType="search"
                  />
                  <Pressable
                    onPress={() => run({ mode: 'address_search', query: address })}
                    disabled={busy || address.trim().length < 3}
                    style={[styles.go, (busy || address.trim().length < 3) && { opacity: 0.5 }]}
                  >
                    <Text style={styles.goText}>Search</Text>
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
          )
        })}
      </View>

      {error ? (
        <View style={[styles.note, { backgroundColor: colors.dangerBg, marginTop: 14 }]}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={[styles.noteText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 18,
    borderWidth: 1.5, borderColor: colors.docSoft, ...shadow.card,
  },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  methodOn: { borderColor: colors.doc, backgroundColor: colors.docSofter },
  methodIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  methodLabel: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  expand: { paddingTop: 10, paddingHorizontal: 2 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 11, fontSize: 14.5,
    color: colors.ink, backgroundColor: '#FAFBFD', minHeight: 44,
  },
  go: {
    marginTop: 10, alignItems: 'center', paddingVertical: 12,
    borderRadius: radius.md, backgroundColor: colors.doc,
  },
  goText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  mapBox: {
    height: 220, borderRadius: radius.md, overflow: 'hidden', marginTop: 12,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg,
  },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: radius.sm, padding: 10, marginTop: 10,
  },
  noteText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  coords: { ...type.small, marginTop: 10, fontVariant: ['tabular-nums'] },
  primary: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.doc,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  secondary: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  secondaryText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
})
