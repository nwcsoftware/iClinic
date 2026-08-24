import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import {
  getMyWorkplaces, addWorkplace, updateWorkplace, removeWorkplace,
  type DoctorWorkplace, type LocationType,
} from '../../lib/mapApi'
import { colors, radius, shadow, type } from '../../lib/theme'
import { Card, EmptyState, TopBar } from '../../components/ui'
import { FadeInUp } from '../../components/motion'
import LocationPicker, { type ConfirmedLocation } from '../../components/map/LocationPicker'

const DAYS = [
  { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' }, { n: 0, label: 'Sun' },
]

const TYPES: { key: LocationType; label: string; icon: string }[] = [
  { key: 'hospital', label: 'Hospital', icon: 'hospital-building' },
  { key: 'clinic', label: 'Clinic', icon: 'stethoscope' },
  { key: 'private_clinic', label: 'Private clinic', icon: 'door' },
  { key: 'medical_center', label: 'Medical center', icon: 'medical-bag' },
]

// Where a doctor works. One doctor, several places, different days at each.
//
// Adding a place never creates a duplicate hospital — the server matches on a
// normalised name and city, so a doctor typing "saint george hospital" joins
// the same record (and the same map marker) as everyone else there.
export default function DoctorLocationsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<DoctorWorkplace[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try { setItems(await getMyWorkplaces()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load your workplaces') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleDay(w: DoctorWorkplace, day: number) {
    const next = w.working_days.includes(day)
      ? w.working_days.filter((d) => d !== day)
      : [...w.working_days, day].sort()
    // Optimistic: tapping a day should feel instant.
    setItems((list) => list.map((x) => (x.id === w.id ? { ...x, working_days: next } : x)))
    try { await updateWorkplace({ id: w.id, working_days: next }) }
    catch { load() }
  }

  async function makePrimary(w: DoctorWorkplace) {
    setItems((list) => list.map((x) => ({ ...x, is_primary: x.id === w.id })))
    try { await updateWorkplace({ id: w.id, is_primary: true }) }
    catch { load() }
  }

  async function remove(w: DoctorWorkplace) {
    setItems((list) => list.filter((x) => x.id !== w.id))
    try { await removeWorkplace(w.id) }
    catch { load() }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        title="My workplaces"
        onBack={onBack}
        right={
          <Pressable onPress={() => { setAdding((a) => !a); setNotice('') }} hitSlop={10}>
            <Feather name={adding ? 'x' : 'plus'} size={20} color={colors.doc} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {notice ? (
            <View style={styles.notice}>
              <Feather name="info" size={15} color={colors.doc} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {adding ? (
            <AddWorkplaceForm
              onCancel={() => setAdding(false)}
              onAdded={async (msg) => { setAdding(false); setNotice(msg); await load() }}
              onError={setError}
            />
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.doc} style={{ marginTop: 40 }} />
          ) : items.length === 0 && !adding ? (
            <EmptyState
              icon="map-pin"
              title="No workplaces yet"
              sub="Add the hospitals and clinics you work at. They appear on the patient map, and patients see where their appointment will be."
            />
          ) : (
            items.map((w, i) => (
              <FadeInUp key={w.id} delay={Math.min(i, 5) * 55}>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={styles.icon}>
                      <MaterialCommunityIcons
                        name={(w.location?.type === 'hospital' ? 'hospital-building' : 'stethoscope') as never}
                        size={20} color={colors.doc}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.h2} numberOfLines={2}>{w.location?.name ?? 'Unknown place'}</Text>
                      <Text style={[type.sub, { marginTop: 2 }]}>
                        {[w.location?.city, w.location?.governorate].filter(Boolean).join(' · ') || 'Location not set'}
                      </Text>
                      {w.location && w.location.latitude == null ? (
                        <View style={styles.warnRow}>
                          <Feather name="alert-triangle" size={12} color={colors.amber} />
                          <Text style={styles.warnText}>Not on the map yet — we could not find these coordinates</Text>
                        </View>
                      ) : null}
                    </View>
                    <Pressable onPress={() => remove(w)} hitSlop={10}>
                      <Feather name="trash-2" size={17} color={colors.danger} />
                    </Pressable>
                  </View>

                  <Text style={[type.label, { marginTop: 15, marginBottom: 8 }]}>Days you work here</Text>
                  <View style={styles.dayRow}>
                    {DAYS.map((d) => {
                      const on = w.working_days.includes(d.n)
                      return (
                        <Pressable
                          key={d.n}
                          onPress={() => toggleDay(w, d.n)}
                          style={[styles.day, on && styles.dayOn]}
                        >
                          <Text style={[styles.dayText, on && { color: '#fff' }]}>{d.label}</Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  <Pressable
                    onPress={() => !w.is_primary && makePrimary(w)}
                    style={styles.primaryRow}
                  >
                    <Feather
                      name={w.is_primary ? 'check-circle' : 'circle'}
                      size={16}
                      color={w.is_primary ? colors.doc : colors.textFaint}
                    />
                    <Text style={[styles.primaryText, w.is_primary && { color: colors.doc }]}>
                      {w.is_primary ? 'Main workplace' : 'Set as main workplace'}
                    </Text>
                  </Pressable>
                </Card>
              </FadeInUp>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function AddWorkplaceForm({
  onCancel, onAdded, onError,
}: {
  onCancel: () => void
  onAdded: (notice: string) => void
  onError: (e: string) => void
}) {
  const [name, setName] = useState('')
  const [placeType, setPlaceType] = useState<LocationType>('hospital')
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [place, setPlace] = useState<ConfirmedLocation | null>(null)

  // A confirmed pin can fill in the name when the doctor has not typed one —
  // Google and OSM usually know what the building is called.
  function accept(loc: ConfirmedLocation) {
    setPlace(loc)
    setPicking(false)
    if (!name.trim() && loc.name) setName(loc.name)
  }

  async function submit() {
    if (!name.trim()) { onError('What is the place called?'); return }
    if (!place) { onError('Set the location so patients can find it.'); return }
    setSaving(true)
    onError('')
    try {
      const res = await addWorkplace({
        name: name.trim(),
        type: placeType,
        city: place.city ?? undefined,
        governorate: place.governorate ?? undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        formatted_address: place.formatted_address,
        google_maps_url: place.google_maps_url,
        location_source: place.location_source,
      })
      const msg = res.reused
        ? 'Linked you to this place, which was already on the map.'
        : 'Added to your workplaces and placed on the map.'
      onAdded(msg)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not add that place')
    } finally {
      setSaving(false)
    }
  }

  if (picking) {
    return (
      <FadeInUp>
        <View style={{ marginBottom: 18 }}>
          <LocationPicker onConfirm={accept} onCancel={() => setPicking(false)} />
        </View>
      </FadeInUp>
    )
  }

  return (
    <FadeInUp>
      <View style={styles.form}>
        <Text style={type.h2}>Add a workplace</Text>

        <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Saint George Hospital"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={setName}
        />

        <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Type</Text>
        <View style={styles.chipWrap}>
          {TYPES.map((t) => {
            const on = t.key === placeType
            return (
              <Pressable key={t.key} onPress={() => setPlaceType(t.key)} style={[styles.chip, on && styles.chipOn]}>
                <MaterialCommunityIcons name={t.icon as never} size={14} color={on ? '#fff' : colors.doc} />
                <Text style={[styles.chipText, on && { color: '#fff' }]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Location</Text>
        {place ? (
          <Pressable onPress={() => setPicking(true)} style={styles.placeSet}>
            <View style={styles.placeIcon}>
              <Feather name="check" size={15} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }} numberOfLines={2}>
                {place.formatted_address ?? 'Pin placed'}
              </Text>
              <Text style={[type.small, { marginTop: 1 }]}>
                {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)} · tap to change
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => setPicking(true)} style={styles.placeEmpty}>
            <MaterialCommunityIcons name="map-marker-plus-outline" size={19} color={colors.doc} />
            <Text style={styles.placeEmptyText}>Set the exact location</Text>
            <Feather name="chevron-right" size={17} color={colors.textFaint} />
          </Pressable>
        )}
        <Text style={[type.small, { marginTop: 6 }]}>
          Paste a Google Maps link, use your current position, or drop a pin. This is what patient
          directions will point at.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable onPress={onCancel} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={submit} disabled={saving} style={styles.save}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Add</Text>}
          </Pressable>
        </View>
      </View>
    </FadeInUp>
  )
}

const styles = StyleSheet.create({
  placeEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.docSoft, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 14, backgroundColor: colors.docSofter,
  },
  placeEmptyText: { flex: 1, color: colors.doc, fontWeight: '800', fontSize: 14.5 },
  placeSet: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1.5, borderColor: colors.docSoft, borderRadius: radius.md,
    padding: 12, backgroundColor: colors.card,
  },
  placeIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  day: {
    minWidth: 44, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  dayOn: { backgroundColor: colors.doc, borderColor: colors.doc },
  dayText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  primaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  primaryText: { fontSize: 13.5, fontWeight: '700', color: colors.textMuted },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  warnText: { flex: 1, fontSize: 11.5, color: colors.amber, fontWeight: '600' },
  form: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, marginBottom: 18,
    borderWidth: 1.5, borderColor: colors.docSoft, ...shadow.card,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 13,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.doc, borderColor: colors.doc },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  cancel: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  save: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13,
    borderRadius: radius.md, backgroundColor: colors.doc, minHeight: 46,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14,
    backgroundColor: colors.docSofter, borderRadius: radius.md, padding: 12,
  },
  noticeText: { flex: 1, color: colors.doc, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600' },
})
