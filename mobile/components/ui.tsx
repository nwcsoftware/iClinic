import { type ReactNode } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../lib/theme'

// ---------------------------------------------------------------------------
// Screen — safe-area aware page container. On wide (desktop) web viewports the
// app is framed at phone width; on actual phones it fills edge-to-edge.
// ---------------------------------------------------------------------------
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>
}

// ---------------------------------------------------------------------------
// TopBar — header with optional back button, safe-area padded.
// ---------------------------------------------------------------------------
export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  const padTop = Math.max(insets.top, Platform.OS === 'web' ? 14 : 10)
  return (
    <View style={[styles.topbar, { paddingTop: padTop }]}>
      <View style={styles.topbarRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}>
            <Feather name="chevron-left" size={24} color={colors.ink} />
          </Pressable>
        ) : <View style={styles.backBtn} />}
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.backBtn}>{right}</View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function PrimaryButton({
  label, onPress, loading, disabled, style,
}: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>
}) {
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { transform: [{ scale: 0.98 }], backgroundColor: colors.brandDark },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{label}</Text>}
    </Pressable>
  )
}

export function GhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, pressed && { backgroundColor: colors.brandSofter }, style]}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{children}</View>
}

// ---------------------------------------------------------------------------
// Avatar — initials circle
// ---------------------------------------------------------------------------
const AVATAR_TONES = [
  { bg: '#EAEEFC', fg: '#2748B8' },
  { bg: '#E6F7F1', fg: '#0E7E58' },
  { bg: '#FEF6E7', fg: '#B45309' },
  { bg: '#FDEDF4', fg: '#B0246B' },
]
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  const tone = AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length]
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: tone.fg, fontWeight: '800', fontSize: size * 0.38 }}>{initials || '👤'}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, sub }: { icon: keyof typeof Feather.glyphMap; title: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 }}>
      <View style={{
        width: 68, height: 68, borderRadius: 34, backgroundColor: colors.brandSoft,
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Feather name={icon} size={28} color={colors.brand} />
      </View>
      <Text style={[type.h2, { textAlign: 'center' }]}>{title}</Text>
      {sub ? <Text style={[type.sub, { textAlign: 'center', marginTop: 6 }]}>{sub}</Text> : null}
    </View>
  )
}

// Star + numeric rating (renders nothing until ratings are migrated).
export function Rating({ rating, count }: { rating?: number | null; count?: number | null }) {
  if (rating == null) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <MaterialCommunityIcons name="star" size={14} color={colors.star} />
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>{Number(rating).toFixed(1)}</Text>
      {count ? <Text style={{ fontSize: 12, color: colors.textFaint }}>({count})</Text> : null}
    </View>
  )
}

// Round specialty icon chip.
export function SpecIcon({ name, size = 20, boxSize = 40 }: { name: string; size?: number; boxSize?: number }) {
  return (
    <View style={{
      width: boxSize, height: boxSize, borderRadius: boxSize / 2, backgroundColor: colors.brandSoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={colors.brand} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text style={type.h2}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13.5 }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  topbarRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 21, color: colors.ink, fontWeight: '600' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16.5, fontWeight: '700', color: colors.ink },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
    backgroundColor: colors.card,
  },
  ghostBtnText: { color: colors.brand, fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
})
