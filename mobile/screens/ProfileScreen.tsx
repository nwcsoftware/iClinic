import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getMyPatient, updateMyPatient, type PatientInfo } from '../lib/api'
import { signOut } from '../lib/supabase'
import { colors, radius, type } from '../lib/theme'
import { useI18n, LANGUAGES, type Lang } from '../lib/i18n'
import { Avatar, Card, PrimaryButton } from '../components/ui'
import { notify } from '../lib/notify'

export default function ProfileScreen({
  patient: initial, onSignedOut, onPatientUpdated,
}: {
  patient: PatientInfo | null
  onSignedOut: () => void
  onPatientUpdated: (p: PatientInfo) => void
}) {
  const insets = useSafeAreaInsets()
  const { t, lang, setLang, isRTL } = useI18n()
  const [patient, setPatient] = useState<PatientInfo | null>(initial)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initial?.full_name ?? '')
  const [mobile, setMobile] = useState(initial?.mobile_number ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!initial) {
      getMyPatient().then((p) => {
        if (p) { setPatient(p); setName(p.full_name); setMobile(p.mobile_number) }
      }).catch(() => {})
    }
  }, [initial])

  async function save() {
    if (!name.trim() || mobile.trim().length < 6) { notify(t('profile.invalid')); return }
    setSaving(true)
    try {
      await updateMyPatient({ full_name: name.trim(), mobile_number: mobile.trim() })
      const updated = { ...(patient as PatientInfo), full_name: name.trim(), mobile_number: mobile.trim() }
      setPatient(updated)
      onPatientUpdated(updated)
      setEditing(false)
    } catch (e) {
      notify(t('profile.saveFailed'), e instanceof Error ? e.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[type.h1, isRTL && { textAlign: 'right' }]}>{t('profile.title')}</Text>

      <View style={{ alignItems: 'center', marginTop: 22, marginBottom: 20 }}>
        <Avatar name={patient?.full_name ?? 'Me'} size={84} />
        <Text style={[type.h1, { marginTop: 14 }]}>{patient?.full_name ?? '—'}</Text>
        {patient?.email ? <Text style={[type.sub, { marginTop: 4 }]}>{patient.email}</Text> : null}
      </View>

      {/* Language */}
      <Card style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Feather name="globe" size={17} color={colors.brand} />
          <Text style={type.h2}>{t('profile.language')}</Text>
        </View>
        <View style={{ gap: 8 }}>
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code as Lang)}
                style={({ pressed }) => [
                  styles.langRow,
                  active && { borderColor: colors.brand, backgroundColor: colors.brandSofter },
                  pressed && { backgroundColor: colors.brandSoft },
                ]}
              >
                <Text style={[styles.langNative, active && { color: colors.brand }]}>{l.native}</Text>
                <Text style={styles.langLabel}>{l.label}</Text>
                {active
                  ? <Feather name="check-circle" size={18} color={colors.brand} />
                  : <View style={{ width: 18 }} />}
              </Pressable>
            )
          })}
        </View>
      </Card>

      <Card>
        {editing ? (
          <View>
            <Text style={type.label}>{t('profile.fullName')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textFaint} />
            <Text style={[type.label, { marginTop: 16 }]}>{t('profile.mobile')}</Text>
            <TextInput style={styles.input} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholderTextColor={colors.textFaint} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable onPress={() => { setEditing(false); setName(patient?.full_name ?? ''); setMobile(patient?.mobile_number ?? '') }} style={styles.cancelBtn}>
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{t('profile.cancel')}</Text>
              </Pressable>
              <PrimaryButton label={t('profile.save')} onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View>
            <Row label={t('profile.fullName')} value={patient?.full_name ?? '—'} />
            <Row label={t('profile.mobile')} value={patient?.mobile_number ?? '—'} />
            <Row label={t('profile.email')} value={patient?.email ?? '—'} last />
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
              <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 14 }}>{t('profile.edit')}</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Row label={t('profile.about')} value={t('profile.aboutValue')} />
        <Text style={[type.sub, { marginTop: 4 }]}>{t('profile.aboutBody')}</Text>
      </Card>

      <Pressable
        onPress={async () => { await signOut(); onSignedOut() }}
        style={({ pressed }) => [styles.signOut, pressed && { backgroundColor: colors.dangerBg }]}
      >
        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 15 }}>{t('profile.signOut')}</Text>
      </Pressable>
    </ScrollView>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[rowStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 14.5, color: colors.ink, fontWeight: '600', maxWidth: '60%' },
})

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15.5, color: colors.ink, backgroundColor: '#FAFBFD', marginTop: 8,
  },
  editBtn: { marginTop: 14, alignSelf: 'flex-start' },
  cancelBtn: {
    borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  langNative: { fontSize: 15.5, fontWeight: '700', color: colors.ink, minWidth: 82 },
  langLabel: { flex: 1, fontSize: 13, color: colors.textMuted },
  signOut: {
    marginTop: 20, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#F3D2D2', backgroundColor: colors.card,
  },
})
