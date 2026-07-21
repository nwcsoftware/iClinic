import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Easing, ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { devLogin } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { AmbientBackground, FadeInUp } from '../components/motion'

// TESTING login: pick a demo account or type any email — no password, no code.
// This whole screen gets replaced when the real login system is built.
const DEMO_ACCOUNTS = [
  { label: 'Patient', name: 'Jad Chami', email: 'scorpion666999@hotmail.com', role: 'patient' as const },
  { label: 'Doctor', name: 'Dr. Lara Haddad', email: 'dr.lara.haddad@iclinic.demo', role: 'doctor' as const },
  { label: 'Doctor', name: 'Dr. Rami Khoury', email: 'dr.rami.khoury@iclinic.demo', role: 'doctor' as const },
  { label: 'Doctor', name: 'Dr. Maya Saab', email: 'dr.maya.saab@iclinic.demo', role: 'doctor' as const },
]

function LogoPulse() {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]))
    loop.start()
    return () => loop.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View style={{
      position: 'absolute', width: 66, height: 66, borderRadius: 20,
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
      opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
    }} />
  )
}

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function signIn(addr: string) {
    const clean = addr.trim().toLowerCase()
    if (!clean.includes('@')) { setError('Please enter a valid email address.'); return }
    setError('')
    setBusy(clean)
    try {
      const { access_token, refresh_token } = await devLogin(clean)
      const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sErr) throw new Error(sErr.message)

      // Make sure the session is really readable before moving on — otherwise
      // the next screen can ask "who am I?" before storage has caught up.
      let session = null
      for (let i = 0; i < 10 && !session; i++) {
        const { data } = await supabase.auth.getSession()
        session = data.session
        if (!session) await new Promise((r) => setTimeout(r, 120))
      }
      if (!session) throw new Error('Could not save your session. Please try again.')

      onAuthed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AmbientBackground tone="onBrand" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeInUp>
          <View style={styles.hero}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <LogoPulse />
              <View style={styles.logo}><MaterialCommunityIcons name="hospital" size={30} color="#fff" /></View>
            </View>
            <Text style={styles.appName}>iClinic</Text>
            <Text style={styles.tagline}>Sign in to continue</Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={90}>
          <View style={styles.card}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => { setEmail(t); if (error) setError('') }}
              onSubmitEditing={() => signIn(email)}
              editable={!busy}
            />

            <Pressable
              onPress={() => signIn(email)}
              disabled={!!busy}
              style={({ pressed }) => [styles.primaryBtn, pressed && { backgroundColor: colors.brandDark }, !!busy && { opacity: 0.6 }]}
            >
              {busy === email.trim().toLowerCase()
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Continue</Text>}
            </Pressable>

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or test with</Text>
              <View style={styles.dividerLine} />
            </View>

            {DEMO_ACCOUNTS.map((a) => {
              const loading = busy === a.email
              const isDoc = a.role === 'doctor'
              return (
                <Pressable
                  key={a.email}
                  onPress={() => signIn(a.email)}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.demoRow, pressed && { backgroundColor: colors.brandSofter }, !!busy && !loading && { opacity: 0.5 }]}
                >
                  <View style={[styles.demoIcon, isDoc && { backgroundColor: colors.docSoft }]}>
                    <Feather name={isDoc ? 'activity' : 'user'} size={16} color={isDoc ? colors.doc : colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.demoName}>{a.name}</Text>
                    <Text style={styles.demoRole}>{isDoc ? 'Doctor account' : 'Patient account'}</Text>
                  </View>
                  {loading
                    ? <ActivityIndicator size="small" color={colors.brand} />
                    : <Feather name="chevron-right" size={18} color={colors.textFaint} />}
                </Pressable>
              )
            })}
          </View>
        </FadeInUp>

        <Text style={styles.footer}>Testing mode — no password needed.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 40 },
  hero: { alignItems: 'center', marginBottom: 22 },
  logo: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  appName: { fontSize: 29, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 14 },
  tagline: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', marginTop: 5 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, ...shadow.raised },
  label: { ...type.label, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 15,
    paddingVertical: 13, fontSize: 16, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  primaryBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 50,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
    borderWidth: 1, borderColor: '#F6C9C9',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  dividerText: { fontSize: 12, color: colors.textFaint, fontWeight: '600' },
  demoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  demoIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  demoName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  demoRole: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  footer: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 20 },
})
