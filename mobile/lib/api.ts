import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type Doctor = {
  id: string
  full_name: string
  specialty: string | null
  specialty_slug: string | null
  specialty_name: string | null
  avatar_url: string | null
  rating?: number | null
  review_count?: number | null
}

export type TriageResponse = {
  reply: string
  ready: boolean
  specialty_slug: string | null
  urgency: 'routine' | 'soon' | 'urgent' | 'emergency'
  emergency: boolean
  summary: string
  doctors: Doctor[]
  session_id: string | null
}

export type TriageHistory = {
  session_id: string | null
  messages: ChatMessage[]
  doctors: Doctor[]
  summary: string
}

export type Appointment = {
  id: string
  doctor_id: string
  appointment_date: string
  start_time: string
  status: string
  reason: string | null
  doctor_name?: string
  specialty_name?: string | null
}

export type PatientInfo = {
  id: string
  full_name: string
  mobile_number: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
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

// --- Local-testing direct login (no emailed code). Returns session tokens. ---
export async function devLogin(email: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${API_URL}/api/patient/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return jsonOrThrow(res)
}

// --- Username + password login (testing accounts). Returns session tokens. ---
export async function loginWithPassword(
  username: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/simple-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return jsonOrThrow(res)
}

// --- AI triage (session-aware; every message is persisted server-side) ---
export async function triage(
  messages: ChatMessage[],
  sessionId?: string | null,
  lang: string = 'en',
): Promise<TriageResponse> {
  const res = await fetch(`${API_URL}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ messages, session_id: sessionId ?? null, lang }),
  })
  return jsonOrThrow(res)
}

// --- Restore the last active chat ---
export async function getTriageHistory(): Promise<TriageHistory> {
  const res = await fetch(`${API_URL}/api/patient/triage-history`, { headers: await authHeader() })
  return jsonOrThrow(res)
}

// --- Close the active chat and start fresh (history stays stored) ---
export async function closeTriageSession() {
  const res = await fetch(`${API_URL}/api/patient/triage-history`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  return jsonOrThrow(res)
}

// --- Link/create the patient record for the logged-in user ---
export async function initPatient(input?: { full_name?: string; mobile_number?: string }) {
  const res = await fetch(`${API_URL}/api/patient/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input ?? {}),
  })
  return jsonOrThrow(res) as Promise<{ patient: PatientInfo | null; needs_profile?: boolean }>
}

// --- My patient record (served by the API; not dependent on client RLS) ---
export async function getMyPatient(): Promise<PatientInfo | null> {
  const res = await fetch(`${API_URL}/api/patient/me`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.patient ?? null
}

// --- Update my patient record ---
export async function updateMyPatient(input: { full_name?: string; mobile_number?: string }) {
  const res = await fetch(`${API_URL}/api/patient/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

// --- Cancel my appointment ---
export async function cancelAppointment(id: string) {
  const res = await fetch(`${API_URL}/api/patient/appointments/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
  })
  return jsonOrThrow(res)
}

// --- Available slots for a doctor on a date ---
export async function getSlots(doctorId: string, date: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/patient/slots?doctor_id=${doctorId}&date=${date}`)
  const body = await jsonOrThrow(res)
  return body.slots ?? []
}

// --- Book an appointment ---
export async function book(input: {
  doctor_id: string; date: string; start_time: string; reason?: string
}) {
  const res = await fetch(`${API_URL}/api/patient/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res) as Promise<{ appointment: Appointment }>
}

// --- Read doctors directly from Supabase (public_doctors view, RLS-open) ---
// select('*') keeps this working before AND after the ratings migration.
export async function getDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('public_doctors')
    .select('*')
    .order('full_name')
  if (error) throw error
  const docs = (data ?? []) as Doctor[]
  // Best-rated first when ratings exist, stable by name otherwise.
  return docs.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.full_name.localeCompare(b.full_name))
}

// --- My appointments (served by the API with doctor names included) ---
export async function getMyAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API_URL}/api/patient/appointments`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.appointments ?? []
}
