import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { getDoctors, type Doctor } from '../lib/api'
import { colors, radius, iconForSpecialty, type } from '../lib/theme'
import { Avatar, Card, EmptyState, Rating } from '../components/ui'
import { FadeInUp } from '../components/motion'

export default function DoctorsScreen({ onPickDoctor }: { onPickDoctor: (d: Doctor) => void }) {
  const insets = useSafeAreaInsets()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [specFilter, setSpecFilter] = useState<string | null>(null)

  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const specialties = useMemo(() => [...new Map(
    doctors.filter((d) => d.specialty_slug).map((d) => [d.specialty_slug!, d.specialty_name ?? d.specialty ?? ''])
  ).entries()], [doctors])

  const filtered = doctors.filter((d) => {
    if (specFilter && d.specialty_slug !== specFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return d.full_name.toLowerCase().includes(q) || (d.specialty_name ?? d.specialty ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FadeInUp>
        <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8, paddingHorizontal: 20 }}>
          <Text style={type.h1}>Find a doctor</Text>
          <View style={styles.searchWrap}>
            <Feather name="search" size={17} color={colors.textFaint} />
            <TextInput
              style={styles.search}
              placeholder="Search by name or specialty"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Feather name="x" size={16} color={colors.textFaint} />
              </Pressable>
            )}
          </View>
        </View>
      </FadeInUp>

      {specialties.length > 1 && (
        <FadeInUp delay={80}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 14 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            <Pressable onPress={() => setSpecFilter(null)}
              style={[styles.filterChip, !specFilter && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, !specFilter && styles.filterChipTextActive]}>All</Text>
            </Pressable>
            {specialties.map(([slug, name]) => {
              const active = specFilter === slug
              return (
                <Pressable key={slug} onPress={() => setSpecFilter(active ? null : slug)}
                  style={[styles.filterChip, active && styles.filterChipActive, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  <MaterialCommunityIcons
                    name={iconForSpecialty(slug) as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={15}
                    color={active ? '#fff' : colors.textMuted}
                  />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </FadeInUp>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="search" title="No doctors found" sub="Try a different search or filter." />
        ) : (
          filtered.map((d, i) => (
            <FadeInUp key={d.id} delay={Math.min(i, 6) * 55}>
              <Card onPress={() => onPickDoctor(d)} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar name={d.full_name} size={54} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h2} numberOfLines={1}>{d.full_name}</Text>
                    <Text style={[type.sub, { marginTop: 2 }]}>{d.specialty_name ?? d.specialty ?? 'Specialist'}</Text>
                    <View style={{ marginTop: 4 }}><Rating rating={d.rating} count={d.review_count} /></View>
                  </View>
                  <View style={styles.bookPill}><Text style={styles.bookPillText}>Book</Text></View>
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
  filterChip: {
    backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  bookPill: { backgroundColor: colors.brandSoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  bookPillText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
})
