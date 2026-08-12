import { View, Text, Pressable, StyleSheet, ScrollView, Linking, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../lib/theme'
import { AmbientBackground, FadeInUp } from '../components/motion'
import { CONTACT, type Policy } from '../lib/policies'

// The first screen anyone reaching iClinic sees when signed out.
//
// It exists so the product is legible without an account: what iClinic does,
// what the doctor subscription costs, that the assistant is not medical advice,
// who is behind it, and the three policies. That is what a payment provider
// looks for, and a login screen shows none of it.

const FEATURES: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }[] = [
  { icon: 'stethoscope', title: 'Describe how you feel', body: 'Tell the assistant your symptoms and it points you to the right speciality.' },
  { icon: 'calendar-check', title: 'Book in a couple of taps', body: 'Pick a doctor, choose a free time, and the visit is confirmed straight away.' },
  { icon: 'pill', title: 'Read your prescriptions', body: 'Exactly what to take, how much, at which hours, and for how long.' },
  { icon: 'phone-alert', title: 'Help in an emergency', body: 'One button shows your local emergency numbers and dials them for you.' },
]

const DOCTOR_PERKS = [
  'Appear in the patient app and assistant results',
  'Accept online bookings around the clock',
  'Set your weekly hours and block days off',
  'See patient allergies, conditions and visit history',
  'Write prescriptions with dosage, times and duration',
]

export default function LandingScreen({
  onSignIn, onOpenPolicy,
}: {
  onSignIn: () => void
  onOpenPolicy: (p: Policy['key']) => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AmbientBackground tone="soft" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <FadeInUp>
          <View style={[styles.hero, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 24 : 16) + 20 }]}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name="hospital" size={30} color="#fff" />
            </View>
            <Text style={styles.brand}>iClinic</Text>
            <Text style={styles.tagline}>The right doctor, in minutes</Text>
            <Text style={styles.sub}>
              Describe how you feel, find the right specialist, book a visit, and keep your
              prescriptions in one place. Free for patients in {CONTACT.location}.
            </Text>

            <Pressable
              onPress={onSignIn}
              style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#F2F4FB' }]}
            >
              <Text style={styles.ctaText}>Sign in</Text>
              <Feather name="arrow-right" size={18} color={colors.brand} />
            </Pressable>
          </View>
        </FadeInUp>

        <View style={{ padding: 20 }}>
          {/* For patients */}
          <FadeInUp delay={60}>
            <Text style={type.h1}>For patients</Text>
            <View style={{ marginTop: 14, gap: 10 }}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.card}>
                  <View style={styles.icon}>
                    <MaterialCommunityIcons name={f.icon} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2}>{f.title}</Text>
                    <Text style={[type.sub, { marginTop: 2 }]}>{f.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </FadeInUp>

          {/* Pricing — what a payment provider is being asked to collect */}
          <FadeInUp delay={110}>
            <Text style={[type.h1, { marginTop: 30 }]}>For doctors</Text>
            <View style={styles.priceCard}>
              <Text style={styles.priceKicker}>Doctor subscription</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                <Text style={styles.price}>${CONTACT.priceUsd.toFixed(2)}</Text>
                <Text style={styles.per}> per month</Text>
              </View>
              <Text style={styles.priceNote}>
                Billed in US dollars. Every new doctor account starts with a free trial. Cancel any
                time — you keep access until the end of the period you have paid for.
              </Text>
              <View style={{ marginTop: 14, gap: 8 }}>
                {DOCTOR_PERKS.map((p) => (
                  <View key={p} style={{ flexDirection: 'row', gap: 9 }}>
                    <Feather name="check" size={15} color="#fff" style={{ marginTop: 3 }} />
                    <Text style={styles.perk}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeInUp>

          {/* Safety */}
          <FadeInUp delay={160}>
            <View style={styles.safety}>
              <Feather name="shield" size={17} color={colors.success} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>A note on safety</Text>
                <Text style={[type.sub, { marginTop: 4 }]}>
                  The assistant suggests which kind of doctor to see. It does not diagnose, treat, or
                  give medical advice, and is never a substitute for a qualified professional. In an
                  emergency call your local emergency number — in Lebanon that is 112 for police,
                  140 for the Red Cross ambulance and 125 for Civil Defence.
                </Text>
              </View>
            </View>
          </FadeInUp>

          {/* Who is behind it */}
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

          {/* Policies */}
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
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand, alignItems: 'center',
    paddingHorizontal: 26, paddingBottom: 30,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  logo: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  brand: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 14, letterSpacing: -0.5 },
  tagline: { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginTop: 6 },
  sub: {
    fontSize: 14.5, lineHeight: 21, color: 'rgba(255,255,255,0.88)',
    textAlign: 'center', marginTop: 12,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#fff', borderRadius: radius.full,
    paddingVertical: 15, paddingHorizontal: 34, marginTop: 22, ...shadow.raised,
  },
  ctaText: { color: colors.brand, fontSize: 16.5, fontWeight: '800' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 13,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  icon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  priceCard: {
    backgroundColor: colors.brand, borderRadius: radius.xl, padding: 20, marginTop: 14,
    ...shadow.raised,
  },
  priceKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: '700' },
  price: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  per: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  priceNote: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  perk: { flex: 1, color: 'rgba(255,255,255,0.94)', fontSize: 14, lineHeight: 20 },
  safety: {
    flexDirection: 'row', gap: 11, marginTop: 26,
    backgroundColor: colors.successBg, borderRadius: radius.lg, padding: 15,
  },
  contact: {
    marginTop: 22, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  link: { color: colors.brand, fontWeight: '700', fontSize: 14.5, marginTop: 6 },
  policies: {
    marginTop: 22, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
  },
  policyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  policyLabel: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
})
