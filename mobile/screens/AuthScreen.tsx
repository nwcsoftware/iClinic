import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { devLogin } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { PrimaryButton } from '../components/ui'
import { AmbientBackground, FadeInUp } from '../components/motion'
import { notify } from '../lib/notify'

// Patient sign-in. Local testing uses a direct passwordless login minted
// server-side; production should use the Supabase email-OTP flow.
export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.includes('@')) { notify('Please enter a valid email'); return }
    setLoading(true)
    try {
      const { access_token, refresh_token } = await devLogin(email.trim())
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error) { notify('Login failed', error.message); return }
      onAuthed()
    } catch (e) {
      notify('Could not sign in', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AmbientBackground tone="onBrand" />
      <FadeInUp>
        <View style={styles.hero}>
          <View style={styles.logo}><MaterialCommunityIcons name="hospital" size={32} color="#fff" /></View>
          <Text style={styles.appName}>iClinic</Text>
          <Text style={styles.tagline}>The right doctor, in minutes.{'\n'}Describe how you feel — we handle the rest.</Text>
        </View>
      </FadeInUp>

      <FadeInUp delay={100}>
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
          onChangeText={setEmail}
          onSubmitEditing={handleLogin}
        />
        <PrimaryButton label="Continue" onPress={handleLogin} loading={loading} style={{ marginTop: 14 }} />
        <Text style={styles.hint}>By continuing you agree to receive appointment updates by email.</Text>
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
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  logoIcon: { color: '#fff', fontSize: 34, fontWeight: '800' },
  appName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 10, lineHeight: 21 },
  card: {
    backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, ...shadow.raised,
  },
  label: { ...type.label, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  footer: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 26, lineHeight: 17 },
})
