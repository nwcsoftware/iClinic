import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { updateMyPatient, BLOOD_TYPES, type PatientInfo } from '../lib/api'
import { colors, radius, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'
import { PrimaryButton, TopBar } from '../components/ui'
import { FadeInUp } from '../components/motion'

// A list of short free-text labels the patient adds one at a time.
function ChipList({
  items, onChange, placeholder, addLabel, emptyLabel,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  addLabel: string
  emptyLabel: string
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const value = draft.trim().replace(/\s+/g, ' ')
    if (!value) return
    // Case-insensitive de-dupe so "Penicillin" and "penicillin" don't both land.
    if (!items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      onChange([...items, value.slice(0, 80)])
    }
    setDraft('')
  }

  return (
    <View>
      {items.length === 0 ? (
        <Text style={[type.sub, { marginBottom: 10 }]}>{emptyLabel}</Text>
      ) : (
        <View style={styles.chipWrap}>
          {items.map((item) => (
            <View key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
              <Pressable onPress={() => onChange(items.filter((i) => i !== item))} hitSlop={8}>
                <Feather name="x" size={14} color={colors.brand} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }, !draft.trim() && { opacity: 0.4 }]}
        >
          <Feather name="plus" size={17} color="#fff" />
        </Pressable>
      </View>
      <Text style={[type.small, { marginTop: 6 }]}>{addLabel}</Text>
    </View>
  )
}

export default function MedicalInfoScreen({
  patient, onBack, onSaved,
}: {
  patient: PatientInfo | null
  onBack: () => void
  onSaved: (p: PatientInfo) => void
}) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()

  const [allergies, setAllergies] = useState<string[]>(patient?.allergies ?? [])
  const [conditions, setConditions] = useState<string[]>(patient?.chronic_conditions ?? [])
  const [bloodType, setBloodType] = useState<string | null>(patient?.blood_type ?? null)
  const [notes, setNotes] = useState(patient?.medical_notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await updateMyPatient({
        allergies,
        chronic_conditions: conditions,
        blood_type: bloodType,
        medical_notes: notes.trim() || null,
        // Recording that they reviewed this is what stops the home-screen
        // prompt, including for someone who genuinely has nothing to declare.
        mark_reviewed: true,
      })
      if (res.patient) onSaved(res.patient)
      setSaved(true)
      setTimeout(onBack, 700)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('medical.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title={t('medical.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeInUp>
          <View style={styles.intro}>
            <Feather name="shield" size={16} color={colors.brand} />
            <Text style={[type.sub, { flex: 1 }]}>{t('medical.sub')}</Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={60}>
          <View style={styles.card}>
            <Text style={type.h2}>{t('medical.allergies')}</Text>
            <View style={{ marginTop: 12 }}>
              <ChipList
                items={allergies}
                onChange={setAllergies}
                placeholder={t('medical.allergyPlaceholder')}
                addLabel={t('medical.addAllergy')}
                emptyLabel={t('medical.noAllergies')}
              />
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={110}>
          <View style={styles.card}>
            <Text style={type.h2}>{t('medical.conditions')}</Text>
            <View style={{ marginTop: 12 }}>
              <ChipList
                items={conditions}
                onChange={setConditions}
                placeholder={t('medical.conditionPlaceholder')}
                addLabel={t('medical.addCondition')}
                emptyLabel={t('medical.noConditions')}
              />
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={160}>
          <View style={styles.card}>
            <Text style={type.h2}>{t('medical.bloodType')}</Text>
            <View style={[styles.chipWrap, { marginTop: 12 }]}>
              {BLOOD_TYPES.map((bt) => {
                const active = bt === bloodType
                return (
                  <Pressable key={bt} onPress={() => setBloodType(active ? null : bt)}
                    style={[styles.bloodChip, active && styles.bloodChipActive]}>
                    <Text style={[styles.bloodText, active && { color: '#fff' }]}>{bt}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={210}>
          <View style={styles.card}>
            <Text style={type.h2}>{t('medical.notes')}</Text>
            <TextInput
              style={styles.notes}
              placeholder={t('medical.notesPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </FadeInUp>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={saved ? t('medical.saved') : t('medical.save')}
          onPress={save}
          loading={saving}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.brandSofter,
    borderRadius: radius.md, padding: 13, marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandSoft,
    borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 13,
  },
  chipText: { color: colors.brand, fontWeight: '700', fontSize: 13.5 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  addInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: '#FAFBFD',
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  bloodChip: {
    minWidth: 54, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  bloodChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  bloodText: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  notes: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, minHeight: 90, color: colors.ink, backgroundColor: '#FAFBFD',
    textAlignVertical: 'top', marginTop: 12,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8,
    backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 11,
    borderWidth: 1, borderColor: '#F6C9C9',
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
})
