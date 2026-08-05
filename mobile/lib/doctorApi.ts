import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

export type DoctorMe = {
  id: string
  full_name: string
  specialty_name: string | null
  rating: number | null
  review_count: number | null
}

export type Access = {
  has_access: boolean
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none'
  days_left: number
  is_trial: boolean
  in_grace: boolean
  current_period_end: string | null
  price_usd: number
  billing_enabled: boolean
}

export type SubscriptionInfo = {
  access: Access
  payments: {
    amount_usd: number
    currency: string
    method: string
    reference: string | null
    period_end: string | null
    created_at: string
  }[]
  instructions: {
    whish: string | null
    omt: string | null
    bank: string | null
    contact: string | null
    note: string
  }
  checkout_url: string | null
}

export type SavedCard = {
  brand: string | null
  last4: string
  exp_month: number | null
  exp_year: number | null
}

export type Payment = {
  id?: string
  amount_usd: number
  currency: string
  method: string
  reference: string | null
  period_end: string | null
  created_at: string
  status?: 'paid' | 'failed' | 'refunded' | 'pending'
  description?: string | null
  invoice_url?: string | null
  receipt_url?: string | null
  card_brand?: string | null
  card_last4?: string | null
  failure_reason?: string | null
}

export type BillingInfo = {
  access: Access
  subscription: {
    status: Access['status']
    plan: 'monthly' | 'yearly'
    price_usd: number
    provider: string
    current_period_start: string | null
    current_period_end: string | null
    trial_end: string | null
    cancel_at_period_end: boolean
    billing_email: string | null
    last_payment_at: string | null
    last_payment_status: string | null
  } | null
  card: SavedCard | null
  next_charge: { amount_usd: number; date: string } | null
  payments: Payment[]
  capabilities: {
    provider: string
    can_pay_by_card: boolean
    can_self_serve: boolean
    cancel_via_provider: boolean
    card_provider?: string | null
    test_mode?: boolean
  }
  plans?: { key: string; months: number; amount_usd: number; label: string; save_pct: number }[]
  instructions: {
    whish: string | null
    omt: string | null
    bank: string | null
    contact: string | null
    note: string
  }
  details_enabled: boolean
}

export type DoctorOverview = {
  today: { id: string; start_time: string; status: string; reason: string | null; patient_name: string }[]
  days: { date: string; count: number }[]
  stats: { total_patients: number; week_visits: number; today_visits: number }
}

export type DoctorPatient = {
  id: string
  full_name: string
  mobile_number: string
  email: string | null
  gender: string | null
  date_of_birth: string | null
  visits: number
  last_visit: string
}

export type Availability = {
  id: string
  weekday: number
  start_time: string
  end_time: string
  slot_minutes: number
  is_active: boolean
}

export type TimeOff = { id: string; off_date: string; reason: string | null }

export type RxItem = {
  id?: string
  medication_name: string
  dosage: string | null
  frequency: string | null
  times_of_day: string[] | null
  duration: string | null
  route: string | null
  notes: string | null
  starts_on?: string | null
  ends_on?: string | null
}

export type DoctorVisit = {
  id: string
  patient_id: string
  patient_name: string
  patient_mobile: string | null
  appointment_date: string
  start_time: string
  status: string
  reason: string | null
  is_past: boolean
  prescription_id: string | null
}

export type PatientDetail = {
  patient: {
    id: string
    full_name: string
    mobile_number: string
    email: string | null
    date_of_birth: string | null
    gender: string | null
    address: string | null
    allergies?: string[] | null
    chronic_conditions?: string[] | null
    blood_type?: string | null
    medical_notes?: string | null
  }
  medical_enabled: boolean
  visits: {
    id: string; appointment_date: string; start_time: string; status: string
    reason: string | null; notes: string | null; is_past: boolean
  }[]
  stats: { total_visits: number; first_visit: string | null; last_visit: string | null }
  prescriptions: {
    id: string; created_at: string; appointment_id: string | null
    diagnosis_note: string | null; notes: string | null
    mine: boolean; active: boolean; items: RxItem[]
  }[]
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

// Null when the logged-in user is not a doctor — the app uses this to route.
// `access` decides between the doctor app and the paywall.
export async function getDoctorMe(): Promise<{ doctor: DoctorMe | null; access: Access | null }> {
  const res = await fetch(`${API_URL}/api/doctor/me`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return { doctor: body.doctor ?? null, access: body.access ?? null }
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  const res = await fetch(`${API_URL}/api/doctor/subscription`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

export async function getBilling(): Promise<BillingInfo> {
  const res = await fetch(`${API_URL}/api/doctor/billing`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

// checkout / portal return a URL to open; cancel / resume toggle auto-renew.
export async function billingAction(
  action: 'checkout' | 'portal' | 'cancel' | 'resume',
  plan?: string,
): Promise<{ url?: string | null; order_id?: string }> {
  const res = await fetch(`${API_URL}/api/doctor/billing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(plan ? { action, plan } : { action }),
  })
  return jsonOrThrow(res)
}

export async function getDoctorOverview(): Promise<DoctorOverview> {
  const res = await fetch(`${API_URL}/api/doctor/overview`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

export async function getDoctorPatients(): Promise<DoctorPatient[]> {
  const res = await fetch(`${API_URL}/api/doctor/patients`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.patients ?? []
}

export async function getPatientDetail(id: string): Promise<PatientDetail> {
  const res = await fetch(`${API_URL}/api/doctor/patients/${id}`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

export async function getDoctorVisits(scope: 'past' | 'upcoming' = 'past'): Promise<DoctorVisit[]> {
  const res = await fetch(`${API_URL}/api/doctor/visits?scope=${scope}`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.visits ?? []
}

// Re-submitting for the same visit replaces that prescription.
export async function savePrescription(input: {
  appointment_id: string
  diagnosis_note?: string
  notes?: string
  items: {
    medication_name: string
    dosage?: string
    frequency?: string
    times_of_day?: string[]
    duration_days?: number
    route?: string
    notes?: string
  }[]
}) {
  const res = await fetch(`${API_URL}/api/doctor/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

export async function getDoctorSchedule(): Promise<{ availability: Availability[]; time_off: TimeOff[] }> {
  const res = await fetch(`${API_URL}/api/doctor/schedule`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

export async function updateWeekday(input: {
  weekday: number; is_active?: boolean; start_time?: string; end_time?: string
}) {
  const res = await fetch(`${API_URL}/api/doctor/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

export async function toggleDayOff(date: string): Promise<{ off: boolean }> {
  const res = await fetch(`${API_URL}/api/doctor/time-off`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ date }),
  })
  return jsonOrThrow(res)
}

// --- Move a visit through its states (in_progress / completed / no_show) ---
export async function setAppointmentStatus(id: string, status: 'in_progress' | 'completed' | 'no_show') {
  const res = await fetch(`${API_URL}/api/doctor/appointments/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ status }),
  })
  return jsonOrThrow(res)
}
