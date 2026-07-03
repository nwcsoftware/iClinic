import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

export type DoctorMe = {
  id: string
  full_name: string
  specialty_name: string | null
  rating: number | null
  review_count: number | null
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
export async function getDoctorMe(): Promise<DoctorMe | null> {
  const res = await fetch(`${API_URL}/api/doctor/me`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.doctor ?? null
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
