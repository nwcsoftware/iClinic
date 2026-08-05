import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { getMyPrescriptions, type Medication, type Prescription } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { EmptyState } from '../components/ui'
import { AmbientBackground, FadeInUp } from '../components/motion'

const ROUTE_ICON: Record<string, string> = {
  oral: 'pill', topical: 'lotion-outline', injection: 'needle',
  inhaled: 'air-filter', drops: 'eyedropper', other: 'medical-bag',
}

// One medicine, spelled out: how much, how often, at what times, for how long.
function MedCard({ med, faded }: { med: Medication; faded: boolean }) {
  const { t, locale } = useI18n()
  const icon = ROUTE_ICON[med.route ?? 'other'] ?? 'pill'

  const rows: { label: string; value: string }[] = []
  if (med.dosage) rows.push({ label: t('meds.howMuch'), value: med.dosage })
  if (med.frequency) rows.push({ label: t('meds.howOften'), value: med.frequency })
  if (med.times_of_day?.length) rows.push({ label: t('meds.when'), value: med.times_of_day.join(' · ') })
  if (med.duration) rows.push({ label: t('meds.forHowLong'), value: med.duration })
  if (med.route) {
    rows.push({ label: t('meds.route'), value: t(`route.${med.route}` as never) })
  }

  const until = med.ends_on
    ? t('meds.until', { date: new Date(`${med.ends_on}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })
    : t('meds.ongoing')

  return (
    <View style={[styles.medCard, faded && { opacity: 0.62 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.medIcon}>
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20} color={colors.brand}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2} numberOfLines={2}>{med.medication_name}</Text>
          <Text style={[type.small, { marginTop: 2 }]}>{until}</Text>
        </View>
      </View>

      {rows.length > 0 ? (
        <View style={styles.rows}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {med.notes ? (
        <View style={styles.noteBox}>
          <Feather name="info" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={[type.sub, { flex: 1 }]}>{med.notes}</Text>
        </View>
      ) : null}
    </View>
  )
}

function RxBlock({ rx }: { rx: Prescription }) {
  const { t, locale } = useI18n()
  const when = new Date(rx.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <View style={{ marginBottom: 22 }}>
      <View style={styles.rxHeader}>
        <Text style={styles.rxDoctor}>{t('meds.prescribedBy', { name: rx.doctor_name })}</Text>
        <Text style={type.small}>{when}</Text>
      </View>
      {rx.diagnosis_note ? (
        <View style={styles.diagBox}>
          <Text style={styles.diagLabel}>{t('meds.diagnosis')}</Text>
          <Text style={[type.body, { marginTop: 2 }]}>{rx.diagnosis_note}</Text>
        </View>
      ) : null}
      {rx.items.map((m) => <MedCard key={m.id} med={m} faded={!rx.active} />)}
      {rx.notes ? (
        <View style={styles.noteBox}>
          <Feather name="file-text" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={[type.sub, { flex: 1 }]}>{rx.notes}</Text>
        </View>
      ) : null}
    </View>
  )
}

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const [items, setItems] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try { setItems(await getMyPrescriptions()) }
    catch { /* pull to refresh retries */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const active = items.filter((p) => p.active)
  const finished = items.filter((p) => !p.active)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AmbientBackground tone="soft" />
      <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingHorizontal: 20 }}>
        <Text style={type.h1}>{t('meds.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <EmptyState icon="clipboard" title={t('meds.empty')} sub={t('meds.emptySub')} />
        ) : (
          <>
            {active.length > 0 ? (
              <FadeInUp>
                <Text style={[type.label, { marginBottom: 12 }]}>{t('meds.active')}</Text>
                {active.map((rx) => <RxBlock key={rx.id} rx={rx} />)}
              </FadeInUp>
            ) : null}

            {finished.length > 0 ? (
              <FadeInUp delay={80}>
                <Text style={[type.label, { marginTop: active.length ? 8 : 0, marginBottom: 12 }]}>
                  {t('meds.finished')}
                </Text>
                {finished.map((rx) => <RxBlock key={rx.id} rx={rx} />)}
              </FadeInUp>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  rxHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingHorizontal: 2,
  },
  rxDoctor: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  diagBox: {
    backgroundColor: colors.brandSofter, borderRadius: radius.md, padding: 12, marginBottom: 10,
  },
  diagLabel: { fontSize: 11.5, fontWeight: '800', color: colors.brand },
  medCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card,
  },
  medIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rows: {
    marginTop: 13, paddingTop: 12, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowLabel: { width: 116, fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 14.5, color: colors.ink, fontWeight: '700' },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4,
    backgroundColor: colors.bg, borderRadius: radius.sm, padding: 11,
  },
})
