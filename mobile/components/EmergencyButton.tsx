import { useEffect, useRef, useState } from 'react'
import { useTour } from '../lib/tour'
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import {
  COUNTRIES, getCountry, loadSavedCountry, saveCountry, dial, type EmergencyService,
} from '../lib/emergency'

function ServiceRow({ service }: { service: EmergencyService }) {
  const icon = service.key === 'police' ? 'shield' : service.key === 'fire' ? 'alert-triangle' : service.key === 'ambulance' ? 'activity' : 'phone-call'
  return (
    <Pressable
      onPress={() => dial(service.number)}
      style={({ pressed }) => [styles.serviceRow, pressed && { backgroundColor: colors.dangerBg }]}
    >
      <View style={styles.serviceIcon}><Feather name={icon} size={17} color={colors.danger} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceLabel}>{service.label}</Text>
        <Text style={styles.serviceNumber}>{service.number}</Text>
      </View>
      <Feather name="phone" size={18} color={colors.danger} />
    </Pressable>
  )
}

export default function EmergencyButton() {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [countryCode, setCountryCode] = useState('LB')

  useEffect(() => { loadSavedCountry().then(setCountryCode) }, [])

  const country = getCountry(countryCode)
  const primary = country.services[0]

  // Registered directly rather than wrapped in a <TourTarget>: the button is
  // absolutely positioned, so a wrapper View would become its containing block
  // and throw it into the wrong corner.
  const fabRef = useRef<View | null>(null)
  const { register } = useTour()
  useEffect(() => {
    register('emergency', fabRef.current)
    return () => register('emergency', null)
  }, [register])

  function choose(code: string) {
    setCountryCode(code)
    saveCountry(code)
    setPicking(false)
  }

  return (
    <>
      <Pressable
        ref={fabRef}
        onPress={() => setOpen(true)}
        style={[styles.fab, { bottom: Math.max(insets.bottom, 10) + 68 }]}
        hitSlop={6}
      >
        <Feather name="phone-call" size={20} color="#fff" />
      </Pressable>

      {open && !picking && (
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <View style={styles.headerIcon}><Feather name="alert-triangle" size={20} color={colors.danger} /></View>
              <View style={{ flex: 1 }}>
                <Text style={type.h1}>{t('emergency.title')}</Text>
                <Text style={[type.sub, { marginTop: 2 }]}>{t('emergency.sub')}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textFaint} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => dial(primary.number)}
              style={({ pressed }) => [styles.callBtn, pressed && { backgroundColor: '#B91C1C' }]}
            >
              <Feather name="phone" size={22} color="#fff" />
              <Text style={styles.callBtnText}>{t('emergency.callNow', { number: primary.number })}</Text>
            </Pressable>

            <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
              {country.services.map((s, i) => (
                <ServiceRow key={`${s.key}-${i}`} service={s} />
              ))}

              <Pressable onPress={() => setPicking(true)} style={styles.countryRow}>
                <Feather name="map-pin" size={16} color={colors.textMuted} />
                <Text style={styles.countryText}>{t('emergency.country', { country: country.name })}</Text>
                <Feather name="chevron-right" size={16} color={colors.textFaint} />
              </Pressable>

              <Text style={styles.disclaimer}>{t('emergency.disclaimer')}</Text>
            </ScrollView>
          </View>
        </View>
      )}

      {picking && (
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicking(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20), maxHeight: '75%' }]}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={type.h1}>{t('emergency.pickCountry')}</Text>
              <Pressable onPress={() => setPicking(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textFaint} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => choose(c.code)}
                  style={({ pressed }) => [styles.countryOption, pressed && { backgroundColor: colors.brandSofter }]}
                >
                  <Text style={styles.countryOptionText}>{c.name}</Text>
                  {c.code === countryCode ? <Feather name="check" size={18} color={colors.brand} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 16, width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
    zIndex: 20, ...shadow.raised,
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,21,38,0.45)', justifyContent: 'flex-end', zIndex: 30,
  },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '85%',
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 16,
  },
  callBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  serviceIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.dangerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  serviceLabel: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  serviceNumber: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginTop: 4,
  },
  countryText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  disclaimer: { fontSize: 12, color: colors.textFaint, lineHeight: 17, marginTop: 14, marginBottom: Platform.OS === 'web' ? 8 : 24 },
  countryOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  countryOptionText: { fontSize: 15, color: colors.ink, fontWeight: '600' },
})
