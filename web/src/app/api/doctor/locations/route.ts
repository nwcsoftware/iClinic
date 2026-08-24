import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'
import { findOrCreateLocation, locationColumns, LOCATION_TYPES, LOCATION_SOURCES, type LocationType, type LocationSource } from '@/lib/locations'

// GET    /api/doctor/locations        — the doctor's workplaces
// POST   /api/doctor/locations        — add one (creates or reuses the place)
// PATCH  /api/doctor/locations        — edit the doctor's schedule at a place
// DELETE /api/doctor/locations?id=    — stop working somewhere
//
// Adding a workplace never creates a duplicate hospital: findOrCreateLocation
// matches on a normalised name+city, so several doctors at Saint George all
// attach to the same row and the map shows one marker.

const OWN = 'id, working_days, working_hours, appointment_duration, phone_number, notes, is_primary'
const select = () => `${OWN}, healthcare_locations ( ${locationColumns()} )`

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const read = async () => admin
      .from('doctor_locations')
      .select(select())
      .eq('doctor_id', doctor.id)
      .order('is_primary', { ascending: false })

    let { data, error } = await read()
    // Migration 0010 not applied: retry without the provenance columns so the
    // doctor still sees the workplaces they already have.
    if (error?.code === '42703' || error?.code === 'PGRST204') {
      ;({ data, error } = await read())
    }
    // Migration 0009 not applied yet — degrade instead of breaking the app.
    if (error) return NextResponse.json({ locations: [], enabled: false })

    return NextResponse.json({ locations: (data ?? []).map(flatten), enabled: true })
  } catch (err) {
    console.error('doctor/locations GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'A place name is required' }, { status: 400 })

    const type = (LOCATION_TYPES as readonly string[]).includes(body.type)
      ? (body.type as LocationType)
      : 'clinic'

    const lat = coord(body.latitude, 90)
    const lng = coord(body.longitude, 180)

    const { location, reused, geocoded } = await findOrCreateLocation(admin, {
      name,
      type,
      address: str(body.address),
      city: str(body.city),
      governorate: str(body.governorate),
      latitude: lat,
      longitude: lng,
      phone: str(body.phone),
      createdBy: doctor.id,
      formattedAddress: str(body.formatted_address),
      googleMapsUrl: str(body.google_maps_url),
      source: (LOCATION_SOURCES as readonly string[]).includes(body.location_source)
        ? (body.location_source as LocationSource)
        : null,
    })

    const { error } = await admin.from('doctor_locations').upsert({
      doctor_id: doctor.id,
      location_id: location.id,
      working_days: days(body.working_days),
      working_hours: typeof body.working_hours === 'object' && body.working_hours ? body.working_hours : {},
      appointment_duration: duration(body.appointment_duration),
      phone_number: str(body.phone_number),
      notes: str(body.notes),
      is_primary: body.is_primary === true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'doctor_id,location_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Only one primary workplace per doctor.
    if (body.is_primary === true) await clearOtherPrimaries(admin, doctor.id, location.id)

    return NextResponse.json({
      location,
      // Surfaced so the app can say "linked to an existing hospital" rather
      // than silently attaching the doctor to someone else's record.
      reused,
      geocoded,
      needs_pin: location.latitude == null,
    }, { status: 201 })
  } catch (err) {
    console.error('doctor/locations POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (Array.isArray(body.working_days)) patch.working_days = days(body.working_days)
    if (typeof body.working_hours === 'object' && body.working_hours) patch.working_hours = body.working_hours
    if ('appointment_duration' in body) patch.appointment_duration = duration(body.appointment_duration)
    if ('phone_number' in body) patch.phone_number = str(body.phone_number)
    if ('notes' in body) patch.notes = str(body.notes)
    if ('is_primary' in body) patch.is_primary = body.is_primary === true

    // .eq('doctor_id') is the authorization: a doctor can only edit their own row.
    const { data, error } = await admin
      .from('doctor_locations')
      .update(patch)
      .eq('id', id)
      .eq('doctor_id', doctor.id)
      .select('id, location_id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Workplace not found' }, { status: 404 })

    if (body.is_primary === true) {
      await clearOtherPrimaries(admin, doctor.id, data.location_id as string)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('doctor/locations PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Detach any availability pointing at this place so no slot is left
    // advertising a building the doctor no longer works in.
    const { data: row } = await admin
      .from('doctor_locations')
      .select('location_id')
      .eq('id', id)
      .eq('doctor_id', doctor.id)
      .maybeSingle()

    if (row) {
      await admin
        .from('doctor_availability')
        .update({ location_id: null })
        .eq('doctor_id', doctor.id)
        .eq('location_id', row.location_id)
    }

    // The shared healthcare_location row is deliberately left alone — other
    // doctors may still work there, and it belongs on the map either way.
    const { error } = await admin
      .from('doctor_locations')
      .delete()
      .eq('id', id)
      .eq('doctor_id', doctor.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('doctor/locations DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// --- helpers ---------------------------------------------------------------

async function clearOtherPrimaries(
  admin: ReturnType<typeof createAdminClient>, doctorId: string, keepLocationId: string,
) {
  await admin
    .from('doctor_locations')
    .update({ is_primary: false })
    .eq('doctor_id', doctorId)
    .neq('location_id', keepLocationId)
}

type Row = {
  id: string; working_days: number[] | null; working_hours: unknown
  appointment_duration: number | null; phone_number: string | null
  notes: string | null; is_primary: boolean
  healthcare_locations: unknown
}

// Supabase types an embedded relation as an array; it is one row here.
function flatten(r: unknown) {
  const row = r as Row
  const loc = Array.isArray(row.healthcare_locations)
    ? row.healthcare_locations[0]
    : row.healthcare_locations
  return {
    id: row.id,
    working_days: row.working_days ?? [],
    working_hours: row.working_hours ?? {},
    appointment_duration: row.appointment_duration,
    phone_number: row.phone_number,
    notes: row.notes,
    is_primary: row.is_primary,
    location: loc ?? null,
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null
}

function coord(v: unknown, max: number): number | null {
  const n = Number(v)
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null
}

function duration(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= 5 && n <= 240 ? Math.round(n) : null
}

function days(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
}
