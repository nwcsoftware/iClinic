import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getMyAppointments, cancelAppointment, submitReview, type Appointment } from '../lib/api'
import { colors, radius, statusColors, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { Avatar, Badge, Card, EmptyState, GhostButton, StarRating } from '../components/ui'
import VisitLocationCard from '../components/VisitLocationCard'
import { FadeInUp } from '../components/motion'
import { notify } from '../lib/notify'

type Tab = 'upcoming' | 'past'

function isUpcoming(a: Appointment): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return a.status === 'scheduled' && new Date(`${a.appointment_date}T00:00:00`) >= today
}

export default function AppointmentsScreen({ onBook }: { onBook: () => void }) {
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
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
      notify(t('visits.cancelFailed'), e instanceof Error ? e.message : undefined)
    } finally {
      setCancellingId(null)
    }
  }

  const shown = appts.filter((a) => (tab === 'upcoming' ? isUpcoming(a) : !isUpcoming(a)))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingHorizontal: 20 }}>
        <Text style={type.h1}>{t('visits.title')}</Text>
        <View style={styles.tabs}>
          {(['upcoming', 'past'] as Tab[]).map((tb) => (
            <Pressable key={tb} onPress={() => setTab(tb)} style={[styles.tab, tab === tb && styles.tabActive]}>
              <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
                {tb === 'upcoming' ? t('visits.upcoming') : t('visits.past')}
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
                title={tab === 'upcoming' ? t('visits.noUpcoming') : t('visits.noPast')}
                sub={tab === 'upcoming' ? t('visits.noUpcomingSub') : undefined}
              />
              {tab === 'upcoming' && <GhostButton label={t('visits.findDoctor')} onPress={onBook} style={{ marginHorizontal: 40 }} />}
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
                    <Badge label={t(('status.' + a.status) as never)} bg={sc.bg} fg={sc.fg} />
                  </View>

                  <View style={styles.metaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="calendar" size={14} color={colors.textMuted} />
                      <Text style={styles.metaItem}>{new Date(`${a.appointment_date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="clock" size={14} color={colors.textMuted} />
                      <Text style={styles.metaItem}>{a.start_time.slice(0, 5)}</Text>
                    </View>
                  </View>
                  {a.reason ? <Text style={[type.sub, { marginTop: 8, fontStyle: 'italic' }]} numberOfLines={2}>“{a.reason}”</Text> : null}

                  {/* Where to go. Shown for anything still upcoming even when
                      the doctor has not set a place, because "not set yet" is
                      the answer a patient needs before travelling. */}
                  {isUpcoming(a) || a.location ? (
                    <View style={{ marginTop: 10 }}>
                      <VisitLocationCard place={a.location ?? null} compact />
                    </View>
                  ) : null}

                  {a.can_review ? (
                    <ReviewBlock appointment={a} onSaved={load} />
                  ) : null}

                  {canCancel && (
                    confirmId === a.id ? (
                      <View style={styles.cancelRow}>
                        <Text style={[type.sub, { flex: 1 }]}>{t('visits.confirmCancel')}</Text>
                        <Pressable onPress={() => setConfirmId(null)} style={styles.keepBtn}>
                          <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 13 }}>{t('visits.keep')}</Text>
                        </Pressable>
                        <Pressable onPress={() => handleCancel(a.id)} style={styles.confirmCancelBtn} disabled={cancellingId === a.id}>
                          {cancellingId === a.id
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('visits.yesCancel')}</Text>}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => setConfirmId(a.id)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>{t('visits.cancel')}</Text>
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

// Rate a past visit, or edit a rating already given.
function ReviewBlock({ appointment, onSaved }: { appointment: Appointment; onSaved: () => void }) {
  const { t } = useI18n()
  const already = appointment.my_rating ?? 0
  const [editing, setEditing] = useState(already === 0)
  const [rating, setRating] = useState(already)
  const [comment, setComment] = useState(appointment.my_comment ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (rating < 1) return
    setSaving(true)
    try {
      await submitReview({ appointment_id: appointment.id, rating, comment: comment.trim() || undefined })
      setEditing(false)
      onSaved()
    } catch (e) {
      notify(t('reviews.failed'), e instanceof Error ? e.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <View style={styles.reviewDone}>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewDoneLabel}>{t('reviews.yourRating')}</Text>
          <View style={{ marginTop: 5 }}><StarRating value={rating} size={17} /></View>
        </View>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13 }}>{t('reviews.edit')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.reviewBox}>
      <Text style={type.h2}>{t('reviews.rateVisit')}</Text>
      <Text style={[type.sub, { marginTop: 2 }]}>{t('reviews.rateSub')}</Text>
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <StarRating value={rating} onChange={setRating} />
      </View>
      {rating > 0 ? (
        <>
          <TextInput
            style={styles.reviewInput}
            placeholder={t('reviews.comment')}
            placeholderTextColor={colors.textFaint}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [styles.reviewBtn, pressed && { backgroundColor: colors.brandDark }, saving && { opacity: 0.6 }]}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14.5 }}>{t('reviews.submit')}</Text>}
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  reviewBox: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  reviewInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, marginTop: 14,
    fontSize: 14.5, color: colors.ink, backgroundColor: '#FAFBFD',
    minHeight: 62, textAlignVertical: 'top',
  },
  reviewBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 46,
  },
  reviewDone: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  reviewDoneLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
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
