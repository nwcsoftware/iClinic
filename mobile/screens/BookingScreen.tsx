import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getSlots, book, getDoctorReviews, type Doctor, type DoctorReviews } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { Avatar, PrimaryButton, Rating, StarRating, TopBar } from '../components/ui'
import { FadeInUp, ScaleIn } from '../components/motion'
import { notify } from '../lib/notify'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nextDays(n: number): Date[] {
  const out: Date[] = []
  const base = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    out.push(d)
  }
  return out
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BookingScreen({
  doctor, reason: initialReason, onBack, onDone,
}: {
  doctor: Doctor
  reason: string
  onBack: () => void
  onDone: () => void
}) {
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const days = nextDays(14)
  const [selectedDate, setSelectedDate] = useState(ymd(days[0]))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [reason, setReason] = useState(initialReason)
  const [saving, setSaving] = useState(false)
  const [booked, setBooked] = useState<{ date: string; slot: string } | null>(null)
  const [reviews, setReviews] = useState<DoctorReviews | null>(null)

  useEffect(() => {
    getDoctorReviews(doctor.id).then(setReviews).catch(() => {})
  }, [doctor.id])

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true)
    setSelectedSlot(null)
    try { setSlots(await getSlots(doctor.id, date)) }
    catch { setSlots([]) }
    finally { setLoadingSlots(false) }
  }, [doctor.id])

  useEffect(() => { loadSlots(selectedDate) }, [selectedDate, loadSlots])

  async function confirm() {
    if (!selectedSlot) return
    setSaving(true)
    try {
      await book({ doctor_id: doctor.id, date: selectedDate, start_time: selectedSlot, reason: reason || undefined })
      setBooked({ date: selectedDate, slot: selectedSlot })
    } catch (e) {
      notify(t('booking.failed'), e instanceof Error ? e.message : undefined)
      loadSlots(selectedDate)
    } finally {
      setSaving(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (booked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 28 }}>
        <FadeInUp>
          <View style={styles.successCard}>
            <ScaleIn delay={120}>
              <View style={styles.successIcon}><Feather name="check" size={34} color={colors.success} /></View>
            </ScaleIn>
            <Text style={[type.h1, { textAlign: 'center', marginTop: 18 }]}>{t('booking.booked')}</Text>
            <Text style={[type.sub, { textAlign: 'center', marginTop: 8 }]}>
              {doctor.full_name}{'\n'}
              {new Date(`${booked.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })} at {booked.slot}
            </Text>
            <PrimaryButton label={t('booking.viewVisits')} onPress={onDone} style={{ marginTop: 24, alignSelf: 'stretch' }} />
          </View>
        </FadeInUp>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={t('booking.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* Doctor summary */}
        <FadeInUp>
          <View style={styles.docCard}>
            <Avatar name={doctor.full_name} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={type.h2} numberOfLines={1}>{doctor.full_name}</Text>
              <Text style={[type.sub, { marginTop: 2 }]}>{doctor.specialty_name ?? doctor.specialty ?? t('common.specialist')}</Text>
              <View style={{ marginTop: 3 }}><Rating rating={doctor.rating} count={doctor.review_count} /></View>
            </View>
          </View>
        </FadeInUp>

        {/* What other patients said */}
        {reviews && reviews.count > 0 ? (
          <FadeInUp delay={60}>
            <View style={{ marginTop: 18 }}>
              <Text style={[type.label, { marginBottom: 10 }]}>{t('reviews.title')}</Text>
              {reviews.reviews.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <StarRating value={r.rating} size={13} />
                    <Text style={styles.reviewAuthor}>{r.author}</Text>
                  </View>
                  {r.comment ? (
                    <Text style={[type.sub, { marginTop: 6 }]}>{r.comment}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </FadeInUp>
        ) : null}

        {/* Day picker */}
        <Text style={[type.label, { marginTop: 24, marginBottom: 10 }]}>{t('booking.chooseDay')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingVertical: 2 }}>
          {days.map((d) => {
            const key = ymd(d)
            const active = key === selectedDate
            return (
              <Pressable key={key} onPress={() => setSelectedDate(key)}
                style={[styles.dayChip, active && styles.dayChipActive]}>
                <Text style={[styles.dayWd, active && { color: 'rgba(255,255,255,0.85)' }]}>{WD[d.getDay()]}</Text>
                <Text style={[styles.dayNum, active && { color: '#fff' }]}>{d.getDate()}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Slots */}
        <Text style={[type.label, { marginTop: 24, marginBottom: 10 }]}>{t('booking.times')}</Text>
        {loadingSlots ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 28 }} />
        ) : slots.length === 0 ? (
          <View style={styles.noSlots}>
            <Feather name="calendar" size={22} color={colors.textFaint} />
            <Text style={[type.sub, { textAlign: 'center' }]}>No open times this day.{'\n'}Try another day above.</Text>
          </View>
        ) : (
          <View style={styles.slotGrid}>
            {slots.map((s) => {
              const active = selectedSlot === s
              return (
                <Pressable key={s} onPress={() => setSelectedSlot(active ? null : s)}
                  style={[styles.slot, active && styles.slotActive]}>
                  <Text style={[styles.slotText, active && { color: '#fff' }]}>{s}</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        {/* Reason */}
        <Text style={[type.label, { marginTop: 24, marginBottom: 10 }]}>{t('booking.reason')}</Text>
        <TextInput
          style={styles.reason}
          placeholder={t('booking.reasonPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </ScrollView>

      {/* Confirm bar */}
      <View style={[styles.confirmBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>{selectedSlot ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) : t('booking.pickTime')}</Text>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink }}>{selectedSlot ?? '-'}</Text>
        </View>
        <PrimaryButton label={t('booking.confirm')} onPress={confirm} loading={saving} disabled={!selectedSlot} style={{ paddingHorizontal: 22 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  reviewCard: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: 13, marginBottom: 9,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: colors.text },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg, padding: 16, ...shadow.card,
  },
  dayChip: {
    width: 58, height: 70, borderRadius: radius.md, backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: colors.brand, borderColor: colors.brand, ...shadow.raised },
  dayWd: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  dayNum: { fontSize: 20, color: colors.ink, fontWeight: '800', marginTop: 3 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  slot: {
    minWidth: 92, flexGrow: 1, maxWidth: '31.5%', paddingVertical: 13, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  slotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slotText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  noSlots: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  reason: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 15, minHeight: 74, color: colors.ink, backgroundColor: colors.card,
    textAlignVertical: 'top',
  },
  confirmBar: {
    flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 14,
    backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  successCard: {
    backgroundColor: colors.card, borderRadius: radius.xl, padding: 28, alignItems: 'center', ...shadow.raised,
  },
  successIcon: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: colors.successBg,
    alignItems: 'center', justifyContent: 'center',
  },
})
