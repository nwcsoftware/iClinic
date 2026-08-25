import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { I18nProvider, useI18n } from './lib/i18n'
import { supabase } from './lib/supabase'
import { getDoctorById, type Doctor, type PatientInfo } from './lib/api'
import { type DoctorMe } from './lib/doctorApi'
import { getMe } from './lib/session'
import { colors, shadow } from './lib/theme'
import SplashScreen from './components/SplashScreen'
import AuthScreen from './screens/AuthScreen'
import LandingScreen from './screens/LandingScreen'
import PolicyScreen from './screens/PolicyScreen'
import type { Policy } from './lib/policies'
import ProfileSetupScreen from './screens/ProfileSetupScreen'
import HomeScreen from './screens/HomeScreen'
import DoctorsScreen from './screens/DoctorsScreen'
import TriageScreen from './screens/TriageScreen'
import BookingScreen from './screens/BookingScreen'
import AppointmentsScreen from './screens/AppointmentsScreen'
import ProfileScreen from './screens/ProfileScreen'
import MedicalInfoScreen from './screens/MedicalInfoScreen'
import MedicationsScreen from './screens/MedicationsScreen'
import { TourProvider, TourTarget, useTour, hasSeenTour, type TourScreen } from './lib/tour'
import SpotlightOverlay from './components/tour/SpotlightOverlay'
import DoctorPatientDetailScreen from './screens/doctor/DoctorPatientDetailScreen'
import DoctorVisitsScreen from './screens/doctor/DoctorVisitsScreen'
import DoctorPrescribeScreen from './screens/doctor/DoctorPrescribeScreen'
import DoctorHomeScreen from './screens/doctor/DoctorHomeScreen'
import DoctorScheduleScreen from './screens/doctor/DoctorScheduleScreen'
import DoctorPatientsScreen from './screens/doctor/DoctorPatientsScreen'
import DoctorProfileScreen from './screens/doctor/DoctorProfileScreen'
import DoctorBillingScreen from './screens/doctor/DoctorBillingScreen'
import DoctorLocationsScreen from './screens/doctor/DoctorLocationsScreen'
import PaywallScreen from './screens/doctor/PaywallScreen'
import EmergencyButton from './components/EmergencyButton'
import FloatingMapNavButton from './components/FloatingMapNavButton'
import MapScreen from './screens/MapScreen'
import { getMapLocations } from './lib/mapApi'

type PatientTab = 'home' | 'doctors' | 'visits' | 'meds' | 'profile'
type DoctorTab = 'dhome' | 'schedule' | 'patients' | 'dprofile'
type PrescribeTarget = { id: string; patient_name: string; appointment_date: string; start_time: string }
type Overlay =
  | { kind: 'triage' }
  | { kind: 'booking'; doctor: Doctor; reason: string }
  | { kind: 'medical' }
  | { kind: 'map' }
  | null
type DoctorOverlay =
  | { kind: 'billing' }
  | { kind: 'patient'; id: string }
  | { kind: 'visits' }
  | { kind: 'prescribe'; visit: PrescribeTarget }
  | { kind: 'workplaces' }
  | null
// 'landing' is what a signed-out visitor sees first: what the product is, what
// it costs, and the policies. 'auth' is one tap away from it.
type Phase = 'splash' | 'loading' | 'landing' | 'auth' | 'setup' | 'patient' | 'doctor' | 'paywall'

// Split either side of the floating map button that occupies the centre slot.
const PATIENT_TABS_LEFT: { key: PatientTab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'tab.home' },
  { key: 'doctors', icon: 'users', label: 'tab.doctors' },
]
const PATIENT_TABS_RIGHT: { key: PatientTab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'visits', icon: 'calendar', label: 'tab.visits' },
  { key: 'profile', icon: 'user', label: 'tab.profile' },
]

const DOCTOR_TABS: { key: DoctorTab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'dhome', icon: 'activity', label: 'Today' },
  { key: 'schedule', icon: 'clock', label: 'Schedule' },
  { key: 'patients', icon: 'users', label: 'Patients' },
  { key: 'dprofile', icon: 'user', label: 'Profile' },
]

function TabBar<T extends string>({
  tabs, tab, onTab, accent, accentSoft,
}: {
  tabs: { key: T; icon: keyof typeof Feather.glyphMap; label: string }[]
  tab: T
  onTab: (t: T) => void
  accent: string
  accentSoft: string
}) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const label = (l: string) => (l.startsWith('tab.') ? t(l as never) : l)
  return (
    <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((t) => {
        const active = t.key === tab
        return (
          <Pressable key={t.key} onPress={() => onTab(t.key)} style={styles.tabItem} hitSlop={6}>
            <View style={[styles.tabIconWrap, active && { backgroundColor: accentSoft }]}>
              <Feather name={t.icon} size={19} color={active ? accent : colors.tabInactive} />
            </View>
            <Text style={[styles.tabLabel, active && { color: accent, fontWeight: '800' }]}>{label(t.label)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// Patient tab bar: two tabs, the floating map orb, two more tabs.
function PatientTabBar({
  tab, onTab, onMap, mapActive, hasNearby,
}: {
  tab: PatientTab
  onTab: (t: PatientTab) => void
  onMap: () => void
  mapActive: boolean
  hasNearby: boolean
}) {
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const item = (tb: { key: PatientTab; icon: keyof typeof Feather.glyphMap; label: string }) => {
    const active = tb.key === tab && !mapActive
    return (
      <TourTarget key={tb.key} id={`${tb.key}Tab`} style={styles.tabItem}>
      <Pressable onPress={() => onTab(tb.key)} style={styles.tabItemInner} hitSlop={6}>
        <View style={[styles.tabIconWrap, active && { backgroundColor: colors.brandSoft }]}>
          <Feather name={tb.icon} size={19} color={active ? colors.brand : colors.tabInactive} />
        </View>
        <Text style={[styles.tabLabel, active && { color: colors.brand, fontWeight: '800' }]}>
          {t(tb.label as never)}
        </Text>
      </Pressable>
      </TourTarget>
    )
  }
  return (
    <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {PATIENT_TABS_LEFT.map(item)}
      <TourTarget id="mapOrb">
        <FloatingMapNavButton onPress={onMap} active={mapActive} hasNearby={hasNearby} />
      </TourTarget>
      {PATIENT_TABS_RIGHT.map(item)}
    </View>
  )
}

function Main() {
  const [phase, setPhase] = useState<Phase>('splash')
  const [pTab, setPTab] = useState<PatientTab>('home')
  const [dTab, setDTab] = useState<DoctorTab>('dhome')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [docOverlay, setDocOverlay] = useState<DoctorOverlay>(null)
  // A policy opened from the landing page, shown over it.
  const [policy, setPolicy] = useState<Policy['key'] | null>(null)
  // Whether the map has anything on it — the orb only pulses when it does,
  // because an animation that never stops stops being noticed.
  const [mapHasPlaces, setMapHasPlaces] = useState(false)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [doctorMe, setDoctorMe] = useState<DoctorMe | null>(null)
  const splashDone = useRef(false)
  const resolved = useRef<Phase | null>(null)

  // Doctors land on the doctor shell; everyone else on the patient flow.
  // One request decides which shell to open into. This used to ask
  // /api/doctor/me and then, once that came back empty, /api/patient/init —
  // two round trips in sequence, each re-validating the same token, for an
  // answer a single call can give.
  const resolveAfterAuth = useCallback(async (): Promise<Phase> => {
    try {
      const me = await getMe()
      if (me.kind === 'doctor') {
        setDoctorMe(me.doctor)
        return me.access && !me.access.has_access ? 'paywall' : 'doctor'
      }
      if (me.needs_profile) return 'setup'
      setPatient(me.patient)
      return 'patient'
    } catch {
      // Network trouble after a valid sign-in: the patient shell degrades
      // gracefully on its own, so land there rather than bouncing to login.
      return 'patient'
    }
  }, [])

  // Resolve the session while the splash animation plays; whoever finishes
  // last flips the phase.
  const [splashOver, setSplashOver] = useState(false)
  const [resolvedPhase, setResolvedPhase] = useState<Phase | null>(null)

  useEffect(() => {
    if (splashOver && resolvedPhase && phase === 'splash') setPhase(resolvedPhase)
  }, [splashOver, resolvedPhase, phase])

  // Cheap probe so the tab bar knows whether the map is worth opening.
  useEffect(() => {
    if (phase !== 'patient') return
    let active = true
    getMapLocations()
      .then((l) => { if (active) setMapHasPlaces(l.length > 0) })
      .catch(() => { /* the orb simply does not pulse */ })
    return () => { active = false }
  }, [phase])

  // New patients get the walkthrough over the real screen, once.
  const tour = useTour()
  const startTour = tour.start
  const setNavigator = tour.setNavigator

  // A step can live on another tab. Any open sheet is closed first, or the
  // tour would spotlight something hidden behind it.
  useEffect(() => {
    setNavigator((screen: TourScreen) => {
      setOverlay(null)
      setPTab(screen)
    })
  }, [setNavigator])
  useEffect(() => {
    if (phase !== 'patient') return
    let active = true
    hasSeenTour().then((seen) => { if (active && !seen) startTour() })
    return () => { active = false }
  }, [phase, startTour])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const next = data.session ? await resolveAfterAuth() : 'landing'
      if (!active) return
      resolved.current = next
      setResolvedPhase(next)
      if (splashDone.current) setPhase(next)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return
      if (!session) {
        setPhase('landing'); setPTab('home'); setDTab('dhome')
        setOverlay(null); setPatient(null); setDoctorMe(null)
      }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [resolveAfterAuth])

  if (phase === 'splash') {
    // Stay on the splash until BOTH the animation and the session check are
    // done; the effect above flips the phase when the last one lands.
    return (
      <SplashScreen onDone={() => {
        splashDone.current = true
        setSplashOver(true)
        if (resolved.current) setPhase(resolved.current)
      }} />
    )
  }
  if (phase === 'loading') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>
  }
  // A policy is readable from the landing page without an account.
  if (policy) {
    return <PolicyScreen policy={policy} onBack={() => setPolicy(null)} />
  }
  if (phase === 'landing') {
    return (
      <LandingScreen
        onSignIn={() => setPhase('auth')}
        onOpenPolicy={setPolicy}
      />
    )
  }
  if (phase === 'auth') {
    return (
      <AuthScreen
        onAuthed={async () => { setPhase(await resolveAfterAuth()) }}
        onBack={() => setPhase('landing')}
      />
    )
  }
  if (phase === 'setup') {
    return <ProfileSetupScreen onDone={async () => { setPhase(await resolveAfterAuth()) }} />
  }

  // ── Locked out until they pay: no tabs, nothing reachable ─────────────────
  if (phase === 'paywall' && doctorMe) {
    return (
      <PaywallScreen
        doctor={doctorMe}
        onRetry={async () => { setPhase(await resolveAfterAuth()) }}
        onSignedOut={() => setPhase('landing')}
      />
    )
  }

  // ── Doctor shell ──────────────────────────────────────────────────────────
  if (phase === 'doctor' && doctorMe) {
    // Billing takes over the screen: a doctor changing their plan should not be
    // half-looking at their schedule behind it.
    if (docOverlay?.kind === 'billing') {
      return <DoctorBillingScreen onBack={() => setDocOverlay(null)} />
    }
    if (docOverlay?.kind === 'workplaces') {
      return <DoctorLocationsScreen onBack={() => setDocOverlay(null)} />
    }
    if (docOverlay?.kind === 'patient') {
      return (
        <DoctorPatientDetailScreen
          patientId={docOverlay.id}
          onBack={() => setDocOverlay(null)}
          onPrescribe={(visit) => setDocOverlay({ kind: 'prescribe', visit })}
        />
      )
    }
    if (docOverlay?.kind === 'visits') {
      return (
        <DoctorVisitsScreen
          onBack={() => setDocOverlay(null)}
          onPrescribe={(v) => setDocOverlay({
            kind: 'prescribe',
            visit: { id: v.id, patient_name: v.patient_name, appointment_date: v.appointment_date, start_time: v.start_time },
          })}
        />
      )
    }
    if (docOverlay?.kind === 'prescribe') {
      return (
        <DoctorPrescribeScreen
          visit={docOverlay.visit}
          onBack={() => setDocOverlay({ kind: 'visits' })}
          onSaved={() => setDocOverlay({ kind: 'visits' })}
        />
      )
    }
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {dTab === 'dhome' && (
            <DoctorHomeScreen doctor={doctorMe} onOpenVisits={() => setDocOverlay({ kind: 'visits' })} />
          )}
          {dTab === 'schedule' && <DoctorScheduleScreen />}
          {dTab === 'patients' && (
            <DoctorPatientsScreen onOpenPatient={(id) => setDocOverlay({ kind: 'patient', id })} />
          )}
          {dTab === 'dprofile' && (
            <DoctorProfileScreen
              doctor={doctorMe}
              onSignedOut={() => setPhase('landing')}
              onOpenBilling={() => setDocOverlay({ kind: 'billing' })}
              onOpenWorkplaces={() => setDocOverlay({ kind: 'workplaces' })}
            />
          )}
        </View>
        <TabBar tabs={DOCTOR_TABS} tab={dTab} onTab={setDTab} accent={colors.doc} accentSoft={colors.docSoft} />
      </View>
    )
  }

  // ── Patient shell ─────────────────────────────────────────────────────────
  // The walkthrough comes before everything else on first launch.

  if (overlay?.kind === 'map') {
    return (
      <MapScreen
        onBack={() => setOverlay(null)}
        onPickDoctor={async (doctorId) => {
          // Straight from a marker into booking with that doctor.
          try {
            const doctor = await getDoctorById(doctorId)
            if (doctor) { setOverlay({ kind: 'booking', doctor, reason: '' }); return }
          } catch { /* fall back to the directory */ }
          setOverlay(null)
          setPTab('doctors')
        }}
      />
    )
  }
  if (overlay?.kind === 'medical') {
    return (
      <MedicalInfoScreen
        patient={patient}
        onBack={() => setOverlay(null)}
        onSaved={setPatient}
      />
    )
  }
  if (overlay?.kind === 'triage') {
    return (
      <View style={{ flex: 1 }}>
        <TriageScreen
          onBack={() => setOverlay(null)}
          onPickDoctor={(doctor, summary) => setOverlay({ kind: 'booking', doctor, reason: summary })}
        />
        <EmergencyButton />
      </View>
    )
  }
  if (overlay?.kind === 'booking') {
    return (
      <View style={{ flex: 1 }}>
        <BookingScreen
          doctor={overlay.doctor}
          reason={overlay.reason}
          onBack={() => setOverlay(null)}
          onDone={() => { setOverlay(null); setPTab('visits') }}
        />
        <EmergencyButton />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {pTab === 'home' && (
          <HomeScreen
            patient={patient}
            onStartTriage={() => setOverlay({ kind: 'triage' })}
            onOpenDoctors={() => setPTab('doctors')}
            onPickDoctor={(doctor) => setOverlay({ kind: 'booking', doctor, reason: '' })}
            onViewVisits={() => setPTab('visits')}
            onOpenMedical={() => setOverlay({ kind: 'medical' })}
          />
        )}
        {pTab === 'doctors' && (
          <DoctorsScreen onPickDoctor={(doctor) => setOverlay({ kind: 'booking', doctor, reason: '' })} />
        )}
        {pTab === 'visits' && <AppointmentsScreen onBook={() => setPTab('doctors')} />}
        {pTab === 'meds' && <MedicationsScreen />}
        {pTab === 'profile' && (
          <ProfileScreen
            patient={patient}
            onSignedOut={() => setPhase('landing')}
            onPatientUpdated={setPatient}
            onOpenMedical={() => setOverlay({ kind: 'medical' })}
            onOpenGuide={() => { setPTab('home'); tour.start() }}
            onOpenMeds={() => setPTab('meds')}
          />
        )}
      </View>
      <EmergencyButton />
      <PatientTabBar
        tab={pTab}
        onTab={setPTab}
        onMap={() => setOverlay({ kind: 'map' })}
        mapActive={false}
        hasNearby={mapHasPlaces}
      />
    </View>
  )
}

export default function App() {
  const { width } = useWindowDimensions()
  const framed = Platform.OS === 'web' && width > 520

  return (
    <SafeAreaProvider>
      <I18nProvider>
      <TourProvider>
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
      {/* Above the frame, so the dimmed area covers the whole window while the
          hole still lines up with the measured control inside it. */}
      <SpotlightOverlay />
      </TourProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  tabbar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    paddingTop: 8, paddingHorizontal: 8,
    // The floating orb overhangs the top edge.
    overflow: 'visible',
  },
  tabItem: { flex: 1 },
  tabItemInner: { alignItems: 'center', gap: 3 },
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
