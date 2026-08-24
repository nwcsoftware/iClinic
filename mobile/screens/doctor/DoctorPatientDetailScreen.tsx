import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getPatientDetail, type PatientDetail, type RxItem } from '../../lib/doctorApi'
import { colors, radius, statusColors, type } from '../../lib/theme'
import { Avatar, Badge, Card, TopBar } from '../../components/ui'
import { FadeInUp } from '../../components/motion'
import PatientMedicalTimeline from '../../components/doctor/PatientMedicalTimeline'

function age(dob: string | null): string | null {
  if (!dob) return null
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
  return y > 0 && y < 130 ? `${y} yrs` : null
}

function longDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Allergies get their own alarming treatment. A doctor scanning this screen
// before prescribing needs them to be the hardest thing to miss.
function AlertChips({ items, tone }: { items: string[]; tone: 'danger' | 'amber' }) {
  const bg = tone === 'danger' ? colors.dangerBg : colors.amberBg
  const fg = tone === 'danger' ? colors.danger : colors.amber
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
      {items.map((i) => (
        <View key={i} style={{ backgroundColor: bg, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: fg, fontWeight: '800', fontSize: 13 }}>{i}</Text>
        </View>
      ))}
    </View>
  )
}

function MedLine({ m }: { m: RxItem }) {
  const bits = [m.dosage, m.frequency, m.times_of_day?.length ? m.times_of_day.join('/') : null, m.duration]
    .filter(Boolean).join(' · ')
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{m.medication_name}</Text>
      {bits ? <Text style={[type.sub, { marginTop: 1 }]}>{bits}</Text> : null}
      {m.notes ? <Text style={[type.small, { marginTop: 1 }]}>{m.notes}</Text> : null}
    </View>
  )
}

export default function DoctorPatientDetailScreen({
  patientId, onBack, onPrescribe,
}: {
  patientId: string
  onBack: () => void
  onPrescribe: (visit: { id: string; patient_name: string; appointment_date: string; start_time: string }) => void
}) {
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<PatientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await getPatientDetail(patientId)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load patient') }
    finally { setLoading(false) }
  }, [patientId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Patient" onBack={onBack} />
        <ActivityIndicator color={colors.doc} style={{ marginTop: 40 }} />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Patient" onBack={onBack} />
        <Text style={[type.sub, { textAlign: 'center', marginTop: 40 }]}>{error || 'Not found'}</Text>
      </View>
    )
  }

  const p = data.patient
  const allergies = p.allergies ?? []
  const conditions = p.chronic_conditions ?? []

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Patient" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}
        showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <FadeInUp>
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <Avatar name={p.full_name} size={76} />
            <Text style={[type.h1, { marginTop: 12 }]}>{p.full_name}</Text>
            <Text style={[type.sub, { marginTop: 3 }]}>
              {[p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : null, age(p.date_of_birth), p.blood_type]
                .filter(Boolean).join(' · ') || '—'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => Linking.openURL(`tel:${p.mobile_number}`)}
                style={({ pressed }) => [styles.contactBtn, pressed && { backgroundColor: colors.docSoft }]}>
                <Feather name="phone" size={15} color={colors.doc} />
                <Text style={styles.contactText}>{p.mobile_number}</Text>
              </Pressable>
            </View>
          </View>
        </FadeInUp>

        {/* At-a-glance history */}
        <FadeInUp delay={40}>
          <View style={styles.summaryRow}>
            <Stat label="Visits" value={String(data.stats.total_visits)} />
            <Stat label="Completed" value={String(data.stats.completed_visits)} />
            <Stat label="First seen" value={shortDate(data.stats.first_visit)} />
            <Stat label="Last seen" value={shortDate(data.stats.last_visit)} />
          </View>
          {data.stats.common_reason ? (
            <View style={styles.commonRow}>
              <Feather name="repeat" size={13} color={colors.doc} />
              <Text style={[type.sub, { flex: 1 }]}>
                Most often here for <Text style={{ fontWeight: '800', color: colors.ink }}>{data.stats.common_reason}</Text>
              </Text>
            </View>
          ) : null}
        </FadeInUp>

        {/* Medical alerts first — this is the part that changes prescribing */}
        <FadeInUp delay={60}>
          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="alert-triangle" size={16} color={allergies.length ? colors.danger : colors.textFaint} />
              <Text style={type.h2}>Allergies</Text>
            </View>
            {allergies.length ? <AlertChips items={allergies} tone="danger" />
              : <Text style={[type.sub, { marginTop: 6 }]}>None declared by the patient.</Text>}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <Feather name="activity" size={16} color={conditions.length ? colors.amber : colors.textFaint} />
              <Text style={type.h2}>Long-term illnesses</Text>
            </View>
            {conditions.length ? <AlertChips items={conditions} tone="amber" />
              : <Text style={[type.sub, { marginTop: 6 }]}>None declared by the patient.</Text>}

            {p.medical_notes ? (
              <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <Text style={type.label}>Patient notes</Text>
                <Text style={[type.body, { marginTop: 4 }]}>{p.medical_notes}</Text>
              </View>
            ) : null}
          </Card>
        </FadeInUp>

        {/* Surgical history */}
        {data.surgeries.length > 0 ? (
          <FadeInUp delay={90}>
            <Card style={{ marginBottom: 14 }}>
              <Text style={type.h2}>Surgical history</Text>
              <View style={{ marginTop: 10, gap: 8 }}>
                {data.surgeries.map((sg) => (
                  <View key={sg.id} style={{ flexDirection: 'row', gap: 9 }}>
                    <Feather name="activity" size={14} color={colors.doc} style={{ marginTop: 3 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>
                        {sg.procedure_name}
                      </Text>
                      <Text style={[type.sub, { marginTop: 1 }]}>
                        {[sg.surgery_date ? sg.surgery_date.slice(0, 4) : null, sg.hospital_or_clinic]
                          .filter(Boolean).join(' · ') || 'No date given'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </FadeInUp>
        ) : null}

        {/* Current medication */}
        {data.prescriptions.length > 0 ? (
          <FadeInUp delay={110}>
            <Text style={[type.h2, { marginTop: 8, marginBottom: 10 }]}>Prescriptions</Text>
            {data.prescriptions.slice(0, 6).map((rx) => (
              <Card key={rx.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[type.label, { flex: 1 }]}>{longDate(rx.created_at.slice(0, 10))}</Text>
                  {rx.active ? <Badge label="Active" bg={colors.successBg} fg="#0E7E58" /> : null}
                  {!rx.mine ? <Badge label="Another doctor" bg="#EEF0F4" fg="#7A8496" /> : null}
                </View>
                {rx.diagnosis_note ? (
                  <Text style={[type.sub, { marginTop: 6 }]}>{rx.diagnosis_note}</Text>
                ) : null}
                {rx.items.map((m, i) => <MedLine key={m.id ?? i} m={m} />)}
              </Card>
            ))}
          </FadeInUp>
        ) : null}

        {/* Consultation timeline */}
        <FadeInUp delay={160}>
          <Text style={[type.h2, { marginTop: 12, marginBottom: 4 }]}>
            Consultation history
          </Text>
          <Text style={[type.sub, { marginBottom: 14 }]}>
            {data.stats.total_visits} visit{data.stats.total_visits === 1 ? '' : 's'} with you
          </Text>
          <PatientMedicalTimeline visits={data.visits} />

          {data.visits.some((v) => v.is_past) ? (
            <Text style={[type.small, { marginTop: 6, marginBottom: 10 }]}>
              Tap a finished visit from My visits to record or update its notes.
            </Text>
          ) : null}
        </FadeInUp>
      </ScrollView>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function shortDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 12,
    paddingHorizontal: 8, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.doc },
  statLabel: { fontSize: 10.5, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  commonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
    backgroundColor: colors.docSofter, borderRadius: radius.md, padding: 11,
  },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.docSoft, backgroundColor: colors.card,
  },
  contactText: { color: colors.doc, fontWeight: '700', fontSize: 14 },
  dateBox: { backgroundColor: colors.docSofter, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  dateText: { color: colors.doc, fontWeight: '800', fontSize: 12 },
  timeText: { color: colors.doc, fontWeight: '600', fontSize: 11, marginTop: 1 },
})
