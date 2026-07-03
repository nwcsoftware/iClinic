import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Platform, Image, Animated, Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { getDoctorOverview, type DoctorMe, type DoctorOverview } from '../../lib/doctorApi'
import { colors, radius, shadow, statusColors, type } from '../../lib/theme'
import { Avatar, Badge, Card } from '../../components/ui'
import { DoctorAmbient, FadeInUp } from '../../components/motion'

const heroArt = require('../../assets/illustrations/doctor-hero.png')
const native = Platform.OS !== 'web'

function firstName(full: string): string {
  return full.replace(/^dr\.?\s*/i, '').trim().split(/\s+/)[0] || 'Doctor'
}

function Bar({ value, max, label, isToday }: { value: number; max: number; label: string; isToday: boolean }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const h = max > 0 ? Math.max(6, (value / max) * 86) : 6
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 6 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: value > 0 ? colors.doc : colors.textFaint }}>{value}</Text>
      <View style={{ height: 86, justifyContent: 'flex-end' }}>
        <Animated.View style={{
          width: 22, borderRadius: 7,
          height: v.interpolate({ inputRange: [0, 1], outputRange: [6, h] }),
          backgroundColor: isToday ? colors.doc : colors.docSoft,
        }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: isToday ? '800' : '600', color: isToday ? colors.doc : colors.textMuted }}>{label}</Text>
    </View>
  )
}

export default function DoctorHomeScreen({ doctor }: { doctor: DoctorMe }) {
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<DoctorOverview | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try { setData(await getDoctorOverview()) }
    catch { /* pull to refresh retries */ }
    finally { setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCount = Math.max(1, ...(data?.days ?? []).map((d) => d.count))

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoctorAmbient />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 14) + 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greet}>Welcome back,</Text>
              <Text style={styles.name}>Dr. {firstName(doctor.full_name)}</Text>
            </View>
            <Avatar name={doctor.full_name} size={46} />
          </View>
        </FadeInUp>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Hero */}
          <FadeInUp delay={60}>
            <View style={styles.hero}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.heroKicker}>Today</Text>
                <Text style={styles.heroTitle}>
                  {data ? (data.stats.today_visits === 0 ? 'No visits scheduled' : `${data.stats.today_visits} visit${data.stats.today_visits === 1 ? '' : 's'} today`) : '…'}
                </Text>
                <Text style={styles.heroSub}>
                  {data ? `${data.stats.week_visits} this week · ${data.stats.total_patients} patients overall` : 'Loading your day'}
                </Text>
              </View>
              <Image source={heroArt} style={styles.heroArt} resizeMode="cover" />
            </View>
          </FadeInUp>

          {/* Week chart */}
          <FadeInUp delay={130}>
            <Card style={{ marginTop: 16 }}>
              <Text style={type.h2}>This week</Text>
              <Text style={[type.sub, { marginTop: 2 }]}>Booked visits per day</Text>
              <View style={{ flexDirection: 'row', marginTop: 16, gap: 4 }}>
                {(data?.days ?? []).map((d, i) => {
                  const date = new Date(`${d.date}T00:00:00`)
                  return (
                    <Bar
                      key={d.date}
                      value={d.count}
                      max={maxCount}
                      label={date.toLocaleDateString('en-US', { weekday: 'short' })}
                      isToday={i === 0}
                    />
                  )
                })}
              </View>
            </Card>
          </FadeInUp>

          {/* Today's schedule */}
          <FadeInUp delay={200}>
            <View style={{ marginTop: 26 }}>
              <Text style={[type.h2, { marginBottom: 12 }]}>Today's schedule</Text>
              {!data || data.today.length === 0 ? (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.freeIcon}><Feather name="coffee" size={18} color={colors.doc} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.h2}>Nothing booked today</Text>
                      <Text style={[type.sub, { marginTop: 2 }]}>Enjoy the quiet — or open up more slots in Schedule.</Text>
                    </View>
                  </View>
                </Card>
              ) : (
                data.today.map((a, i) => {
                  const sc = statusColors[a.status] ?? statusColors.scheduled
                  return (
                    <FadeInUp key={a.id} delay={i * 60}>
                      <Card style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                          <View style={styles.timeBox}>
                            <Text style={styles.timeText}>{a.start_time.slice(0, 5)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={type.h2} numberOfLines={1}>{a.patient_name}</Text>
                            {a.reason ? <Text style={[type.sub, { marginTop: 1 }]} numberOfLines={1}>{a.reason}</Text> : null}
                          </View>
                          <Badge label={sc.label} bg={sc.bg} fg={sc.fg} />
                        </View>
                      </Card>
                    </FadeInUp>
                  )
                })
              )}
            </View>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18 },
  greet: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  name: { fontSize: 25, fontWeight: '800', color: colors.ink, letterSpacing: -0.4, marginTop: 2 },
  hero: {
    backgroundColor: colors.doc, borderRadius: radius.xl, padding: 20,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...shadow.raised,
  },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 20.5, fontWeight: '800', marginTop: 8, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  heroArt: { width: 104, height: 104, borderRadius: radius.lg, opacity: 0.97 },
  timeBox: {
    backgroundColor: colors.docSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8,
  },
  timeText: { color: colors.doc, fontWeight: '800', fontSize: 14 },
  freeIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.docSoft,
    alignItems: 'center', justifyContent: 'center',
  },
})
