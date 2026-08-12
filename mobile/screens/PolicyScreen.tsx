import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, type } from '../lib/theme'
import { TopBar } from '../components/ui'
import { POLICIES, CONTACT, type Policy } from '../lib/policies'

export default function PolicyScreen({
  policy, onBack,
}: {
  policy: Policy['key']
  onBack: () => void
}) {
  const insets = useSafeAreaInsets()
  const p = POLICIES[policy]

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={p.title} onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {p.sections.map((s, i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
            {s.body.map((b, j) => (
              <Text key={j} style={styles.body}>{b}</Text>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={type.small}>Last updated {CONTACT.lastUpdated}</Text>
          <Text style={[type.small, { marginTop: 4 }]}>
            {CONTACT.legalName} · {CONTACT.location}
          </Text>
          <Text style={[type.small, { marginTop: 2 }]}>
            {CONTACT.email} · {CONTACT.phone}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 16.5, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  body: { fontSize: 14.5, lineHeight: 23, color: colors.text, marginBottom: 10 },
  footer: {
    marginTop: 10, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
})
