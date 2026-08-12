import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getSubscription, type DoctorMe, type SubscriptionInfo } from '../../lib/doctorApi'
import { signOut } from '../../lib/supabase'
import { colors, radius, shadow, type } from '../../lib/theme'
import { Card } from '../../components/ui'
import { DoctorAmbient, FadeInUp, ScaleIn } from '../../components/motion'
import ReportPaymentForm from '../../components/ReportPaymentForm'

const PERKS = [
  'Appear in the patient app and chatbot results',
  'Accept online bookings around the clock',
  'Manage your weekly hours and days off',
  'See your patient list and daily schedule',
]

export default function PaywallScreen({
  doctor, onRetry, onSignedOut,
}: {
  doctor: DoctorMe
  onRetry: () => void
  onSignedOut: () => void
}) {
  const insets = useSafeAreaInsets()
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    try { setInfo(await getSubscription()) }
    catch { /* keep the paywall visible either way */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function recheck() {
    setChecking(true)
    await load()
    setChecking(false)
    onRetry()
  }

  const status = info?.access.status
  const expired = status === 'expired' || status === 'canceled' || status === 'none'
  const price = info?.access.price_usd ?? 9.99
  const inst = info?.instructions

  const heading = status === 'trialing' ? 'Your free trial has ended'
    : status === 'past_due' ? 'Your payment did not go through'
    : expired ? 'Your subscription has ended'
    : 'Subscription required'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <ScrollView
        contentContainerStyle={{
          padding: 22,
          paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 20,
          paddingBottom: Math.max(insets.bottom, 24) + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <ScaleIn>
              <View style={styles.lock}><Feather name="lock" size={26} color={colors.doc} /></View>
            </ScaleIn>
            <Text style={[type.h1, { marginTop: 16, textAlign: 'center' }]}>{heading}</Text>
            <Text style={[type.sub, { marginTop: 8, textAlign: 'center' }]}>
              Dr. {doctor.full_name.replace(/^dr\.?\s*/i, '')} — reactivate to keep receiving patients.
            </Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={70}>
          <View style={styles.priceCard}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
              <Text style={styles.price}>${price.toFixed(2)}</Text>
              <Text style={styles.per}> / month</Text>
            </View>
            <View style={{ marginTop: 16, gap: 10 }}>
              {PERKS.map((p) => (
                <View key={p} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Feather name="check" size={16} color="#fff" style={{ marginTop: 2 }} />
                  <Text style={styles.perk}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        </FadeInUp>

        {loading ? (
          <ActivityIndicator color={colors.doc} style={{ marginTop: 28 }} />
        ) : (
          <>
            {info?.checkout_url ? (
              <FadeInUp delay={120}>
                <Pressable
                  onPress={() => Linking.openURL(info.checkout_url as string)}
                  style={({ pressed }) => [styles.payBtn, pressed && { backgroundColor: colors.docDark }]}
                >
                  <Feather name="credit-card" size={18} color="#fff" />
                  <Text style={styles.payBtnText}>Pay by card</Text>
                </Pressable>
              </FadeInUp>
            ) : null}

            <FadeInUp delay={150}>
              <Card style={{ marginTop: 16 }}>
                <Text style={type.h2}>How to pay</Text>
                {inst?.whish || inst?.omt || inst?.bank ? (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    {inst?.whish ? <PayRow icon="smartphone" label="Whish Money" value={inst.whish} /> : null}
                    {inst?.omt ? <PayRow icon="map-pin" label="OMT" value={inst.omt} /> : null}
                    {inst?.bank ? <PayRow icon="home" label="Bank transfer" value={inst.bank} /> : null}
                  </View>
                ) : (
                  <Text style={[type.sub, { marginTop: 8 }]}>
                    Contact us to arrange payment and reactivate your account.
                  </Text>
                )}
                <Text style={[type.sub, { marginTop: 14 }]}>{inst?.note}</Text>
                {inst?.contact ? (
                  <Pressable
                    onPress={() => Linking.openURL(`https://wa.me/${inst.contact?.replace(/[^0-9]/g, '')}`)}
                    style={({ pressed }) => [styles.contactBtn, pressed && { backgroundColor: colors.docSoft }]}
                  >
                    <Feather name="message-circle" size={16} color={colors.doc} />
                    <Text style={styles.contactText}>Send receipt: {inst.contact}</Text>
                  </Pressable>
                ) : null}

                <ReportPaymentForm plans={info?.plans ?? []} />
              </Card>
            </FadeInUp>

            <FadeInUp delay={200}>
              <Pressable
                onPress={recheck}
                disabled={checking}
                style={({ pressed }) => [styles.refreshBtn, pressed && { backgroundColor: colors.docSofter }]}
              >
                {checking
                  ? <ActivityIndicator size="small" color={colors.doc} />
                  : (
                    <>
                      <Feather name="refresh-cw" size={16} color={colors.doc} />
                      <Text style={styles.refreshText}>I&apos;ve paid — check again</Text>
                    </>
                  )}
              </Pressable>

              <Pressable onPress={async () => { await signOut(); onSignedOut() }} style={styles.signOut}>
                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 14 }}>Sign out</Text>
              </Pressable>
            </FadeInUp>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function PayRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
      <View style={styles.payIcon}><Feather name={icon} size={15} color={colors.doc} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.payLabel}>{label}</Text>
        <Text style={styles.payValue}>{value}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  lock: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  priceCard: {
    backgroundColor: colors.doc, borderRadius: radius.xl, padding: 22, ...shadow.raised,
  },
  price: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  per: { fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  perk: { flex: 1, color: 'rgba(255,255,255,0.94)', fontSize: 14, lineHeight: 20 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: colors.doc, borderRadius: radius.md, paddingVertical: 15, marginTop: 16,
  },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  payIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.docSofter,
    alignItems: 'center', justifyContent: 'center',
  },
  payLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  payValue: { fontSize: 15, color: colors.ink, fontWeight: '700', marginTop: 1 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.docSoft,
  },
  contactText: { color: colors.doc, fontWeight: '700', fontSize: 14 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginTop: 18, paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  refreshText: { color: colors.doc, fontWeight: '800', fontSize: 15 },
  signOut: { alignSelf: 'center', marginTop: 18, paddingVertical: 8 },
})
