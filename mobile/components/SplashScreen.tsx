import { useEffect, useRef } from 'react'
import { View, Text, Image, Animated, Easing, StyleSheet, Platform } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '../lib/theme'

const art = require('../assets/illustrations/splash.png')
const native = Platform.OS !== 'web'

// Cinematic intro: artwork drifts up while the logo springs in with an
// expanding pulse ring, the name fades up, then everything dissolves.
// Calls onDone after ~2.2s (or when `holdUntil` resolves, whichever is later).
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const art_ = useRef(new Animated.Value(0)).current
  const logo = useRef(new Animated.Value(0)).current
  const ring = useRef(new Animated.Value(0)).current
  const nameV = useRef(new Animated.Value(0)).current
  const out = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(art_, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.sequence([
          Animated.delay(250),
          Animated.spring(logo, { toValue: 1, friction: 6, tension: 70, useNativeDriver: native }),
        ]),
        Animated.sequence([
          Animated.delay(420),
          Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(nameV, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        ]),
      ]),
      Animated.delay(650),
      Animated.timing(out, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
    ]).start(() => onDone())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Animated.View style={[styles.root, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Animated.Image
        source={art}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill as object, {
          opacity: art_.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
          transform: [{ translateY: art_.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: 1.06 }],
        }]}
      />
      <View style={styles.center}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[styles.pulse, {
            opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] }) }],
          }]} />
          <Animated.View style={[styles.logo, {
            opacity: logo,
            transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }]}>
            <MaterialCommunityIcons name="hospital" size={40} color="#fff" />
          </Animated.View>
        </View>
        <Animated.View style={{
          opacity: nameV,
          transform: [{ translateY: nameV.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          alignItems: 'center',
        }}>
          <Text style={styles.name}>iClinic</Text>
          <Text style={styles.tag}>Care, simplified</Text>
        </Animated.View>
      </View>
      {/* keep Image import referenced for RN web asset registration */}
      <Image source={art} style={{ width: 0, height: 0 }} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1B4D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  pulse: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
  },
  logo: {
    width: 88, height: 88, borderRadius: 26, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  name: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tag: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
})
