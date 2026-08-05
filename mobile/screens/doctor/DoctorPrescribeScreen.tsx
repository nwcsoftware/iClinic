import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { savePrescription } from '../../lib/doctorApi'
import { colors, radius, type } from '../../lib/theme'
import { Card, TopBar } from '../../components/ui'
import { FadeInUp } from '../../components/motion'

const ROUTES = [
  { key: 'oral', label: 'By mouth' },
  { key: 'topical', label: 'On skin' },
  { key: 'injection', label: 'Injection' },
  { key: 'inhaled', label: 'Inhaled' },
  { key: 'drops', label: 'Drops' },
  { key: 'other', label: 'Other' },
]

// Common dosing patterns, each with the hours already filled in so a doctor
// does not have to type "08:00, 14:00, 20:00" for every prescription.
const PATTERNS = [
  { label: 'Once a day', freq: '1 time a day', times: ['08:00'] },
  { label: 'Twice a day', freq: '2 times a day', times: ['08:00', '20:00'] },
  { label: '3 times a day', freq: '3 times a day', times: ['08:00', '14:00', '20:00'] },
  { label: '4 times a day', freq: '4 times a day', times: ['08:00', '12:00', '16:00', '20:00'] },
  { label: 'Every 8 hours', freq: 'Every 8 hours', times: ['06:00', '14:00', '22:00'] },
  { label: 'As needed', freq: 'When needed', times: [] },
]

const DURATIONS = [3, 5, 7, 10, 14, 30]

type Draft = {
  medication_name: string
  dosage: string
  frequency: string
  times_of_day: string[]
  duration_days: number | null
  route: string
  notes: string
}

const blank = (): Draft => ({
  medication_name: '', dosage: '', frequency: '', times_of_day: [],
  duration_days: null, route: 'oral', notes: '',
})

export default function DoctorPrescribeScreen({
  visit, onBack, onSaved,
}: {
  visit: { id: string; patient_name: string; appointment_date: string; start_time: string }
  onBack: () => void
  onSaved: () => void
}) {
  const insets = useSafeAreaInsets()
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [meds, setMeds] = useState<Draft[]>([blank()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(i: number, patch: Partial<Draft>) {
    setMeds((m) => m.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  }

  function addTime(i: number, value: string) {
    const t = value.trim()
    if (!t) return
    const cur = meds[i].times_of_day
    if (!cur.includes(t)) update(i, { times_of_day: [...cur, t] })
  }

  async function save() {
    const filled = meds.filter((m) => m.medication_name.trim())
    if (filled.length === 0) { setError('Add at least one medication.'); return }

    setSaving(true)
    setError('')
    try {
      await savePrescription({
        appointment_id: visit.id,
        diagnosis_note: diagnosis.trim() || undefined,
        notes: notes.trim() || undefined,
        items: filled.map((m) => ({
          medication_name: m.medication_name.trim(),
          dosage: m.dosage.trim() || undefined,
          frequency: m.frequency.trim() || undefined,
          times_of_day: m.times_of_day.length ? m.times_of_day : undefined,
          duration_days: m.duration_days ?? undefined,
          route: m.route,
          notes: m.notes.trim() || undefined,
        })),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the prescription')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Prescribe" onBack={onBack} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 90 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <FadeInUp>
          <Card style={{ marginBottom: 16 }}>
            <Text style={type.label}>Visit</Text>
            <Text style={[type.h2, { marginTop: 3 }]}>{visit.patient_name}</Text>
            <Text style={[type.sub, { marginTop: 2 }]}>
              {new Date(`${visit.appointment_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{visit.start_time.slice(0, 5)}
            </Text>
          </Card>
        </FadeInUp>

        <FadeInUp delay={50}>
          <Text style={[type.label, { marginBottom: 8 }]}>Diagnosis (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="What you are treating"
            placeholderTextColor={colors.textFaint}
            value={diagnosis}
            onChangeText={setDiagnosis}
          />
        </FadeInUp>

        {meds.map((m, i) => (
          <FadeInUp key={i} delay={80}>
            <Card style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type.h2, { flex: 1 }]}>Medicine {i + 1}</Text>
                {meds.length > 1 ? (
                  <Pressable onPress={() => setMeds((x) => x.filter((_, k) => k !== i))} hitSlop={10}>
                    <Feather name="trash-2" size={17} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Amoxicillin 500mg"
                placeholderTextColor={colors.textFaint}
                value={m.medication_name}
                onChangeText={(v) => update(i, { medication_name: v })}
              />

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>How much each time</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1 tablet"
                placeholderTextColor={colors.textFaint}
                value={m.dosage}
                onChangeText={(v) => update(i, { dosage: v })}
              />

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>How often</Text>
              <View style={styles.chipWrap}>
                {PATTERNS.map((p) => {
                  const on = m.frequency === p.freq
                  return (
                    <Pressable key={p.label}
                      onPress={() => update(i, { frequency: p.freq, times_of_day: p.times })}
                      style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && { color: '#fff' }]}>{p.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>At what times</Text>
              <View style={styles.chipWrap}>
                {m.times_of_day.map((t) => (
                  <Pressable key={t} onPress={() => update(i, { times_of_day: m.times_of_day.filter((x) => x !== t) })}
                    style={[styles.chip, styles.timeChip]}>
                    <Text style={styles.timeChipText}>{t}</Text>
                    <Feather name="x" size={12} color={colors.doc} />
                  </Pressable>
                ))}
              </View>
              <TimeAdder onAdd={(v) => addTime(i, v)} />

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>For how long</Text>
              <View style={styles.chipWrap}>
                {DURATIONS.map((d) => {
                  const on = m.duration_days === d
                  return (
                    <Pressable key={d} onPress={() => update(i, { duration_days: on ? null : d })}
                      style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && { color: '#fff' }]}>{d} days</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>How to take it</Text>
              <View style={styles.chipWrap}>
                {ROUTES.map((r) => {
                  const on = m.route === r.key
                  return (
                    <Pressable key={r.key} onPress={() => update(i, { route: r.key })}
                      style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && { color: '#fff' }]}>{r.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={[type.label, { marginTop: 14, marginBottom: 7 }]}>Instructions (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
                placeholder="e.g. Take after food with a full glass of water"
                placeholderTextColor={colors.textFaint}
                value={m.notes}
                onChangeText={(v) => update(i, { notes: v })}
                multiline
              />
            </Card>
          </FadeInUp>
        ))}

        <Pressable onPress={() => setMeds((m) => [...m, blank()])}
          style={({ pressed }) => [styles.addMed, pressed && { backgroundColor: colors.docSofter }]}>
          <Feather name="plus" size={17} color={colors.doc} />
          <Text style={styles.addMedText}>Add another medicine</Text>
        </Pressable>

        <Text style={[type.label, { marginTop: 20, marginBottom: 7 }]}>Notes for the patient (optional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 74, textAlignVertical: 'top' }]}
          placeholder="Anything else they should know"
          placeholderTextColor={colors.textFaint}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable onPress={save} disabled={saving}
          style={({ pressed }) => [styles.saveBtn, pressed && { backgroundColor: colors.docDark }, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveText}>Save prescription</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

// Free-text so "08:00" and "after lunch" are both allowed.
function TimeAdder({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <View style={{ flexDirection: 'row', gap: 9 }}>
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder="e.g. 08:00 or after lunch"
        placeholderTextColor={colors.textFaint}
        value={v}
        onChangeText={setV}
        onSubmitEditing={() => { onAdd(v); setV('') }}
        returnKeyType="done"
      />
      <Pressable onPress={() => { onAdd(v); setV('') }} disabled={!v.trim()}
        style={({ pressed }) => [styles.timeAdd, pressed && { opacity: 0.7 }, !v.trim() && { opacity: 0.4 }]}>
        <Feather name="plus" size={17} color="#fff" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.doc, borderColor: colors.doc },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  timeChip: { backgroundColor: colors.docSoft, borderColor: colors.docSoft },
  timeChipText: { fontSize: 13, fontWeight: '800', color: colors.doc },
  timeAdd: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.doc,
    alignItems: 'center', justifyContent: 'center',
  },
  addMed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 14, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.docSoft, backgroundColor: colors.card,
  },
  addMedText: { color: colors.doc, fontWeight: '800', fontSize: 14.5 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
    borderWidth: 1, borderColor: '#F6C9C9',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  bar: {
    paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.doc, borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
