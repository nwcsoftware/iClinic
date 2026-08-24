import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

export type LocationType = 'hospital' | 'clinic' | 'private_clinic' | 'medical_center'

export type LocationDoctor = {
  id: string
  full_name: string
  specialty: string | null
  specialty_slug: string | null
  avatar_url: string | null
  rating: number | null
  review_count: number | null
  working_days: number[]
  is_primary: boolean
}

export type MapLocation = {
  id: string
  name: string
  type: LocationType
  address: string | null
  city: string | null
  governorate: string | null
  latitude: number
  longitude: number
  phone: string | null
  is_verified: boolean
  doctors: LocationDoctor[]
  doctor_count: number
}

// Lebanon, framed so the whole country sits in view on first paint.
export const LEBANON_CENTER = { lat: 33.87, lng: 35.65 }
export const LEBANON_BOUNDS: [[number, number], [number, number]] = [
  [34.9, 32.9], // south-west  [lng, lat]
  [37.0, 34.8], // north-east
]

export const LOCATION_LABEL: Record<LocationType, string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  private_clinic: 'Private clinic',
  medical_center: 'Medical center',
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Public endpoint — works signed out too, so the map can be browsed before
// anyone has an account.
export async function getMapLocations(opts?: {
  type?: LocationType | null
  specialty?: string | null
  q?: string | null
}): Promise<MapLocation[]> {
  const params = new URLSearchParams()
  if (opts?.type) params.set('type', opts.type)
  if (opts?.specialty) params.set('specialty', opts.specialty)
  if (opts?.q) params.set('q', opts.q)

  const res = await fetch(`${API_URL}/api/map/locations?${params.toString()}`)
  if (!res.ok) throw new Error(`Could not load the map (${res.status})`)
  const body = await res.json()
  return body.locations ?? []
}

// ---------------------------------------------------------------------------
// Doctor workplaces
// ---------------------------------------------------------------------------
export type DoctorWorkplace = {
  id: string
  working_days: number[]
  working_hours: Record<string, { start: string; end: string }>
  appointment_duration: number | null
  phone_number: string | null
  notes: string | null
  is_primary: boolean
  location: {
    id: string; name: string; type: LocationType; address: string | null
    city: string | null; governorate: string | null
    latitude: number | null; longitude: number | null
    phone: string | null; is_verified: boolean
  } | null
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body
}

export async function getMyWorkplaces(): Promise<DoctorWorkplace[]> {
  const res = await fetch(`${API_URL}/api/doctor/locations`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.locations ?? []
}

export async function addWorkplace(input: {
  name: string
  type: LocationType
  address?: string
  city?: string
  governorate?: string
  latitude?: number | null
  longitude?: number | null
  phone?: string
  working_days?: number[]
  appointment_duration?: number | null
  notes?: string
  is_primary?: boolean
}): Promise<{ reused: boolean; geocoded: boolean; needs_pin: boolean }> {
  const res = await fetch(`${API_URL}/api/doctor/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

export async function updateWorkplace(input: {
  id: string
  working_days?: number[]
  appointment_duration?: number | null
  notes?: string | null
  is_primary?: boolean
}) {
  const res = await fetch(`${API_URL}/api/doctor/locations`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

export async function removeWorkplace(id: string) {
  const res = await fetch(`${API_URL}/api/doctor/locations?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  return jsonOrThrow(res)
}

// ---------------------------------------------------------------------------
// Surgical history
// ---------------------------------------------------------------------------
export type Surgery = {
  id: string
  procedure_name: string
  surgery_date: string | null
  hospital_or_clinic: string | null
  surgeon_name: string | null
  notes: string | null
}

export async function getMySurgeries(): Promise<Surgery[]> {
  const res = await fetch(`${API_URL}/api/patient/surgeries`, { headers: await authHeader() })
  const body = await jsonOrThrow(res)
  return body.surgeries ?? []
}

export async function addSurgery(input: {
  procedure_name: string
  surgery_date?: string | null
  hospital_or_clinic?: string | null
  surgeon_name?: string | null
  notes?: string | null
}): Promise<Surgery> {
  const res = await fetch(`${API_URL}/api/patient/surgeries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  const body = await jsonOrThrow(res)
  return body.surgery
}

export async function removeSurgery(id: string) {
  const res = await fetch(`${API_URL}/api/patient/surgeries?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  return jsonOrThrow(res)
}
