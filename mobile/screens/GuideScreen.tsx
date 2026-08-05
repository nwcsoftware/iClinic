import { useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, radius, shadow, type } from '../lib/theme'
import { useI18n, type StringKey } from '../lib/i18n'
import { AmbientBackground, ScaleIn } from '../components/motion'

export const GUIDE_SEEN_KEY = 'iclinic.guideSeen'

export async function hasSeenGuide(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(GUIDE_SEEN_KEY)) === '1' } catch { return false }
}

export async function markGuideSeen(): Promise<void> {
  try { await AsyncStorage.setItem(GUIDE_SEEN_KEY, '1') } catch { /* non-fatal */ }
}

type Slide = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  title: StringKey
  body: StringKey
  tint: string
}

const SLIDES: Slide[] = [
  { icon: 'stethoscope', title: 'guide.title1', body: 'guide.body1', tint: colors.brand },
  { icon: 'calendar-check', title: 'guide.title2', body: 'guide.body2', tint: '#0E9F6E' },
  { icon: 'pill', title: 'guide.title3', body: 'guide.body3', tint: '#B45309' },
  { icon: 'phone-alert', title: 'guide.title4', body: 'guide.body4', tint: colors.danger },
  { icon: 'shield-account', title: 'guide.title5', body: 'guide.body5', tint: colors.brand },
]

export default function GuideScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { t, isRTL } = useI18n()
  const [index, setIndex] = useState(0)
  const scroller = useRef<ScrollView>(null)

  // The frame is capped at 430px on wide web, so measure the actual container.
  const [pageWidth, setPageWidth] = useState(width)

  function goTo(i: number) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i))
    setIndex(next)
    scroller.current?.scrollTo({ x: next * pageWidth, animated: true })
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageWidth))
    if (i !== index) setIndex(i)
  }

  async function finish() {
    await markGuideSeen()
    onDone()
  }

  const last = index === SLIDES.length - 1

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}
      onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
      <AmbientBackground tone="soft" />

      <View style={[styles.top, { paddingTop: Math.max(insets.top, 16) + 6 }]}>
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>{t('guide.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.page, { width: pageWidth }]}>
            <ScaleIn>
              <View style={[styles.iconWrap, { backgroundColor: `${s.tint}18` }]}>
                <MaterialCommunityIcons name={s.icon} size={48} color={s.tint} />
              </View>
            </ScaleIn>
            <Text style={[type.hero, { textAlign: 'center', marginTop: 30 }]}>{t(s.title)}</Text>
            <Text style={[type.body, { textAlign: 'center', color: colors.textMuted, marginTop: 14 }]}>
              {t(s.body)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 18) + 6 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>

        <Pressable
          onPress={() => (last ? finish() : goTo(index + 1))}
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: colors.brandDark }]}
        >
          <Text style={styles.ctaText}>{last ? t('guide.start') : t('guide.next')}</Text>
          {!last ? (
            <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={18} color="#fff" />
          ) : null}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 4 },
  skip: { color: colors.textMuted, fontWeight: '700', fontSize: 14.5 },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  iconWrap: {
    width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center',
  },
  bottom: { paddingHorizontal: 24, paddingTop: 10, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotOn: { width: 22, backgroundColor: colors.brand },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 16, ...shadow.raised,
  },
  ctaText: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
})
