import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../../lib/theme'
import { iconForSpecialty } from '../../lib/theme'

export type MapFilter =
  | { kind: 'all' }
  | { kind: 'type'; value: 'hospital' | 'clinic' }
  | { kind: 'specialty'; value: string; label: string }

// Floating chips over the map. Horizontal so specialities can grow without
// stealing vertical space from the map itself.
export default function MapFilterChips({
  active, specialties, onChange, topInset,
}: {
  active: MapFilter
  specialties: { slug: string; name: string }[]
  onChange: (f: MapFilter) => void
  topInset: number
}) {
  const isActive = (f: MapFilter) =>
    f.kind === active.kind
    && (f.kind !== 'type' || (active.kind === 'type' && f.value === active.value))
    && (f.kind !== 'specialty' || (active.kind === 'specialty' && f.value === active.value))

  const base: { filter: MapFilter; label: string; icon: string }[] = [
    { filter: { kind: 'all' }, label: 'All', icon: 'map-marker-multiple-outline' },
    { filter: { kind: 'type', value: 'hospital' }, label: 'Hospitals', icon: 'hospital-building' },
    { filter: { kind: 'type', value: 'clinic' }, label: 'Clinics', icon: 'stethoscope' },
  ]

  return (
    <View style={[styles.wrap, { top: topInset }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {base.map((b) => (
          <Chip
            key={b.label}
            label={b.label}
            icon={b.icon}
            active={isActive(b.filter)}
            onPress={() => onChange(b.filter)}
          />
        ))}
        {specialties.map((s) => (
          <Chip
            key={s.slug}
            label={s.name}
            icon={iconForSpecialty(s.slug)}
            active={isActive({ kind: 'specialty', value: s.slug, label: s.name })}
            onPress={() => onChange({ kind: 'specialty', value: s.slug, label: s.name })}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function Chip({
  label, icon, active, onPress,
}: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipOn,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={15}
        color={active ? '#fff' : colors.brand}
      />
      <Text style={[styles.chipText, active && { color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  row: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...type.label, color: colors.brand, fontSize: 13 },
})
