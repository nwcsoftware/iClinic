import { useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { initPatient } from '../lib/api'
import { colors, radius, shadow, type } from '../lib/theme'
import { PrimaryButton } from '../components/ui'
import { notify } from '../lib/notify'

// Shown after first login when no patient record exists yet.
export default function ProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!fullName.trim() || mobile.trim().length < 6) {
      notify('Please enter your name and mobile number'); return
    }
    setLoading(true)
    try {
      await initPatient({ full_name: fullName.trim(), mobile_number: mobile.trim() })
      onDone()
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.hero}>
        <Text style={styles.title}>Nice to meet you</Text>
        <Text style={styles.sub}>Two quick details and you're ready to book.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} placeholder="Your full name" placeholderTextColor={colors.textFaint}
          value={fullName} onChangeText={setFullName} />
        <Text style={[styles.label, { marginTop: 18 }]}>Mobile number</Text>
        <TextInput style={styles.input} placeholder="+961 xx xxx xxx" placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad" value={mobile} onChangeText={setMobile} />
        <PrimaryButton label="Continue" onPress={handleSave} loading={loading} style={{ marginTop: 20 }} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.brand, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 26 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  sub: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, ...shadow.raised },
  label: { ...type.label, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: colors.ink, backgroundColor: '#FAFBFD',
  },
})
