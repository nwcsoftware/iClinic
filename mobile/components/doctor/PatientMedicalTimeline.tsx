import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors, radius, statusColors, type } from '../../lib/theme'
import { Badge } from '../ui'
import type { PatientDetail } from '../../lib/doctorApi'

type Visit = PatientDetail['visits'][number]

function longDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// A chronological record of consultations, newest first.
//
// The rail on the left is what makes it read as one continuous history rather
// than a stack of unrelated cards — which is the point when you are catching up
// on a patient in the thirty seconds before they walk in.
export default function PatientMedicalTimeline({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="clock" size={18} color={colors.textFaint} />
        <Text style={[type.sub, { flex: 1 }]}>
          No visits recorded yet. Consultation notes you write will build up here.
        </Text>
      </View>
    )
  }

  return (
    <View>
      {visits.map((v, i) => (
        <VisitEntry key={v.id} visit={v} last={i === visits.length - 1} />
      ))}
    </View>
  )
}

function VisitEntry({ visit, last }: { visit: Visit; last: boolean }) {
  const sc = statusColors[visit.status] ?? statusColors.scheduled
  const hasClinical = Boolean(
    visit.diagnosis || visit.treatment || visit.doctor_notes || visit.follow_up,
  )

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Rail */}
      <View style={styles.rail}>
        <View style={[styles.node, visit.status === 'completed' && { backgroundColor: colors.doc, borderColor: colors.doc }]}>
          {visit.status === 'completed' ? <Feather name="check" size={10} color="#fff" /> : null}
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.date}>{longDate(visit.appointment_date)}</Text>
          <Text style={type.small}>{visit.start_time.slice(0, 5)}</Text>
          <View style={{ flex: 1 }} />
          <Badge label={sc.label} bg={sc.bg} fg={sc.fg} />
        </View>

        {visit.location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={colors.textFaint} />
            <Text style={type.small} numberOfLines={1}>
              {visit.location.name}{visit.location.city ? ` · ${visit.location.city}` : ''}
            </Text>
          </View>
        ) : null}

        {visit.reason ? (
          <View style={{ marginTop: 9 }}>
            <Text style={styles.fieldLabel}>Reason for visit</Text>
            <Text style={styles.fieldValue}>{visit.reason}</Text>
          </View>
        ) : null}

        {/* Another doctor's consultation: the visit is visible, their clinical
            record is not. Said plainly rather than silently omitted. */}
        {!visit.mine ? (
          <View style={styles.locked}>
            <Feather name="lock" size={12} color={colors.textMuted} />
            <Text style={[type.small, { flex: 1 }]}>
              Recorded by another doctor — their consultation notes are private
            </Text>
          </View>
        ) : hasClinical ? (
          <View style={{ marginTop: 4 }}>
            <Field label="Diagnosis" value={visit.diagnosis} />
            <Field label="Treatment" value={visit.treatment} />
            <Field label="Notes" value={visit.doctor_notes} />
            <Field label="Follow-up" value={visit.follow_up} accent />
          </View>
        ) : visit.is_past ? (
          <Text style={[type.small, { marginTop: 9, fontStyle: 'italic' }]}>
            No consultation notes recorded for this visit
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function Field({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  if (!value) return null
  return (
    <View style={{ marginTop: 9 }}>
      <Text style={[styles.fieldLabel, accent && { color: colors.doc }]}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  rail: { width: 26, alignItems: 'center' },
  node: {
    width: 16, height: 16, borderRadius: 8, marginTop: 16,
    borderWidth: 2, borderColor: colors.borderStrong, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    marginBottom: 12, marginLeft: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  date: { fontSize: 14, fontWeight: '800', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  fieldLabel: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted },
  fieldValue: { fontSize: 14.5, lineHeight: 21, color: colors.text, marginTop: 2 },
  locked: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11,
    backgroundColor: colors.bg, borderRadius: radius.sm, padding: 9,
  },
  empty: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
})
