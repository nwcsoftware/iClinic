import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native'

const native = Platform.OS !== 'web'

// Fade + slide-up on mount. Use `delay` to stagger siblings.
export function FadeInUp({
  children, delay = 0, distance = 18, duration = 460, style,
}: {
  children: ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle>
}) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration, delay,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: native,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  )
}

// Gentle scale-in for confirmations / highlights.
export function ScaleIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay, friction: 7, tension: 60, useNativeDriver: native }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
    }]}>
      {children}
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------
// Ambient background — soft orbs drifting in slow, endless, out-of-phase
// loops. Very low contrast: the page feels alive without drawing attention.
// ---------------------------------------------------------------------------
function Orb({
  size, color, opacity, top, left, right, bottom, driftX = 26, driftY = 34, duration = 16000, delay = 0,
}: {
  size: number; color: string; opacity: number
  top?: number; left?: number; right?: number; bottom?: number
  driftX?: number; driftY?: number; duration?: number; delay?: number
}) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]))
    loop.start()
    return () => loop.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top, left, right, bottom,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -driftY] }) },
          { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.07, 1] }) },
        ],
      }}
    />
  )
}

// Preset compositions. `tone="soft"` for light pages, `tone="onBrand"` for
// the indigo auth screen.
export function AmbientBackground({ tone = 'soft' }: { tone?: 'soft' | 'onBrand' }) {
  const c1 = tone === 'soft' ? '#C9D4F8' : '#FFFFFF'
  const c2 = tone === 'soft' ? '#DDE6FB' : '#FFFFFF'
  const c3 = tone === 'soft' ? '#BFD0F5' : '#FFFFFF'
  const base = tone === 'soft' ? 0.5 : 0.05
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <Orb size={300} color={c1} opacity={base}        top={-120} right={-110} duration={8500}  driftX={-38} driftY={34} />
      <Orb size={190} color={c2} opacity={base * 0.9}  top={190}  left={-95}  duration={10500} driftX={42}  driftY={-38} delay={700} />
      <Orb size={130} color={c3} opacity={base * 0.8}  top={430}  right={-40} duration={7000}  driftX={-30} driftY={-30} delay={1400} />
      <Orb size={230} color={c2} opacity={base * 0.7}  bottom={-90} left={40} duration={12000} driftX={34}  driftY={38}  delay={350} />
    </View>
  )
}
