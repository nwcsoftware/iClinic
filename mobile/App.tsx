import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { supabase } from './lib/supabase'
import { initPatient, type Doctor, type PatientInfo } from './lib/api'
import { colors, shadow } from './lib/theme'
import AuthScreen from './screens/AuthScreen'
import ProfileSetupScreen from './screens/ProfileSetupScreen'
import HomeScreen from './screens/HomeScreen'
import DoctorsScreen from './screens/DoctorsScreen'
import TriageScreen from './screens/TriageScreen'
import BookingScreen from './screens/BookingScreen'
import AppointmentsScreen from './screens/AppointmentsScreen'
import ProfileScreen from './screens/ProfileScreen'

type Tab = 'home' | 'doctors' | 'visits' | 'profile'
type Overlay = { kind: 'triage' } | { kind: 'booking'; doctor: Doctor; reason: string } | null
type Phase = 'loading' | 'auth' | 'setup' | 'app'

const TABS: { key: Tab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'doctors', icon: 'users', label: 'Doctors' },
  { key: 'visits', icon: 'calendar', label: 'Visits' },
  { key: 'profile', icon: 'user', label: 'Profile' },
]

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => {
        const active = t.key === tab
        return (
          <Pressable key={t.key} onPress={() => onTab(t.key)} style={styles.tabItem} hitSlop={6}>
            <View style={[styles.tabIconWrap, active && { backgroundColor: colors.brandSoft }]}>
              <Feather name={t.icon} size={19} color={active ? colors.brand : colors.tabInactive} />
            </View>
            <Text style={[styles.tabLabel, active && { color: colors.brand, fontWeight: '800' }]}>{t.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Main() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [tab, setTab] = useState<Tab>('home')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [patient, setPatient] = useState<PatientInfo | null>(null)

  const resolveAfterAuth = useCallback(async () => {
    try {
      const { patient: p, needs_profile } = await initPatient()
      if (needs_profile) { setPhase('setup'); return }
      setPatient(p)
      setPhase('app')
    } catch {
      setPhase('app') // API unreachable — let them in; screens retry on their own
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) resolveAfterAuth()
      else setPhase('auth')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return
      if (!session) { setPhase('auth'); setTab('home'); setOverlay(null); setPatient(null) }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [resolveAfterAuth])

  if (phase === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
  }
  if (phase === 'auth') {
    return <AuthScreen onAuthed={() => { setPhase('loading'); resolveAfterAuth() }} />
  }
  if (phase === 'setup') {
    return <ProfileSetupScreen onDone={() => { setPhase('loading'); resolveAfterAuth() }} />
  }

  // Full-screen flows above the tabs
  if (overlay?.kind === 'triage') {
    return (
      <TriageScreen
        onBack={() => setOverlay(null)}
        onPickDoctor={(doctor, summary) => setOverlay({ kind: 'booking', doctor, reason: summary })}
      />
    )
  }
  if (overlay?.kind === 'booking') {
    return (
      <BookingScreen
        doctor={overlay.doctor}
        reason={overlay.reason}
        onBack={() => setOverlay(null)}
        onDone={() => { setOverlay(null); setTab('visits') }}
      />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && (
          <HomeScreen
            patient={patient}
            onStartTriage={() => setOverlay({ kind: 'triage' })}
            onOpenDoctors={() => setTab('doctors')}
            onPickDoctor={(doctor) => setOverlay({ kind: 'booking', doctor, reason: '' })}
            onViewVisits={() => setTab('visits')}
          />
        )}
        {tab === 'doctors' && (
          <DoctorsScreen onPickDoctor={(doctor) => setOverlay({ kind: 'booking', doctor, reason: '' })} />
        )}
        {tab === 'visits' && <AppointmentsScreen onBook={() => setTab('doctors')} />}
        {tab === 'profile' && (
          <ProfileScreen
            patient={patient}
            onSignedOut={() => setPhase('auth')}
            onPatientUpdated={setPatient}
          />
        )}
      </View>
      <TabBar tab={tab} onTab={setTab} />
    </View>
  )
}

export default function App() {
  const { width } = useWindowDimensions()
  const framed = Platform.OS === 'web' && width > 520

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {framed ? (
        <View style={styles.frameOuter}>
          <View style={styles.frameInner}>
            <Main />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Main />
        </View>
      )}
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  tabbar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: 8, paddingHorizontal: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIconWrap: {
    width: 46, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },
  tabLabel: { fontSize: 10.5, fontWeight: '600', color: colors.tabInactive },
  frameOuter: {
    flex: 1, backgroundColor: '#E3E7F0', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  frameInner: {
    flex: 1, width: '100%', maxWidth: 430, backgroundColor: colors.bg,
    borderRadius: 28, overflow: 'hidden', ...shadow.raised,
  },
})
