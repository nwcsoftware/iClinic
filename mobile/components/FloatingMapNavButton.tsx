import { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '../lib/theme'

// The centre button in the patient tab bar.
//
// It sits above the bar rather than in it, so it reads as the primary action
// instead of a fifth tab. The ring pulses only while there are places on the
// map — an animation that never stops becomes wallpaper, and a still button
// correctly signals "nothing to see here yet".
export default function FloatingMapNavButton({
  onPress, active, hasNearby,
}: {
  onPress: () => void
  active: boolean
  hasNearby: boolean
}) {
  const pulse = useRef(new Animated.Value(0)).current
  const press = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!hasNearby || active) { pulse.setValue(0); return }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 1900, easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [hasNearby, active, pulse])

  function to(v: number) {
    Animated.spring(press, {
      toValue: v, useNativeDriver: Platform.OS !== 'web', damping: 14, stiffness: 320, mass: 0.6,
    }).start()
  }

  return (
    <View style={styles.slot} pointerEvents="box-none">
      {/* Expanding ring, behind the orb */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            opacity: pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.4, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.9] }) }],
          },
        ]}
      />

      <Pressable
        onPress={onPress}
        onPressIn={() => to(1)}
        onPressOut={() => to(0)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open the healthcare map"
      >
        <Animated.View
          style={[
            styles.orb,
            active && styles.orbActive,
            { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] },
          ]}
        >
          {/* Soft highlight — gives the orb depth without a gradient library */}
          <View style={styles.gloss} pointerEvents="none" />
          <MaterialCommunityIcons name="map-marker-radius" size={26} color="#fff" />
        </Animated.View>
      </Pressable>
    </View>
  )
}

const SIZE = 58

const styles = StyleSheet.create({
  slot: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-start',
    // Lifts the orb out of the bar so roughly a third of it overhangs.
    marginTop: -26,
  },
  ring: {
    position: 'absolute', top: 0,
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    borderWidth: 2, borderColor: colors.brand,
  },
  orb: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3, borderColor: colors.card,
    shadowColor: colors.brand,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  orbActive: { backgroundColor: colors.brandDark },
  gloss: {
    position: 'absolute', top: -14, left: -8, right: -8, height: SIZE * 0.62,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderBottomLeftRadius: SIZE, borderBottomRightRadius: SIZE,
  },
})
