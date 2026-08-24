import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Healthcare locations.
//
// The central rule: a hospital is ONE row and ONE map marker no matter how many
// doctors work there. findOrCreateLocation() is the only way a location should
// ever be written, so that rule cannot be bypassed by a new caller.
// ---------------------------------------------------------------------------

export const LOCATION_TYPES = ['hospital', 'clinic', 'private_clinic', 'medical_center'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

export type HealthcareLocation = {
  id: string
  name: string
  type: LocationType
  address: string | null
  city: string | null
  governorate: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  is_verified: boolean
}

// Lebanon's bounding box. Used to reject geocoding results that land in the
// wrong country — "Saint George" matches a lot of places worldwide.
export const LEBANON_BOUNDS = { minLat: 33.0, maxLat: 34.7, minLng: 35.1, maxLng: 36.7 }

export function insideLebanon(lat: number, lng: number): boolean {
  return lat >= LEBANON_BOUNDS.minLat && lat <= LEBANON_BOUNDS.maxLat
      && lng >= LEBANON_BOUNDS.minLng && lng <= LEBANON_BOUNDS.maxLng
}

// Mirrors normalise_location_key() in migration 0009. Kept in sync so the app
// can predict which rows will collide before it writes.
export function normaliseKey(name: string, city: string | null | undefined): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${clean(name ?? '')}|${clean(city ?? '')}`
}

export const GOVERNORATES = [
  'Beirut', 'Mount Lebanon', 'North', 'Akkar', 'Bekaa', 'Baalbek-Hermel', 'South', 'Nabatieh',
] as const

// ---------------------------------------------------------------------------
// Geocoding via OpenStreetMap Nominatim: free, no key, and its usage policy
// requires an identifying User-Agent, which is set below.
//
// Best-effort by design — a doctor can always drop the pin themselves, and a
// wrong pin is worse than no pin, so results outside Lebanon are discarded.
// ---------------------------------------------------------------------------
export async function geocode(input: {
  name?: string
  address?: string | null
  city?: string | null
}): Promise<{ latitude: number; longitude: number } | null> {
  const parts = [input.address, input.city, 'Lebanon'].filter(Boolean)
  const query = parts.join(', ')
  if (!query.trim() || query.trim() === 'Lebanon') return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'lb')

    const res = await fetch(url, {
      headers: { 'User-Agent': 'iClinic/1.0 (healthcare booking; Lebanon)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const body = await res.json()
    const hit = Array.isArray(body) ? body[0] : null
    if (!hit) return null

    const latitude = Number(hit.lat)
    const longitude = Number(hit.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    // Reject anything that is not actually in Lebanon.
    if (!insideLebanon(latitude, longitude)) return null

    return { latitude, longitude }
  } catch {
    // Timeout, network failure, rate limit — the doctor places the pin instead.
    return null
  }
}

// ---------------------------------------------------------------------------
// The single entry point for creating a location.
//
// Looks for an existing row by normalised name+city first. Only creates when
// there genuinely is no match, and only geocodes when coordinates were not
// supplied. Returns whether it reused an existing place so the caller can tell
// the doctor "we linked you to the hospital that already exists".
// ---------------------------------------------------------------------------
export async function findOrCreateLocation(
  admin: SupabaseClient,
  input: {
    name: string
    type: LocationType
    address?: string | null
    city?: string | null
    governorate?: string | null
    latitude?: number | null
    longitude?: number | null
    phone?: string | null
    createdBy?: string | null
  },
): Promise<{ location: HealthcareLocation; reused: boolean; geocoded: boolean }> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const city = input.city?.trim() || null
  const key = normaliseKey(name, city)

  // Match on the same normalised key the unique index uses.
  const { data: existing } = await admin
    .from('healthcare_locations')
    .select('id, name, type, address, city, governorate, latitude, longitude, phone, is_verified')
    .ilike('name', name)
    .limit(20)

  const match = (existing ?? []).find(
    (l) => normaliseKey(l.name as string, l.city as string | null) === key,
  )
  if (match) {
    // Fill in coordinates on a row that never had them, but never overwrite
    // a pin someone has already placed.
    if (match.latitude == null && input.latitude != null && input.longitude != null) {
      await admin
        .from('healthcare_locations')
        .update({ latitude: input.latitude, longitude: input.longitude, updated_at: new Date().toISOString() })
        .eq('id', match.id)
      match.latitude = input.latitude
      match.longitude = input.longitude
    }
    return { location: match as HealthcareLocation, reused: true, geocoded: false }
  }

  let latitude = input.latitude ?? null
  let longitude = input.longitude ?? null
  let geocoded = false

  if (latitude == null || longitude == null) {
    const hit = await geocode({ name, address: input.address, city })
    if (hit) {
      latitude = hit.latitude
      longitude = hit.longitude
      geocoded = true
    }
  }

  const { data: created, error } = await admin
    .from('healthcare_locations')
    .insert({
      name,
      type: input.type,
      address: input.address?.trim() || null,
      city,
      governorate: input.governorate?.trim() || null,
      latitude,
      longitude,
      phone: input.phone?.trim() || null,
      // A doctor placing their own pin counts as verified; a guessed one does not.
      is_verified: !geocoded && latitude != null,
      created_by: input.createdBy ?? null,
    })
    .select('id, name, type, address, city, governorate, latitude, longitude, phone, is_verified')
    .single()

  if (error) {
    // 23505: another request created the same place a moment ago. Read it back
    // rather than failing — the point is one row, not who won the race.
    if (error.code === '23505') {
      const { data: raced } = await admin
        .from('healthcare_locations')
        .select('id, name, type, address, city, governorate, latitude, longitude, phone, is_verified')
        .ilike('name', name)
        .limit(20)
      const found = (raced ?? []).find(
        (l) => normaliseKey(l.name as string, l.city as string | null) === key,
      )
      if (found) return { location: found as HealthcareLocation, reused: true, geocoded: false }
    }
    throw new Error(error.message)
  }

  return { location: created as HealthcareLocation, reused: false, geocoded }
}
