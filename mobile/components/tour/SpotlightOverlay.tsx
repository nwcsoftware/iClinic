import { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, Platform, useWindowDimensions,
  AccessibilityInfo, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { colors, radius, shadow, type } from '../../lib/theme'
import { useI18n } from '../../lib/i18n'
import { useTour, type Rect } from '../../lib/tour'

// ---------------------------------------------------------------------------
// The dimmed, blurred layer with one live control cut out of it.
//
// The hole is a real hole: nothing is painted over the target, so what shows
// through is the actual control, at full sharpness and full brightness.
//
// Dim and blur are deliberately two separate layers. The dim is one element
// with a clip-path whose inner subpath is wound in reverse, which the nonzero
// fill rule turns into a cut-out, giving an exactly rounded hole. The blur
// cannot use that same trick: a backdrop-filter is not reliably clipped by a
// clip-path, so the filter kept sampling across the hole and the spotlighted
// control came out blurred. Instead the blur lives in four panels that stop at
// the edges of the hole, so no blurring element overlaps the target at all.
//
// The cost is four small corner slivers, between the rounded hole and the
// rectangular panels, that are dimmed but not blurred. At this radius that is
// a couple of pixels and invisible; a blurred spotlight is not.
//
// Native has no backdrop filter, so it gets the panels for dimming and no blur.
// ---------------------------------------------------------------------------

const PAD = 8            // halo around the target
const CORNER = 16        // hole corner radius
const BUBBLE_GAP = 14    // distance from hole to message
const EDGE = 14          // keep the bubble this far from the screen edge

const isWeb = Platform.OS === 'web'

/** Rounded-rect path, wound the opposite way to the outer rect so it cuts a hole. */
function holePath(w: number, h: number, r: Rect, radius: number) {
  const x1 = Math.max(0, r.x - PAD)
  const y1 = Math.max(0, r.y - PAD)
  const x2 = Math.min(w, r.x + r.width + PAD)
  const y2 = Math.min(h, r.y + r.height + PAD)
  const rad = Math.max(0, Math.min(radius, (x2 - x1) / 2, (y2 - y1) / 2))
  // Outer rect clockwise, inner rounded rect counter-clockwise.
  return (
    `M0 0 H${w} V${h} H0 Z ` +
    `M${x1 + rad} ${y1} ` +
    `H${x2 - rad} A${rad} ${rad} 0 0 1 ${x2} ${y1 + rad} ` +
    `V${y2 - rad} A${rad} ${rad} 0 0 1 ${x2 - rad} ${y2} ` +
    `H${x1 + rad} A${rad} ${rad} 0 0 1 ${x1} ${y2 - rad} ` +
    `V${y1 + rad} A${rad} ${rad} 0 0 1 ${x1 + rad} ${y1} Z`
  )
}

export default function SpotlightOverlay() {
  const { active, step, index, total, next, skip, rect, remeasure } = useTour()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduceMotion(v) })
      .catch(() => { /* assume motion is fine */ })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v))
    return () => { alive = false; sub?.remove?.() }
  }, [])

  // A rotation or resize moves the target, so measure again.
  useEffect(() => { if (active) remeasure() }, [width, height, active, remeasure])

  if (!active || !step) return null

  const last = index + 1 >= total
  const transition = reduceMotion ? undefined : 'clip-path 320ms cubic-bezier(0.22, 1, 0.36, 1)'

  // --- the dim and blur layers, with the target cut out of both -------------
  let dim: React.ReactNode
  if (!rect) {
    // Not measured yet: dim everything, no hole, so the step still reads.
    dim = <View style={[StyleSheet.absoluteFill, styles.scrim, isWeb && (webBlur as ViewStyle)]} />
  } else {
    const x1 = Math.max(0, rect.x - PAD)
    const y1 = Math.max(0, rect.y - PAD)
    const x2 = Math.min(width, rect.x + rect.width + PAD)
    const y2 = Math.min(height, rect.y + rect.height + PAD)

    // Panels around the hole. On web they carry the blur, and because they
    // stop at the hole's edges they can never blur the spotlighted control.
    const panel = (s: ViewStyle, key: string) => (
      <View key={key} pointerEvents="none" style={[s, isWeb ? (webBlur as ViewStyle) : styles.scrim]} />
    )
    const panels = [
      panel({ position: 'absolute', left: 0, right: 0, top: 0, height: y1 }, 'top'),
      panel({ position: 'absolute', left: 0, right: 0, top: y2, bottom: 0 }, 'bottom'),
      panel({ position: 'absolute', left: 0, width: x1, top: y1, height: y2 - y1 }, 'left'),
      panel({ position: 'absolute', right: 0, width: Math.max(0, width - x2), top: y1, height: y2 - y1 }, 'right'),
    ]

    dim = isWeb ? (
      <>
        {/* Dim, with an exactly rounded hole. No filter on this element. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.scrim,
            { clipPath: `path('${holePath(width, height, rect, CORNER)}')`, transition } as ViewStyle,
          ]}
        />
        {panels}
      </>
    ) : (
      <>{panels}</>
    )
  }

  // --- the message, placed where it does not cover the target ---------------
  const bubble = bubblePosition(rect, step.placement ?? 'auto', width, height, insets.top, insets.bottom)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Tapping anywhere advances. The whole layer is one button so there is
          no hunting for a "next" control. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={next}
        accessibilityRole="button"
        accessibilityLabel={t('tour.tapToContinue')}
      >
        {dim}
      </Pressable>

      {/* Ring around the hole. Drawn, not filled, so the control stays visible. */}
      {rect ? (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: Math.max(0, rect.x - PAD),
              top: Math.max(0, rect.y - PAD),
              width: Math.min(width, rect.width + PAD * 2),
              height: Math.min(height, rect.height + PAD * 2),
            },
            !reduceMotion && ({ transition: 'all 320ms cubic-bezier(0.22, 1, 0.36, 1)' } as ViewStyle),
          ]}
        />
      ) : null}

      {/* Message */}
      <View
        pointerEvents="box-none"
        style={[styles.bubbleWrap, bubble]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <View style={styles.bubble}>
          <Text style={styles.counter}>
            {t('tour.progress', { n: index + 1, total })}
          </Text>
          <Text style={styles.title} accessibilityRole="header">{t(step.title)}</Text>
          <Text style={styles.body}>{t(step.body)}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={skip}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.skip}
            >
              <Text style={styles.skipText}>{t('tour.skip')}</Text>
            </Pressable>

            <View style={styles.dots}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>

            <Pressable
              onPress={next}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.nextBtn}
            >
              <Text style={styles.nextText}>{last ? t('tour.done') : t('tour.next')}</Text>
              {last ? null : <Feather name="arrow-right" size={15} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  )
}

/**
 * Puts the message on whichever side of the hole has room, and never lets it
 * run off the screen. Falls back to centring it when there is no target.
 */
function bubblePosition(
  rect: Rect | null,
  prefer: 'auto' | 'above' | 'below',
  width: number,
  height: number,
  safeTop: number,
  safeBottom: number,
): ViewStyle {
  const maxW = Math.min(360, width - EDGE * 2)
  const base: ViewStyle = { left: (width - maxW) / 2, width: maxW }

  if (!rect) return { ...base, top: height / 2 - 90 }

  const topRoom = rect.y - safeTop
  const bottomRoom = height - (rect.y + rect.height) - safeBottom
  // A rough height so the choice is made before layout; the clamp below keeps
  // it on screen even when the real height differs.
  const guess = 190

  let above: boolean
  if (prefer === 'above') above = topRoom > guess * 0.7 || topRoom > bottomRoom
  else if (prefer === 'below') above = !(bottomRoom > guess * 0.7 || bottomRoom >= topRoom)
  else above = topRoom > bottomRoom

  if (above) {
    const bottom = height - (rect.y - PAD - BUBBLE_GAP)
    return { ...base, bottom: Math.max(safeBottom + EDGE, Math.min(bottom, height - safeTop - EDGE - guess)) }
  }
  const top = rect.y + rect.height + PAD + BUBBLE_GAP
  return { ...base, top: Math.max(safeTop + EDGE, Math.min(top, height - safeBottom - EDGE - guess)) }
}

// Only the dimmed layer is blurred; the hole is cut out of this same element,
// so nothing blurs the spotlighted control.
const webBlur = {
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
} as unknown as ViewStyle

const styles = StyleSheet.create({
  // 0.62 keeps the dimmed UI recognisable while putting the contrast on the
  // white message card, which sits well above 4.5:1 against it.
  scrim: { backgroundColor: 'rgba(9, 16, 33, 0.62)' },
  ring: {
    position: 'absolute',
    borderRadius: CORNER,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  bubbleWrap: { position: 'absolute' },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.raised,
  },
  counter: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: { ...type.h2, marginTop: 6 },
  body: { ...type.sub, marginTop: 6 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  skip: { paddingVertical: 4, paddingRight: 8 },
  skipText: { fontSize: 13.5, fontWeight: '700', color: colors.textMuted },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { backgroundColor: colors.brand, width: 14 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  nextText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
})
