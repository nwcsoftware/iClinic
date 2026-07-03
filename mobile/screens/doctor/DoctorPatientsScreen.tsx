import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getDoctorPatients, type DoctorPatient } from '../../lib/doctorApi'
import { colors, radius, type } from '../../lib/theme'
import { Avatar, Card, EmptyState } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'

function age(dob: string | null): string | null {
  if (!dob) return null
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
  return years > 0 && years < 130 ? `${years} yrs` : null
}

export default function DoctorPatientsScreen() {
  const insets = useSafeAreaInsets()
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getDoctorPatients().then(setPatients).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = patients.filter((p) =>
    !query ||
    p.full_name.toLowerCase().includes(query.toLowerCase()) ||
    p.mobile_number.includes(query)
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <FadeInUp>
        <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingHorizontal: 20 }}>
          <Text style={type.h1}>My patients</Text>
          <Text style={[type.sub, { marginTop: 4 }]}>{patients.length} people under your care</Text>
          <View style={styles.searchWrap}>
            <Feather name="search" size={17} color={colors.textFaint} />
            <TextInput
              style={styles.search}
              placeholder="Search by name or phone"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        </View>
      </FadeInUp>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.doc} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="users" title={query ? 'No matches' : 'No patients yet'}
            sub={query ? 'Try a different search.' : 'Patients appear here after their first booking with you.'} />
        ) : (
          filtered.map((p, i) => (
            <FadeInUp key={p.id} delay={Math.min(i, 6) * 55}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar name={p.full_name} size={50} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2} numberOfLines={1}>{p.full_name}</Text>
                    <Text style={[type.sub, { marginTop: 2 }]}>
                      {[p.gender ? p.gender[0].toUpperCase() + p.gender.slice(1) : null, age(p.date_of_birth), p.mobile_number]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.visitPill}>
                    <Text style={styles.visitCount}>{p.visits}</Text>
                    <Text style={styles.visitLabel}>visit{p.visits === 1 ? '' : 's'}</Text>
                  </View>
                </View>
              </Card>
            </FadeInUp>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.ink },
  visitPill: {
    backgroundColor: colors.docSofter, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7,
    alignItems: 'center',
  },
  visitCount: { color: colors.doc, fontWeight: '800', fontSize: 16 },
  visitLabel: { color: colors.doc, fontWeight: '600', fontSize: 10.5 },
})
