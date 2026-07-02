import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Platform, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getDoctors, getMyAppointments, type Appointment, type Doctor, type PatientInfo } from '../lib/api'
import { colors, radius, shadow, specialtyIcon, DEFAULT_SPECIALTY_ICON, type } from '../lib/theme'
import { Avatar, Card, Rating, SectionHeader, SpecIcon } from '../components/ui'
import { AmbientBackground, FadeInUp } from '../components/motion'

const heroArt = require('../assets/illustrations/hero.png')

function firstName(full: string | undefined | null): string {
  return (full ?? '').trim().split(/\s+/)[0] || 'there'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function HomeScreen({
  patient, onStartTriage, onOpenDoctors, onPickDoctor, onViewVisits,
}: {
  patient: PatientInfo | null
  onStartTriage: () => void
  onOpenDoctors: () => void
  onPickDoctor: (d: Doctor) => void
  onViewVisits: () => void
}) {
  const insets = useSafeAreaInsets()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [nextVisit, setNextVisit] = useState<Appointment | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [docs, appts] = await Promise.all([getDoctors(), getMyAppointments()])
      setDoctors(docs)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const upcoming = appts
        .filter((a) => a.status === 'scheduled' && new Date(`${a.appointment_date}T00:00:00`) >= today)
        .sort((a, b) => (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time))
      setNextVisit(upcoming[0] ?? null)
    } catch { /* pull-to-refresh retries */ }
    finally { setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const specialties = [...new Map(
    doctors.filter((d) => d.specialty_slug).map((d) => [d.specialty_slug!, d.specialty_name ?? d.specialty ?? ''])
  ).entries()]

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <AmbientBackground />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <FadeInUp>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting()},</Text>
            <Text style={styles.name}>{firstName(patient?.full_name)}</Text>
          </View>
          <Avatar name={patient?.full_name ?? 'Me'} size={46} />
        </View>
      </FadeInUp>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Assistant hero */}
        <FadeInUp delay={60}>
          <Pressable onPress={onStartTriage} style={({ pressed }) => [styles.hero, pressed && { transform: [{ scale: 0.985 }] }]}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.heroKicker}>Health assistant</Text>
              <Text style={styles.heroTitle}>How are you feeling today?</Text>
              <Text style={styles.heroSub}>Describe your symptoms — we'll match you with the right specialist.</Text>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>Start a chat</Text>
                <Feather name="arrow-right" size={15} color="#fff" />
              </View>
            </View>
            <Image source={heroArt} style={styles.heroArt} resizeMode="cover" />
          </Pressable>
        </FadeInUp>

        {/* Trust strip */}
        <FadeInUp delay={100}>
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Feather name="shield" size={13} color={colors.textMuted} />
              <Text style={styles.trustText}>Licensed doctors</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Feather name="lock" size={13} color={colors.textMuted} />
              <Text style={styles.trustText}>Private and secure</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Feather name="clock" size={13} color={colors.textMuted} />
              <Text style={styles.trustText}>Assistant 24/7</Text>
            </View>
          </View>
        </FadeInUp>

        {/* Next appointment */}
        {nextVisit && (
          <FadeInUp delay={120}>
            <Card onPress={onViewVisits} style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateBoxDay}>{new Date(`${nextVisit.appointment_date}T00:00:00`).getDate()}</Text>
                  <Text style={styles.dateBoxMon}>{new Date(`${nextVisit.appointment_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.label}>Next visit</Text>
                  <Text style={[type.h2, { marginTop: 3 }]} numberOfLines={1}>{nextVisit.doctor_name}</Text>
                  <Text style={[type.sub, { marginTop: 2 }]}>{fmtDate(nextVisit.appointment_date)} · {nextVisit.start_time.slice(0, 5)}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textFaint} />
              </View>
            </Card>
          </FadeInUp>
        )}

        {/* Specialties */}
        {specialties.length > 0 && (
          <FadeInUp delay={180}>
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Specialties" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
                {specialties.map(([slug, name]) => (
                  <Pressable key={slug} onPress={onOpenDoctors} style={({ pressed }) => [styles.specChip, pressed && { backgroundColor: colors.brandSofter }]}>
                    <SpecIcon name={specialtyIcon[slug] ?? DEFAULT_SPECIALTY_ICON} />
                    <Text style={styles.specChipText} numberOfLines={1}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </FadeInUp>
        )}

        {/* Doctors */}
        <FadeInUp delay={240}>
          <View style={{ marginTop: 28 }}>
            <SectionHeader title="Top doctors" action="See all" onAction={onOpenDoctors} />
            {doctors.slice(0, 4).map((d) => (
              <Card key={d.id} onPress={() => onPickDoctor(d)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar name={d.full_name} size={50} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2} numberOfLines={1}>{d.full_name}</Text>
                    <Text style={[type.sub, { marginTop: 2 }]}>{d.specialty_name ?? d.specialty ?? 'Specialist'}</Text>
                    <View style={{ marginTop: 4 }}><Rating rating={d.rating} count={d.review_count} /></View>
                  </View>
                  <View style={styles.bookPill}><Text style={styles.bookPillText}>Book</Text></View>
                </View>
              </Card>
            ))}
          </View>
        </FadeInUp>
      </View>
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18,
  },
  greet: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  name: { fontSize: 25, fontWeight: '800', color: colors.ink, letterSpacing: -0.4, marginTop: 2 },
  hero: {
    backgroundColor: colors.brand, borderRadius: radius.xl, padding: 20,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...shadow.raised,
  },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 20.5, fontWeight: '800', marginTop: 8, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 9, marginTop: 16,
  },
  heroBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  heroArt: { width: 104, height: 104, borderRadius: radius.lg, opacity: 0.96 },
  trustRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginTop: 14, flexWrap: 'wrap',
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  dateBox: {
    width: 54, height: 58, borderRadius: radius.md, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  dateBoxDay: { fontSize: 20, fontWeight: '800', color: colors.brand },
  dateBoxMon: { fontSize: 11.5, fontWeight: '700', color: colors.brand, textTransform: 'uppercase' },
  specChip: {
    width: 104, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 14,
    alignItems: 'center', gap: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow.card,
  },
  specChipText: { fontSize: 12, fontWeight: '600', color: colors.text, paddingHorizontal: 8 },
  bookPill: {
    backgroundColor: colors.brandSoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  bookPillText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
})
