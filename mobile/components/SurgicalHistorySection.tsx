import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getMySurgeries, addSurgery, removeSurgery, type Surgery } from '../lib/mapApi'
import { colors, radius, type } from '../lib/theme'
import { useI18n } from '../lib/i18n'

// Surgical history, replacing the single free-text medical note.
//
// A doctor scanning this before a consultation needs "Appendectomy · 2019 ·
// AUBMC" as fields they can read in a second, not a paragraph to parse. So
// each procedure is its own entry rather than one growing text box.
export default function SurgicalHistorySection() {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<Surgery[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [place, setPlace] = useState('')

  const load = useCallback(async () => {
    try { setItems(await getMySurgeries()) }
    catch { /* section simply shows empty */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!name.trim()) { setError(t('surgery.needName')); return }
    setSaving(true)
    setError('')
    try {
      // A year alone is the realistic level of recall; stored as 1 January so
      // the field stays a real date rather than free text.
      const y = year.trim()
      const surgery_date = /^\d{4}$/.test(y) ? `${y}-01-01` : null
      const created = await addSurgery({
        procedure_name: name.trim(),
        surgery_date,
        hospital_or_clinic: place.trim() || null,
      })
      setItems((list) => [created, ...list])
      setName(''); setYear(''); setPlace('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('surgery.failed'))
    } finally {
      setSaving(false)
    }
  }

  async function drop(id: string) {
    setItems((list) => list.filter((s) => s.id !== id))
    try { await removeSurgery(id) } catch { load() }
  }

  return (
    <View style={styles.card}>
      <Text style={type.h2}>{t('surgery.title')}</Text>
      <Text style={[type.small, { marginTop: 3 }]}>{t('surgery.helper')}</Text>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: 18 }} />
      ) : items.length === 0 ? (
        <Text style={[type.sub, { marginTop: 12 }]}>{t('surgery.none')}</Text>
      ) : (
        <View style={{ marginTop: 12, gap: 9 }}>
          {items.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.dot}>
                <Feather name="activity" size={14} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.procedure_name}</Text>
                <Text style={[type.sub, { marginTop: 1 }]}>
                  {[
                    s.surgery_date
                      ? new Date(`${s.surgery_date}T00:00:00`).toLocaleDateString(locale, { year: 'numeric' })
                      : null,
                    s.hospital_or_clinic,
                  ].filter(Boolean).join(' · ') || t('surgery.noDetail')}
                </Text>
              </View>
              <Pressable onPress={() => drop(s.id)} hitSlop={10}>
                <Feather name="x" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {open ? (
        <View style={{ marginTop: 14 }}>
          <TextInput
            style={styles.input}
            placeholder={t('surgery.namePlaceholder')}
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={(v) => { setName(v); if (error) setError('') }}
          />
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 9 }}>
            <TextInput
              style={[styles.input, { width: 96 }]}
              placeholder={t('surgery.yearPlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={t('surgery.placePlaceholder')}
              placeholderTextColor={colors.textFaint}
              value={place}
              onChangeText={setPlace}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
            <Pressable onPress={() => { setOpen(false); setError('') }} style={styles.cancel}>
              <Text style={styles.cancelText}>{t('medical.cancel')}</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={saving} style={styles.save}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveText}>{t('medical.add')}</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.addBtn, pressed && { backgroundColor: colors.brandSoft }]}
        >
          <Feather name="plus" size={16} color={colors.brand} />
          <Text style={styles.addText}>{t('surgery.add')}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dot: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    color: colors.ink, backgroundColor: '#FAFBFD',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.brandSoft,
  },
  addText: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  cancel: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  save: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: radius.md, backgroundColor: colors.brand, minHeight: 44,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 8 },
})
