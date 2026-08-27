import { useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Linking, Platform, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../lib/theme'
import { AmbientBackground, FadeInUp } from '../components/motion'
import { CONTACT, type Policy } from '../lib/policies'
import { CAN_SELL_IN_APP } from '../lib/purchases'

// The first screen anyone reaching iClinic sees when signed out.
//
// It exists so the product is legible without an account: what iClinic does for
// patients, what it does for doctors, that the assistant is not medical advice,
// who is behind it, and the three policies. A login screen shows none of that.
//
// Sign in never scrolls away. It sits in a bar pinned over the page, which
// turns from transparent to solid once the dark hero is behind it — the change
// is there because white on white cannot be read, not for effect.

const WEB_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.iclinic.health'

const FEATURES: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }[] = [
  { icon: 'stethoscope', title: 'Describe how you feel', body: 'Say it in your own words. The assistant works out which speciality fits and points you there.' },
  { icon: 'calendar-check', title: 'Book in a couple of taps', body: 'Pick a doctor, choose a time that is actually free, and the visit is confirmed straight away.' },
  { icon: 'pill', title: 'Read your prescriptions', body: 'Exactly what to take, how much, at which hours, and for how long.' },
  { icon: 'map-marker-radius', title: 'Find them on the map', body: 'Every hospital and clinic in the country, with the doctors who work there and the days they are in.' },
  { icon: 'phone-alert', title: 'Help in an emergency', body: 'One button brings up your local emergency numbers and dials them for you.' },
]

const DOCTOR_FEATURES: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }[] = [
  { icon: 'calendar-clock', title: 'Your week, your rules', body: 'Set the hours you work at each place and block the days you do not. Bookings arrive without a phone ringing.' },
  { icon: 'hospital-building', title: 'Every place you work', body: 'Hospital on Monday, private clinic on Thursday. Add each one and patients see where their appointment will be.' },
  { icon: 'clipboard-pulse-outline', title: 'The history before the visit', body: 'Allergies, chronic conditions, past surgeries and previous visits, on screen before the patient sits down.' },
  { icon: 'prescription', title: 'Prescriptions that are clear', body: 'Dosage, times of day and duration, in a form the patient can actually follow.' },
]

const CONNECTED = [
  { step: '01', title: 'The patient writes it once', body: 'Allergies, conditions, blood type, past surgeries, on their own phone, in their own time.' },
  { step: '02', title: 'The doctor sees it at the visit', body: 'A timeline of appointments, diagnoses and prescriptions, with no form to fill in at reception.' },
  { step: '03', title: 'The visit adds to it', body: 'What was diagnosed and prescribed goes back to the same record, ready for whoever sees them next.' },
]

export default function LandingScreen({
  onSignIn, onOpenPolicy,
}: {
  onSignIn: () => void
  onOpenPolicy: (p: Policy['key']) => void
}) {
  const insets = useSafeAreaInsets()
  // The bar is transparent over the hero and solid past it. Kept as a boolean
  // rather than a scroll-linked value so it settles instead of flickering.
  const [pastHero, setPastHero] = useState(false)
  const fade = useRef(new Animated.Value(0)).current

  function onScroll(y: number) {
    const next = y > 210
    if (next === pastHero) return
    setPastHero(next)
    Animated.timing(fade, {
      toValue: next ? 1 : 0, duration: 220, useNativeDriver: false,
    }).start()
  }

  const barTop = Math.max(insets.top, Platform.OS === 'web' ? 10 : 6)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 30 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                              */}
        {/* ---------------------------------------------------------------- */}
        <View style={[styles.hero, { paddingTop: barTop + 76 }]}>
          <AmbientBackground tone="onBrand" />

          <FadeInUp>
            <View style={styles.kicker}>
              <Feather name="map-pin" size={12} color="#C7D2FE" />
              <Text style={styles.kickerText}>Built for {CONTACT.location}</Text>
            </View>
          </FadeInUp>

          <FadeInUp delay={70}>
            <Text style={styles.heroTitle}>The right doctor,</Text>
            <Text style={styles.heroTitleAccent}>in minutes</Text>
          </FadeInUp>

          <FadeInUp delay={140}>
            <Text style={styles.heroSub}>
              Describe how you feel. Find the specialist who treats it. Book the visit, and keep
              every prescription and past appointment in one place.
            </Text>
          </FadeInUp>

          <FadeInUp delay={210}>
            <Pressable
              onPress={onSignIn}
              style={({ pressed }) => [styles.heroCta, pressed && { backgroundColor: '#EEF1FC' }]}
            >
              <Text style={styles.heroCtaText}>Sign in</Text>
              <Feather name="arrow-right" size={17} color={colors.brand} />
            </Pressable>
            <Text style={styles.heroNote}>
              Free for patients. Not for emergencies. Call 112 in Lebanon.
            </Text>
          </FadeInUp>
        </View>

        <View style={{ padding: 20 }}>
          {/* -------------------------------------------------------------- */}
          {/* For patients                                                    */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={60}>
            <Text style={styles.eyebrow}>For patients</Text>
            <Text style={styles.sectionTitle}>Finding care should not be the hard part</Text>
            <Text style={styles.sectionSub}>
              You know something is wrong. You should not also have to know which kind of doctor
              treats it, or who has a free slot on Thursday.
            </Text>
          </FadeInUp>

          <View style={{ marginTop: 16, gap: 10 }}>
            {FEATURES.map((f, i) => (
              <FadeInUp key={f.title} delay={110 + i * 40}>
                <View style={styles.card}>
                  <View style={styles.icon}>
                    <MaterialCommunityIcons name={f.icon} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>{f.title}</Text>
                    <Text style={[type.sub, { marginTop: 3 }]}>{f.body}</Text>
                  </View>
                </View>
              </FadeInUp>
            ))}
          </View>

          {/* -------------------------------------------------------------- */}
          {/* For doctors                                                     */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={100}>
            <View style={styles.doctorBlock}>
              <Text style={[styles.eyebrow, { color: '#7FE3D4' }]}>For doctors</Text>
              <Text style={styles.doctorTitle}>Your practice, without the paperwork around it</Text>
              <Text style={styles.doctorSub}>
                One place for your schedule, the places you work, your patients and what you
                prescribe them.
              </Text>

              <View style={{ marginTop: 18, gap: 14 }}>
                {DOCTOR_FEATURES.map((f) => (
                  <View key={f.title} style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={styles.docIcon}>
                      <MaterialCommunityIcons name={f.icon} size={18} color="#7FE3D4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docCardTitle}>{f.title}</Text>
                      <Text style={styles.docCardBody}>{f.body}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Sending someone out to sign up is a step on the way to a
                  subscription, so it is not offered where the app may not sell.
                  Doctors who already have an account still sign in normally. */}
              {CAN_SELL_IN_APP ? (
                <Pressable
                  onPress={() => Linking.openURL(`${WEB_URL}/register`)}
                  style={({ pressed }) => [styles.docCta, pressed && { backgroundColor: '#EEF1FC' }]}
                >
                  <Text style={styles.docCtaText}>Create a doctor account</Text>
                  <Feather name="arrow-up-right" size={16} color={colors.docDark} />
                </Pressable>
              ) : null}
            </View>
          </FadeInUp>

          {/* -------------------------------------------------------------- */}
          {/* Connected care                                                  */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={120}>
            <Text style={[styles.sectionTitle, { marginTop: 34 }]}>
              The two halves are the same system
            </Text>
            <Text style={styles.sectionSub}>
              What a patient records and what a doctor sees are not two databases kept in step.
              They are one.
            </Text>
          </FadeInUp>

          <View style={{ marginTop: 16, gap: 10 }}>
            {CONNECTED.map((s, i) => (
              <FadeInUp key={s.step} delay={150 + i * 45}>
                <View style={styles.stepCard}>
                  <Text style={styles.stepNum}>{s.step}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>{s.title}</Text>
                    <Text style={[type.sub, { marginTop: 3 }]}>{s.body}</Text>
                  </View>
                </View>
              </FadeInUp>
            ))}
          </View>

          {/* -------------------------------------------------------------- */}
          {/* Safety                                                          */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={160}>
            <View style={styles.safety}>
              <Feather name="shield" size={17} color={colors.success} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>A note on safety</Text>
                <Text style={[type.sub, { marginTop: 4 }]}>
                  The assistant suggests which kind of doctor to see. It does not diagnose, treat, or
                  give medical advice, and is never a substitute for a qualified professional. In an
                  emergency call your local emergency number. In Lebanon that is 112 for police,
                  140 for the Red Cross ambulance and 125 for Civil Defence.
                </Text>
              </View>
            </View>
          </FadeInUp>

          {/* -------------------------------------------------------------- */}
          {/* Final call to action                                            */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={180}>
            <View style={styles.finalCta}>
              <Text style={styles.finalTitle}>Start where you are</Text>
              <Text style={styles.finalSub}>
                Sign in to book a visit, or create a doctor account and set up the places you work.
                Both take a few minutes.
              </Text>
              <Pressable
                onPress={onSignIn}
                style={({ pressed }) => [styles.finalBtn, pressed && { backgroundColor: '#EEF1FC' }]}
              >
                <Text style={styles.finalBtnText}>Sign in</Text>
                <Feather name="arrow-right" size={17} color={colors.brand} />
              </Pressable>
            </View>
          </FadeInUp>

          {/* -------------------------------------------------------------- */}
          {/* Contact + policies                                              */}
          {/* -------------------------------------------------------------- */}
          <FadeInUp delay={200}>
            <View style={styles.contact}>
              <Text style={type.h2}>Contact</Text>
              <Text style={[type.sub, { marginTop: 6 }]}>
                {CONTACT.legalName}{'\n'}{CONTACT.location}
              </Text>
              <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT.email}`)} hitSlop={6}>
                <Text style={styles.link}>{CONTACT.email}</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`https://wa.me/${CONTACT.phone.replace(/[^0-9]/g, '')}`)}
                hitSlop={6}
              >
                <Text style={styles.link}>{CONTACT.phone}</Text>
              </Pressable>
            </View>
          </FadeInUp>

          <FadeInUp delay={240}>
            <View style={styles.policies}>
              {([
                { key: 'terms', label: 'Terms of Service' },
                { key: 'privacy', label: 'Privacy Policy' },
                { key: 'refunds', label: 'Refunds & Cancellation' },
              ] as const).map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => onOpenPolicy(p.key)}
                  style={({ pressed }) => [styles.policyRow, pressed && { backgroundColor: colors.brandSofter }]}
                >
                  <Text style={styles.policyLabel}>{p.label}</Text>
                  <Feather name="chevron-right" size={17} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
            <Text style={[type.small, { textAlign: 'center', marginTop: 16 }]}>
              © {new Date().getFullYear()} {CONTACT.legalName}
            </Text>
          </FadeInUp>
        </View>
      </ScrollView>

      {/* ------------------------------------------------------------------ */}
      {/* The bar that follows the page                                       */}
      {/* ------------------------------------------------------------------ */}
      <View pointerEvents="box-none" style={[styles.barWrap, { top: barTop }]}>
        <View style={styles.bar}>
          {/* The solid backing fades in rather than switching, so the text
              never sits on a half-changed colour. */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.barSolid, { opacity: fade }]} />

          <View style={styles.brandRow}>
            <View style={[styles.barLogo, pastHero && { backgroundColor: colors.brandSoft }]}>
              <MaterialCommunityIcons
                name="hospital"
                size={15}
                color={pastHero ? colors.brand : '#fff'}
              />
            </View>
            <Text style={[styles.barBrand, pastHero && { color: colors.ink }]}>iClinic</Text>
          </View>

          <Pressable
            onPress={onSignIn}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            style={({ pressed }) => [
              styles.barBtn,
              pastHero ? styles.barBtnSolid : styles.barBtnGhost,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.barBtnText, pastHero && { color: '#fff' }]}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // --- hero ---
  hero: {
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  kicker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full, paddingHorizontal: 13, paddingVertical: 6,
  },
  kickerText: { color: '#C7D2FE', fontSize: 12.5, fontWeight: '600' },
  heroTitle: {
    fontSize: 38, lineHeight: 43, fontWeight: '800', color: '#fff',
    letterSpacing: -1, textAlign: 'center', marginTop: 20,
  },
  heroTitleAccent: {
    fontSize: 38, lineHeight: 43, fontWeight: '800', color: '#9DB4FF',
    letterSpacing: -1, textAlign: 'center',
  },
  heroSub: {
    fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.82)',
    textAlign: 'center', marginTop: 16, maxWidth: 440,
  },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#fff', borderRadius: radius.full,
    paddingVertical: 15, paddingHorizontal: 38, marginTop: 26, ...shadow.raised,
  },
  heroCtaText: { color: colors.brand, fontSize: 16.5, fontWeight: '800' },
  heroNote: {
    color: 'rgba(255,255,255,0.62)', fontSize: 12.5,
    textAlign: 'center', marginTop: 16,
  },

  // --- sections ---
  eyebrow: {
    fontSize: 12, fontWeight: '800', color: colors.brand,
    letterSpacing: 1.3, textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 25, lineHeight: 31, fontWeight: '800', color: colors.ink,
    letterSpacing: -0.5, marginTop: 8,
  },
  sectionSub: { fontSize: 14.5, lineHeight: 22, color: colors.textMuted, marginTop: 9 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 13,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  icon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // --- doctors ---
  doctorBlock: {
    backgroundColor: '#0B2B2A', borderRadius: radius.xl,
    padding: 22, marginTop: 34, overflow: 'hidden',
  },
  doctorTitle: {
    fontSize: 23, lineHeight: 29, fontWeight: '800', color: '#fff',
    letterSpacing: -0.5, marginTop: 8,
  },
  doctorSub: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.72)', marginTop: 9 },
  docIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(127,227,212,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  docCardTitle: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  docCardBody: { fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  docCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: radius.full,
    paddingVertical: 14, marginTop: 22,
  },
  docCtaText: { color: colors.docDark, fontSize: 15, fontWeight: '800' },

  // --- connected care ---
  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 13,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  stepNum: {
    fontSize: 13, fontWeight: '800', color: colors.brand,
    letterSpacing: 1.2, marginTop: 2, width: 26,
  },

  // --- safety, final CTA, contact ---
  safety: {
    flexDirection: 'row', gap: 11, marginTop: 30,
    backgroundColor: colors.successBg, borderRadius: radius.lg, padding: 15,
  },
  finalCta: {
    backgroundColor: colors.brandDark, borderRadius: radius.xl,
    padding: 24, marginTop: 24, alignItems: 'center',
  },
  finalTitle: {
    fontSize: 24, fontWeight: '800', color: '#fff',
    letterSpacing: -0.5, textAlign: 'center',
  },
  finalSub: {
    fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.78)',
    textAlign: 'center', marginTop: 9,
  },
  finalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: radius.full,
    paddingVertical: 14, paddingHorizontal: 34, marginTop: 18,
  },
  finalBtnText: { color: colors.brand, fontSize: 15.5, fontWeight: '800' },
  contact: {
    marginTop: 24, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  link: { color: colors.brand, fontWeight: '700', fontSize: 14.5, marginTop: 6 },
  policies: {
    marginTop: 14, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  policyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  policyLabel: { fontSize: 14.5, fontWeight: '700', color: colors.ink },

  // --- floating bar ---
  barWrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  barSolid: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  barLogo: {
    width: 27, height: 27, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  barBrand: { fontSize: 15.5, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  barBtn: { borderRadius: radius.full, paddingHorizontal: 17, paddingVertical: 8 },
  barBtnGhost: { backgroundColor: 'rgba(255,255,255,0.14)' },
  barBtnSolid: { backgroundColor: colors.brand },
  barBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
})
