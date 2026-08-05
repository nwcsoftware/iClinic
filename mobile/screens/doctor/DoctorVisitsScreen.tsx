import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getDoctorVisits, type DoctorVisit } from '../../lib/doctorApi'
import { colors, radius, statusColors, type } from '../../lib/theme'
import { Avatar, Badge, Card, EmptyState, TopBar } from '../../components/ui'
import { FadeInUp } from '../../components/motion'

function dayLabel(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function DoctorVisitsScreen({
  onBack, onPrescribe,
}: {
  onBack: () => void
  onPrescribe: (v: DoctorVisit) => void
}) {
  const insets = useSafeAreaInsets()
  const [scope, setScope] = useState<'past' | 'upcoming'>('past')
  const [visits, setVisits] = useState<DoctorVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setVisits(await getDoctorVisits(scope)) }
    catch { setVisits([]) }
    finally { setLoading(false); setRefreshing(false) }
  }, [scope])

  useEffect(() => { load() }, [load])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="My visits" onBack={onBack} />

      <View style={styles.tabs}>
        {(['past', 'upcoming'] as const).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)}
            style={[styles.tab, scope === s && styles.tabOn]}>
            <Text style={[styles.tabText, scope === s && { color: '#fff' }]}>
              {s === 'past' ? 'Finished' : 'Upcoming'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.doc} style={{ marginTop: 40 }} />
        ) : visits.length === 0 ? (
          <EmptyState icon="calendar" title="No visits here"
            sub={scope === 'past' ? 'Finished visits will show up here.' : 'Upcoming bookings will show up here.'} />
        ) : (
          visits.map((v, i) => {
            const sc = statusColors[v.status] ?? statusColors.scheduled
            const canPrescribe = v.is_past
            return (
              <FadeInUp key={v.id} delay={Math.min(i, 6) * 50}>
                <Card style={{ marginBottom: 11 }}
                  onPress={canPrescribe ? () => onPrescribe(v) : undefined}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <Avatar name={v.patient_name} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.h2} numberOfLines={1}>{v.patient_name}</Text>
                      <Text style={[type.sub, { marginTop: 2 }]}>
                        {dayLabel(v.appointment_date)} · {v.start_time.slice(0, 5)}
                      </Text>
                      {v.reason ? (
                        <Text style={[type.small, { marginTop: 2 }]} numberOfLines={1}>{v.reason}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Badge label={sc.label} bg={sc.bg} fg={sc.fg} />
                      {v.prescription_id ? (
                        <View style={styles.rxTag}>
                          <Feather name="check" size={11} color="#0E7E58" />
                          <Text style={styles.rxTagText}>Prescribed</Text>
                        </View>
                      ) : canPrescribe ? (
                        <View style={styles.addTag}>
                          <Feather name="plus" size={11} color={colors.doc} />
                          <Text style={styles.addTagText}>Prescribe</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </FadeInUp>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  tabOn: { backgroundColor: colors.doc, borderColor: colors.doc },
  tabText: { fontWeight: '700', fontSize: 14, color: colors.textMuted },
  rxTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.successBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  rxTagText: { color: '#0E7E58', fontSize: 10.5, fontWeight: '800' },
  addTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.docSofter, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  addTagText: { color: colors.doc, fontSize: 10.5, fontWeight: '800' },
})
