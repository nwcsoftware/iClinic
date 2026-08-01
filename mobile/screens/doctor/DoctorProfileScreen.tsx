import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { signOut } from '../../lib/supabase'
import { colors, radius, type } from '../../lib/theme'
import { Avatar, Card, Rating } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'
import { getSubscription, type DoctorMe, type Access } from '../../lib/doctorApi'

export default function DoctorProfileScreen({
  doctor, onSignedOut,
}: {
  doctor: DoctorMe
  onSignedOut: () => void
}) {
  const insets = useSafeAreaInsets()
  const [access, setAccess] = useState<Access | null>(null)

  useEffect(() => {
    getSubscription().then((s) => setAccess(s.access)).catch(() => {})
  }, [])

  const renews = access?.current_period_end
    ? new Date(access.current_period_end).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <FadeInUp>
          <Text style={type.h1}>Profile</Text>
          <View style={{ alignItems: 'center', marginTop: 22, marginBottom: 20 }}>
            <Avatar name={doctor.full_name} size={84} />
            <Text style={[type.h1, { marginTop: 14 }]}>{doctor.full_name}</Text>
            <Text style={[type.sub, { marginTop: 4 }]}>{doctor.specialty_name ?? 'Specialist'}</Text>
            <View style={{ marginTop: 8 }}>
              <Rating rating={doctor.rating} count={doctor.review_count} />
            </View>
          </View>
        </FadeInUp>

        {access?.billing_enabled ? (
          <FadeInUp delay={70}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.subIcon}>
                  <Feather name={access.is_trial ? 'gift' : 'check-circle'} size={16} color={colors.doc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h2}>
                    {access.is_trial ? 'Free trial' : 'Subscription active'}
                  </Text>
                  <Text style={[type.sub, { marginTop: 2 }]}>
                    {access.is_trial
                      ? `${access.days_left} day${access.days_left === 1 ? '' : 's'} left`
                      : renews ? `Renews ${renews}` : 'Active'}
                  </Text>
                </View>
                <Text style={styles.subPrice}>${access.price_usd.toFixed(2)}/mo</Text>
              </View>
              {access.is_trial && access.days_left <= 5 ? (
                <Text style={[type.sub, { marginTop: 12, color: colors.amber }]}>
                  Your trial ends soon — subscribe to stay visible to patients.
                </Text>
              ) : null}
            </Card>
          </FadeInUp>
        ) : null}

        <FadeInUp delay={90}>
          <Card>
            <Text style={type.h2}>Doctor account</Text>
            <Text style={[type.sub, { marginTop: 6 }]}>
              Your schedule controls what patients can book. Blocked days disappear from their calendar instantly, and every booking shows up on your dashboard in real time.
            </Text>
          </Card>
        </FadeInUp>

        <FadeInUp delay={150}>
          <Pressable
            onPress={async () => { await signOut(); onSignedOut() }}
            style={({ pressed }) => [styles.signOut, pressed && { backgroundColor: colors.dangerBg }]}
          >
            <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 15 }}>Sign out</Text>
          </Pressable>
        </FadeInUp>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  subIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  subPrice: { fontSize: 13.5, fontWeight: '800', color: colors.doc },
  signOut: {
    marginTop: 20, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F3D2D2', backgroundColor: colors.card,
  },
})
