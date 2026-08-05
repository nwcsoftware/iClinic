import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { I18nProvider, useI18n } from './lib/i18n'
import { supabase } from './lib/supabase'
import { initPatient, type Doctor, type PatientInfo } from './lib/api'
import { getDoctorMe, type DoctorMe } from './lib/doctorApi'
import { colors, shadow } from './lib/theme'
import SplashScreen from './components/SplashScreen'
import AuthScreen from './screens/AuthScreen'
import ProfileSetupScreen from './screens/ProfileSetupScreen'
import HomeScreen from './screens/HomeScreen'
import DoctorsScreen from './screens/DoctorsScreen'
import TriageScreen from './screens/TriageScreen'
import BookingScreen from './screens/BookingScreen'
import AppointmentsScreen from './screens/AppointmentsScreen'
import ProfileScreen from './screens/ProfileScreen'
import MedicalInfoScreen from './screens/MedicalInfoScreen'
import MedicationsScreen from './screens/MedicationsScreen'
import GuideScreen, { hasSeenGuide } from './screens/GuideScreen'
import DoctorPatientDetailScreen from './screens/doctor/DoctorPatientDetailScreen'
import DoctorVisitsScreen from './screens/doctor/DoctorVisitsScreen'
import DoctorPrescribeScreen from './screens/doctor/DoctorPrescribeScreen'
import DoctorHomeScreen from './screens/doctor/DoctorHomeScreen'
import DoctorScheduleScreen from './screens/doctor/DoctorScheduleScreen'
import DoctorPatientsScreen from './screens/doctor/DoctorPatientsScreen'
import DoctorProfileScreen from './screens/doctor/DoctorProfileScreen'
import DoctorBillingScreen from './screens/doctor/DoctorBillingScreen'
import PaywallScreen from './screens/doctor/PaywallScreen'
import EmergencyButton from './components/EmergencyButton'

type PatientTab = 'home' | 'doctors' | 'visits' | 'meds' | 'profile'
type DoctorTab = 'dhome' | 'schedule' | 'patients' | 'dprofile'
type PrescribeTarget = { id: string; patient_name: string; appointment_date: string; start_time: string }
type Overlay =
  | { kind: 'triage' }
  | { kind: 'booking'; doctor: Doctor; reason: string }
  | { kind: 'medical' }
  | { kind: 'guide' }
  | null
type DoctorOverlay =
  | { kind: 'billing' }
  | { kind: 'patient'; id: string }
  | { kind: 'visits' }
  | { kind: 'prescribe'; visit: PrescribeTarget }
  | null
type Phase = 'splash' | 'loading' | 'auth' | 'setup' | 'patient' | 'doctor' | 'paywall'

const PATIENT_TABS: { key: PatientTab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'tab.home' },
  { key: 'doctors', icon: 'users', label: 'tab.doctors' },
  { key: 'visits', icon: 'calendar', label: 'tab.visits' },
  { key: 'meds', icon: 'clipboard', label: 'tab.meds' },
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

function Main() {
  const [phase, setPhase] = useState<Phase>('splash')
  const [pTab, setPTab] = useState<PatientTab>('home')
  const [dTab, setDTab] = useState<DoctorTab>('dhome')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [docOverlay, setDocOverlay] = useState<DoctorOverlay>(null)
  // First-run walkthrough. Shown once, then re-openable from Profile.
  const [showGuide, setShowGuide] = useState(false)
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [doctorMe, setDoctorMe] = useState<DoctorMe | null>(null)
  const splashDone = useRef(false)
  const resolved = useRef<Phase | null>(null)

  // Doctors land on the doctor shell; everyone else on the patient flow.
  const resolveAfterAuth = useCallback(async (): Promise<Phase> => {
    try {
      const { doctor, access } = await getDoctorMe()
      if (doctor) {
        setDoctorMe(doctor)
        return access && !access.has_access ? 'paywall' : 'doctor'
      }
    } catch { /* fall through to patient flow */ }
    try {
      const { patient: p, needs_profile } = await initPatient()
      if (needs_profile) return 'setup'
      setPatient(p)
      return 'patient'
    } catch {
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

  // New patients get the walkthrough before they see the app.
  useEffect(() => {
    if (phase !== 'patient') return
    let active = true
    hasSeenGuide().then((seen) => { if (active && !seen) setShowGuide(true) })
    return () => { active = false }
  }, [phase])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const next = data.session ? await resolveAfterAuth() : 'auth'
      if (!active) return
      resolved.current = next
      setResolvedPhase(next)
      if (splashDone.current) setPhase(next)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return
      if (!session) {
        setPhase('auth'); setPTab('home'); setDTab('dhome')
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
  if (phase === 'auth') {
    return <AuthScreen onAuthed={async () => { setPhase(await resolveAfterAuth()) }} />
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
        onSignedOut={() => setPhase('auth')}
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
              onSignedOut={() => setPhase('auth')}
              onOpenBilling={() => setDocOverlay({ kind: 'billing' })}
            />
          )}
        </View>
        <TabBar tabs={DOCTOR_TABS} tab={dTab} onTab={setDTab} accent={colors.doc} accentSoft={colors.docSoft} />
      </View>
    )
  }

  // ── Patient shell ─────────────────────────────────────────────────────────
  // The walkthrough comes before everything else on first launch.
  if (showGuide) return <GuideScreen onDone={() => setShowGuide(false)} />
  if (overlay?.kind === 'guide') return <GuideScreen onDone={() => setOverlay(null)} />

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
            onSignedOut={() => setPhase('auth')}
            onPatientUpdated={setPatient}
            onOpenMedical={() => setOverlay({ kind: 'medical' })}
            onOpenGuide={() => setOverlay({ kind: 'guide' })}
          />
        )}
      </View>
      <EmergencyButton />
      <TabBar tabs={PATIENT_TABS} tab={pTab} onTab={setPTab} accent={colors.brand} accentSoft={colors.brandSoft} />
    </View>
  )
}

export default function App() {
  const { width } = useWindowDimensions()
  const framed = Platform.OS === 'web' && width > 520

  return (
    <SafeAreaProvider>
      <I18nProvider>
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
      </I18nProvider>
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
