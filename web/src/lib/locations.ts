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
  formatted_address?: string | null
  google_maps_url?: string | null
  location_source?: string | null
}

export const LOCATION_SOURCES = [
  'google_maps_link', 'current_location', 'map_picker', 'address_search', 'admin',
] as const
export type LocationSource = (typeof LOCATION_SOURCES)[number]

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
// Migration 0010 adds the provenance columns (formatted_address,
// google_maps_url, location_source). Until it is applied, PostgREST answers any
// request that names them with 42703 / PGRST204. Rather than let that take out
// workplace listing, every read and write here falls back to the columns that
// have always existed, and remembers so it only pays for the discovery once.
// ---------------------------------------------------------------------------
const BASE_COLS = 'id, name, type, address, city, governorate, latitude, longitude, phone, is_verified'
const FULL_COLS = `${BASE_COLS}, formatted_address, google_maps_url, location_source`

let provenanceReady = true
function missingColumn(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}
export function locationColumns(): string {
  return provenanceReady ? FULL_COLS : BASE_COLS
}
function withoutProvenance<T extends Record<string, unknown>>(row: T): T {
  const { formatted_address: _a, google_maps_url: _b, location_source: _c, ...rest } = row
  return rest as T
}

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
    formattedAddress?: string | null
    googleMapsUrl?: string | null
    source?: LocationSource | null
  },
): Promise<{ location: HealthcareLocation; reused: boolean; geocoded: boolean }> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const city = input.city?.trim() || null
  const key = normaliseKey(name, city)

  // Match on the same normalised key the unique index uses.
  // Selecting a column list built at runtime costs the generated row types, so
  // the shape is asserted once here rather than at every use site.
  const lookup = async () => {
    const { data, error } = await admin
      .from('healthcare_locations')
      .select(locationColumns())
      .ilike('name', name)
      .limit(20)
    return { rows: (data ?? []) as unknown as HealthcareLocation[], error }
  }

  let { rows: existing, error: lookupError } = await lookup()
  if (missingColumn(lookupError)) {
    provenanceReady = false
    ;({ rows: existing } = await lookup())
  }

  const match = existing.find((l) => normaliseKey(l.name, l.city) === key)
  if (match) {
    // Fill in coordinates on a row that never had them, but never overwrite
    // a pin someone has already placed.
    if (match.latitude == null && input.latitude != null && input.longitude != null) {
      const patch = {
        latitude: input.latitude,
        longitude: input.longitude,
        formatted_address: input.formattedAddress?.trim() || null,
        google_maps_url: input.googleMapsUrl?.trim() || null,
        location_source: input.source ?? 'map_picker',
        is_verified: true,
        updated_at: new Date().toISOString(),
      }
      const patchRow = provenanceReady ? patch : withoutProvenance(patch)
      const { error: patchError } = await admin
        .from('healthcare_locations').update(patchRow).eq('id', match.id)
      if (missingColumn(patchError)) {
        provenanceReady = false
        await admin
          .from('healthcare_locations').update(withoutProvenance(patch)).eq('id', match.id)
      }
      match.latitude = input.latitude
      match.longitude = input.longitude
    }
    return { location: match, reused: true, geocoded: false }
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

  const row = {
      name,
      type: input.type,
      address: input.address?.trim() || null,
      city,
      governorate: input.governorate?.trim() || null,
      latitude,
      longitude,
      phone: input.phone?.trim() || null,
      formatted_address: input.formattedAddress?.trim() || null,
      google_maps_url: input.googleMapsUrl?.trim() || null,
      location_source: input.source ?? (geocoded ? 'address_search' : 'map_picker'),
      // A pin the doctor placed or confirmed counts as verified; one we guessed
      // from an address string does not.
      is_verified: !geocoded && latitude != null,
      created_by: input.createdBy ?? null,
  }

  const insert = async () => {
    const { data, error } = await admin
      .from('healthcare_locations')
      .insert(provenanceReady ? row : withoutProvenance(row))
      .select(locationColumns())
      .single()
    return { created: (data as unknown as HealthcareLocation | null), error }
  }

  let { created, error } = await insert()
  if (missingColumn(error)) {
    provenanceReady = false
    ;({ created, error } = await insert())
  }

  if (error) {
    // 23505: another request created the same place a moment ago. Read it back
    // rather than failing — the point is one row, not who won the race.
    if (error.code === '23505') {
      const { rows: raced } = await lookup()
      const found = raced.find((l) => normaliseKey(l.name, l.city) === key)
      if (found) return { location: found, reused: true, geocoded: false }
    }
    throw new Error(error.message)
  }

  if (!created) throw new Error('Could not save that location')
  return { location: created, reused: false, geocoded }
}

// ---------------------------------------------------------------------------
// Where a visit will take place.
//
// A doctor can work at several places on different days, so the answer depends
// on the date: Monday might be the hospital and Thursday the private clinic.
// Resolved on the server for both the booking preview and the booking itself,
// so the patient is shown exactly what gets stored.
// ---------------------------------------------------------------------------

export type VisitLocation = {
  id: string
  name: string
  type: LocationType
  address: string | null
  city: string | null
  governorate: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  formatted_address?: string | null
  google_maps_url?: string | null
}

/**
 * The workplace a doctor is at on `date` (YYYY-MM-DD).
 *
 * Picks the one whose working days include that weekday. When a doctor has
 * several that day, or none recorded, their primary workplace wins, so the
 * patient is never shown "location unknown" for a doctor who has one.
 * Returns null only when the doctor has no workplaces at all, which is the
 * case for every doctor who has not set them up yet.
 */
type WorkplaceRow = {
  is_primary: boolean
  working_days: number[] | null
  healthcare_locations: VisitLocation | null
}

/** Every workplace for the given doctors, in one query. */
export async function loadWorkplaces(
  admin: SupabaseClient,
  doctorIds: string[],
): Promise<Map<string, WorkplaceRow[]>> {
  const byDoctor = new Map<string, WorkplaceRow[]>()
  if (doctorIds.length === 0) return byDoctor

  const { data, error } = await admin
    .from('doctor_locations')
    .select(`doctor_id, is_primary, working_days, healthcare_locations ( ${locationColumns()} )`)
    .in('doctor_id', doctorIds)

  // Migration 0009 not applied, or no workplaces: callers treat an empty map
  // as "location not known", which the app renders rather than failing on.
  if (error || !data) return byDoctor

  for (const row of data as unknown as (WorkplaceRow & { doctor_id: string })[]) {
    if (!row.healthcare_locations) continue
    const list = byDoctor.get(row.doctor_id) ?? []
    list.push(row)
    byDoctor.set(row.doctor_id, list)
  }
  return byDoctor
}

/** Which of those workplaces the doctor is at on `date` (YYYY-MM-DD). */
export function pickWorkplaceForDate(
  rows: WorkplaceRow[] | undefined,
  date: string,
): VisitLocation | null {
  if (!rows || rows.length === 0) return null
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const onThatDay = rows.filter((r) => (r.working_days ?? []).includes(weekday))
  const pool = onThatDay.length > 0 ? onThatDay : rows
  return (pool.find((r) => r.is_primary) ?? pool[0]).healthcare_locations
}

export async function resolveVisitLocation(
  admin: SupabaseClient,
  doctorId: string,
  date: string,
): Promise<VisitLocation | null> {
  const byDoctor = await loadWorkplaces(admin, [doctorId])
  return pickWorkplaceForDate(byDoctor.get(doctorId), date)
}
