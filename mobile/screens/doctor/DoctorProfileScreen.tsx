import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { signOut } from '../../lib/supabase'
import { colors, radius, type } from '../../lib/theme'
import { Avatar, Card, Rating } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'
import type { DoctorMe } from '../../lib/doctorApi'

export default function DoctorProfileScreen({
  doctor, onSignedOut,
}: {
  doctor: DoctorMe
  onSignedOut: () => void
}) {
  const insets = useSafeAreaInsets()
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
  signOut: {
    marginTop: 20, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F3D2D2', backgroundColor: colors.card,
  },
})
