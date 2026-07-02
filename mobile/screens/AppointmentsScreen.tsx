import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getMyAppointments, cancelAppointment, type Appointment } from '../lib/api'
import { colors, radius, statusColors, type } from '../lib/theme'
import { Avatar, Badge, Card, EmptyState, GhostButton } from '../components/ui'
import { FadeInUp } from '../components/motion'
import { notify } from '../lib/notify'

type Tab = 'upcoming' | 'past'

function isUpcoming(a: Appointment): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return a.status === 'scheduled' && new Date(`${a.appointment_date}T00:00:00`) >= today
}

export default function AppointmentsScreen({ onBook }: { onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setAppts(await getMyAppointments()) }
    catch { setAppts([]) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await cancelAppointment(id)
      setConfirmId(null)
      load()
    } catch (e) {
      notify('Could not cancel', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setCancellingId(null)
    }
  }

  const shown = appts.filter((a) => (tab === 'upcoming' ? isUpcoming(a) : !isUpcoming(a)))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingHorizontal: 20 }}>
        <Text style={type.h1}>My visits</Text>
        <View style={styles.tabs}>
          {(['upcoming', 'past'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          showsVerticalScrollIndicator={false}
        >
          {shown.length === 0 ? (
            <View>
              <EmptyState
                icon={tab === 'upcoming' ? 'calendar' : 'archive'}
                title={tab === 'upcoming' ? 'No upcoming visits' : 'No past visits'}
                sub={tab === 'upcoming' ? 'Book a visit with a specialist in a couple of taps.' : undefined}
              />
              {tab === 'upcoming' && <GhostButton label="Find a doctor" onPress={onBook} style={{ marginHorizontal: 40 }} />}
            </View>
          ) : (
            shown.map((a, i) => {
              const sc = statusColors[a.status] ?? statusColors.scheduled
              const canCancel = isUpcoming(a)
              return (
                <FadeInUp key={a.id} delay={Math.min(i, 5) * 60}>
                <Card style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                    <Avatar name={a.doctor_name ?? 'Dr'} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.h2} numberOfLines={1}>{a.doctor_name}</Text>
                      {a.specialty_name ? <Text style={[type.sub, { marginTop: 1 }]}>{a.specialty_name}</Text> : null}
                    </View>
                    <Badge label={sc.label} bg={sc.bg} fg={sc.fg} />
                  </View>

                  <View style={styles.metaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="calendar" size={14} color={colors.textMuted} />
                      <Text style={styles.metaItem}>{new Date(`${a.appointment_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="clock" size={14} color={colors.textMuted} />
                      <Text style={styles.metaItem}>{a.start_time.slice(0, 5)}</Text>
                    </View>
                  </View>
                  {a.reason ? <Text style={[type.sub, { marginTop: 8, fontStyle: 'italic' }]} numberOfLines={2}>“{a.reason}”</Text> : null}

                  {canCancel && (
                    confirmId === a.id ? (
                      <View style={styles.cancelRow}>
                        <Text style={[type.sub, { flex: 1 }]}>Cancel this visit?</Text>
                        <Pressable onPress={() => setConfirmId(null)} style={styles.keepBtn}>
                          <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 13 }}>Keep</Text>
                        </Pressable>
                        <Pressable onPress={() => handleCancel(a.id)} style={styles.confirmCancelBtn} disabled={cancellingId === a.id}>
                          {cancellingId === a.id
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Yes, cancel</Text>}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => setConfirmId(a.id)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>Cancel visit</Text>
                      </Pressable>
                    )
                  )}
                </Card>
                </FadeInUp>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row', backgroundColor: '#E9ECF3', borderRadius: radius.md,
    padding: 4, marginTop: 16, marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.card },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.ink, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row', gap: 18, marginTop: 13, paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  metaItem: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  cancelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  keepBtn: {
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  confirmCancelBtn: {
    backgroundColor: colors.danger, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 92, alignItems: 'center',
  },
})
