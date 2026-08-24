import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, Linking,
  KeyboardAvoidingView, Platform, Animated, Easing, ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { loginWithPassword } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { AmbientBackground, FadeInUp } from '../components/motion'

// The policies are served by the web project, which is a different origin to
// the app. Falls back to the production site when the API URL is unset.
const WEB_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'https://iclinic-web.vercel.app'

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

// Sign in with a username and password. The account's role decides which
// shell the app opens into — doctor or patient.
export default function AuthScreen({ onAuthed, onBack }: { onAuthed: () => void; onBack?: () => void }) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!username.trim() || !password) { setError(t('auth.enterBoth')); return }
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
      if (!session) throw new Error(t('auth.sessionFailed'))

      onAuthed()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AmbientBackground tone="onBrand" />
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.9)" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}
      <FadeInUp>
        <View style={styles.hero}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <LogoPulse />
            <View style={styles.logo}><MaterialCommunityIcons name="hospital" size={32} color="#fff" /></View>
          </View>
          <Text style={styles.appName}>{t('app.name')}</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>
      </FadeInUp>

      <FadeInUp delay={100}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => { setUsername(t); if (error) setError('') }}
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>{t('auth.password')}</Text>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('auth.signIn')}</Text>}
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </FadeInUp>

      <Text style={styles.footer}>{t('auth.emergencyNote')}</Text>

      {/* Reachable without signing in — providers and app stores both expect
          the policies to be one tap from the first screen. */}
      <View style={styles.legalRow}>
        {[
          { label: t('legal.terms'), path: 'terms' },
          { label: t('legal.privacy'), path: 'privacy' },
          { label: t('legal.refunds'), path: 'refund-policy' },
        ].map((l) => (
          <Pressable key={l.path} onPress={() => Linking.openURL(`${WEB_ORIGIN}/${l.path}`)} hitSlop={6}>
            <Text style={styles.legalLink}>{l.label}</Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand, justifyContent: 'center', padding: 24 },
  back: {
    position: 'absolute', top: 46, left: 14, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6,
  },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  legalRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 14, marginTop: 10,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600',
    textDecorationLine: 'underline',
  },
  hero: { alignItems: 'center', marginBottom: 30 },
  logo: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 16 },
  tagline: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 10, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 24, paddingBottom: 26, ...shadow.raised },
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
  footer: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 26, lineHeight: 17 },
})
