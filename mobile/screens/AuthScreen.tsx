import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Easing, ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { loginWithPassword } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { AmbientBackground, FadeInUp } from '../components/motion'

// Endless soft pulse ring behind the logo — the login page breathes.
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
      position: 'absolute', width: 72, height: 72, borderRadius: 22,
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
      opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
    }} />
  )
}

// Testing sign-in with a username and password.
// doctor / doctor123   →  doctor mode
// patient / patient123 →  patient mode
export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!username.trim() || !password) { setError('Enter your username and password.'); return }
    setError('')
    setLoading(true)
    try {
      const { access_token, refresh_token } = await loginWithPassword(username, password)
      const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token })
      if (sErr) throw new Error(sErr.message)

      // Wait until the session is readable before continuing.
      let session = null
      for (let i = 0; i < 10 && !session; i++) {
        const { data } = await supabase.auth.getSession()
        session = data.session
        if (!session) await new Promise((r) => setTimeout(r, 120))
      }
      if (!session) throw new Error('Could not save your session. Try again.')

      onAuthed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AmbientBackground tone="onBrand" />
      <FadeInUp>
        <View style={styles.hero}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <LogoPulse />
            <View style={styles.logo}><MaterialCommunityIcons name="hospital" size={32} color="#fff" /></View>
          </View>
          <Text style={styles.appName}>iClinic</Text>
          <Text style={styles.tagline}>The right doctor, in minutes.{'\n'}Describe how you feel — we handle the rest.</Text>
        </View>
      </FadeInUp>

      <FadeInUp delay={100}>
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="doctor or patient"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => { setUsername(t); if (error) setError('') }}
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={styles.passWrap}>
            <TextInput
              style={styles.passInput}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(t) => { setPassword(t); if (error) setError('') }}
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
            <Pressable onPress={() => setShowPass((s) => !s)} hitSlop={10} style={styles.eye}>
              <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textFaint} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.brandDark }, loading && { opacity: 0.6 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Test accounts</Text>
            <Text style={styles.hintLine}>doctor  ·  doctor123</Text>
            <Text style={styles.hintLine}>patient  ·  patient123</Text>
          </View>
        </View>
      </FadeInUp>

      <Text style={styles.footer}>Not for emergencies. If this is urgent, call your local emergency number.</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 30 },
  logo: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 16 },
  tagline: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 10, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, ...shadow.raised },
  label: { ...type.label, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  passWrap: { position: 'relative', justifyContent: 'center' },
  passInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    paddingRight: 48, paddingVertical: 14, fontSize: 16, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  eye: { position: 'absolute', right: 14, padding: 4 },
  button: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', marginTop: 18, minHeight: 52,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
    borderWidth: 1, borderColor: '#F6C9C9',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  hintBox: {
    marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  hintTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  hintLine: { fontSize: 12.5, color: colors.textFaint, lineHeight: 19 },
  footer: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 26, lineHeight: 17 },
})
