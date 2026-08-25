import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { reportPayment } from '../lib/doctorApi'
import { colors, radius, type } from '../lib/theme'

const METHODS: { key: 'whish' | 'omt' | 'bank_transfer' | 'cash'; label: string }[] = [
  { key: 'whish', label: 'Whish Money' },
  { key: 'omt', label: 'OMT' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'cash', label: 'Cash' },
]

// Shown wherever a doctor might have just paid outside the app. Submitting
// queues the payment for approval — it never activates anything by itself.
export default function ReportPaymentForm({
  plans, onDone,
}: {
  plans: { key: string; months: number; amount_usd: number; label: string }[]
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<typeof METHODS[number]['key']>('whish')
  const [plan, setPlan] = useState(plans[0]?.key ?? 'm1')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setSaving(true)
    setError('')
    try {
      await reportPayment({ plan, method, reference: reference.trim() || undefined })
      setSent(true)
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setSaving(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.doneBox}>
        <Feather name="check-circle" size={18} color={colors.success} />
        <Text style={styles.doneText}>
          Thanks, we&apos;ve got it. Your account is usually activated within 24 hours.
        </Text>
      </View>
    )
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { backgroundColor: colors.docSofter }]}>
        <Feather name="upload" size={16} color={colors.doc} />
        <Text style={styles.triggerText}>I&apos;ve paid, tell the clinic</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={type.h2}>Report your payment</Text>
      <Text style={[type.sub, { marginTop: 3 }]}>
        Send this after paying so we can activate you.
      </Text>

      <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>How did you pay?</Text>
      <View style={styles.chips}>
        {METHODS.map((m) => {
          const on = m.key === method
          return (
            <Pressable key={m.key} onPress={() => setMethod(m.key)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{m.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {plans.length > 1 ? (
        <>
          <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>What did you pay for?</Text>
          <View style={styles.chips}>
            {plans.map((p) => {
              const on = p.key === plan
              return (
                <Pressable key={p.key} onPress={() => setPlan(p.key)}
                  style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: '#fff' }]}>
                    {p.label} · ${p.amount_usd.toFixed(2)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </>
      ) : null}

      <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Reference number (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="The transfer or receipt number"
        placeholderTextColor={colors.textFaint}
        value={reference}
        onChangeText={setReference}
        autoCapitalize="characters"
      />
      <Text style={[type.small, { marginTop: 6 }]}>
        It helps us find your payment faster, but you can send without it.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable onPress={() => setOpen(false)}
          style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} disabled={saving}
          style={({ pressed }) => [styles.send, pressed && { backgroundColor: colors.docDark }]}>
          {saving ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.docSoft, backgroundColor: colors.card,
  },
  triggerText: { color: colors.doc, fontWeight: '800', fontSize: 14.5 },
  card: {
    marginTop: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: 1.5, borderColor: colors.docSoft,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 13,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.doc, borderColor: colors.doc },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  cancel: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  send: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13,
    borderRadius: radius.md, backgroundColor: colors.doc, minHeight: 46,
  },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  doneBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 12,
    backgroundColor: colors.successBg, borderRadius: radius.md, padding: 13,
  },
  doneText: { flex: 1, color: '#0E7E58', fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600' },
})
