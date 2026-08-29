import type { SupabaseClient } from '@supabase/supabase-js'
import { getBearerUser } from './patient-auth'

// ---------------------------------------------------------------------------
// Who a secretary is, and what they are allowed to touch.
//
// Every secretary request answers two questions before it does anything:
// does this secretary work for that doctor, and has that doctor granted them
// that location? Neither is inferred from the other. A secretary who works for
// a doctor with three clinics has been granted the clinics they were named on,
// and no more.
//
// The checks live here rather than in each route so a new endpoint cannot
// forget one. Routes call requireSecretary, then one of the assert helpers,
// and only then read data.
//
// "Secretary" is the word in the interface; `receptionist` is the value in the
// database, because the role already existed under that name and renaming it
// would break the pages already using it. Same job, one role.
// ---------------------------------------------------------------------------

export type SecretaryProfile = {
  id: string
  full_name: string
  phone: string | null
  is_active: boolean
}

/** The doctor a secretary works for, as the secretary is allowed to see them. */
export type LinkedDoctor = {
  link_id: string
  doctor_id: string
  full_name: string
  specialty: string | null
  avatar_url: string | null
  status: 'active' | 'inactive'
}

/** One workplace a secretary may manage for a given doctor. */
export type GrantedLocation = {
  doctor_location_id: string
  location_id: string
  name: string
  type: string
  city: string | null
  address: string | null
  working_days: number[]
  working_hours: Record<string, { start: string; end: string }>
  appointment_duration: number | null
}

/**
 * Resolves the bearer token to an ACTIVE secretary, or null.
 *
 * Returns null for a doctor, a patient or a deactivated account alike: the
 * caller turns that into a 401 without saying which it was.
 */
export async function requireSecretary(
  request: Request,
  admin: SupabaseClient,
): Promise<SecretaryProfile | null> {
  const user = await getBearerUser(request, admin)
  if (!user) return null

  const { data } = await admin
    .from('profiles')
    .select('id, full_name, phone, is_active, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!data || data.role !== 'receptionist' || !data.is_active) return null
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone ?? null) as string | null,
    is_active: data.is_active as boolean,
  }
}

/** Does this secretary currently work for this doctor? */
export async function worksForDoctor(
  admin: SupabaseClient,
  secretaryId: string,
  doctorId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('receptionist_doctor_assignments')
    .select('id')
    .eq('receptionist_id', secretaryId)
    .eq('doctor_id', doctorId)
    .eq('is_active', true)
    .maybeSingle()
  return !!data
}

/**
 * Has this doctor granted this secretary this location?
 *
 * Takes the healthcare location id, which is what an appointment stores, and
 * resolves it through the doctor's own workplace row — so a location the
 * doctor does not work at can never match, even if some other doctor granted
 * it to the same secretary.
 */
export async function mayUseLocation(
  admin: SupabaseClient,
  secretaryId: string,
  doctorId: string,
  locationId: string | null,
): Promise<boolean> {
  if (!locationId) return false
  const { data } = await admin
    .from('receptionist_doctor_assignments')
    .select('id, receptionist_location_grants ( doctor_locations ( location_id ) )')
    .eq('receptionist_id', secretaryId)
    .eq('doctor_id', doctorId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return false
  type Row = { receptionist_location_grants?: { doctor_locations?: { location_id: string } | null }[] }
  const grants = (data as unknown as Row).receptionist_location_grants ?? []
  return grants.some((g) => g.doctor_locations?.location_id === locationId)
}

/** The doctors this secretary works for. */
export async function listDoctors(
  admin: SupabaseClient,
  secretaryId: string,
): Promise<LinkedDoctor[]> {
  const { data } = await admin
    .from('receptionist_doctor_assignments')
    .select('id, is_active, doctor_id, profiles!receptionist_doctor_assignments_doctor_id_fkey ( full_name, specialty, avatar_url )')
    .eq('receptionist_id', secretaryId)
    .eq('is_active', true)

  type Row = {
    id: string; is_active: boolean; doctor_id: string
    profiles: { full_name: string; specialty: string | null; avatar_url: string | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    link_id: r.id,
    doctor_id: r.doctor_id,
    full_name: r.profiles?.full_name ?? 'Doctor',
    specialty: r.profiles?.specialty ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
    status: r.is_active ? 'active' : 'inactive',
  }))
}

/**
 * The workplaces this secretary may manage for one doctor.
 *
 * An empty list is a valid answer and means the doctor has granted nothing
 * yet, which the dashboard shows as an empty state rather than an error.
 */
export async function listGrantedLocations(
  admin: SupabaseClient,
  secretaryId: string,
  doctorId: string,
): Promise<GrantedLocation[]> {
  const { data } = await admin
    .from('receptionist_doctor_assignments')
    .select(`
      id,
      receptionist_location_grants (
        doctor_locations (
          id, location_id, working_days, working_hours, appointment_duration,
          healthcare_locations ( id, name, type, city, address )
        )
      )
    `)
    .eq('receptionist_id', secretaryId)
    .eq('doctor_id', doctorId)
    .eq('is_active', true)
    .maybeSingle()

  if (!data) return []

  type Place = { id: string; name: string; type: string; city: string | null; address: string | null }
  type DocLoc = {
    id: string; location_id: string
    working_days: number[] | null
    working_hours: Record<string, { start: string; end: string }> | null
    appointment_duration: number | null
    healthcare_locations: Place | null
  }
  type Row = { receptionist_location_grants?: { doctor_locations: DocLoc | null }[] }

  const grants = (data as unknown as Row).receptionist_location_grants ?? []
  return grants
    .map((g) => g.doctor_locations)
    .filter((dl): dl is DocLoc => !!dl && !!dl.healthcare_locations)
    .map((dl) => ({
      doctor_location_id: dl.id,
      location_id: dl.location_id,
      name: dl.healthcare_locations!.name,
      type: dl.healthcare_locations!.type,
      city: dl.healthcare_locations!.city,
      address: dl.healthcare_locations!.address,
      working_days: dl.working_days ?? [],
      working_hours: dl.working_hours ?? {},
      appointment_duration: dl.appointment_duration,
    }))
}

/**
 * Records what a secretary did, for the doctor to read.
 *
 * Never allowed to fail a request: an action that succeeded should not be
 * reported as an error because the note about it could not be filed.
 */
export async function auditSecretary(
  admin: SupabaseClient,
  entry: {
    secretaryId: string
    doctorId: string
    action: string
    entity?: string
    entityId?: string
    detail?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.from('secretary_audit_log').insert({
      secretary_id: entry.secretaryId,
      doctor_id: entry.doctorId,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ?? null,
    })
  } catch {
    /* the action stands; the log entry is best effort */
  }
}

/**
 * Statuses a secretary may set. All administrative, none medical.
 *
 * `no_show` is the enum's existing name for "not completed" — the patient did
 * not come — so it is reused rather than adding a second value meaning the
 * same thing. NOT_COMPLETED gives the interface its label without a second
 * database value to keep in step.
 */
export const SECRETARY_STATUSES = [
  'scheduled', 'confirmed', 'completed', 'no_show', 'cancelled',
] as const

export const STATUS_LABEL: Record<SecretaryStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'Not completed',
  cancelled: 'Cancelled',
}
export type SecretaryStatus = (typeof SECRETARY_STATUSES)[number]
