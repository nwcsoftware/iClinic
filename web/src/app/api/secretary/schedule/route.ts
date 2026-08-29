import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireSecretary, worksForDoctor, listGrantedLocations, auditSecretary,
} from '@/lib/secretary-auth'

// ---------------------------------------------------------------------------
// The doctor's availability, for the locations a secretary was granted.
//
// A doctor who works Monday and Wednesday at one clinic and Tuesday at a
// hospital has two schedules, not one. A secretary granted the clinic can
// change the clinic's days and hours and cannot see the hospital's, because
// working days live on doctor_locations, per workplace.
//
// Changes land on the same rows the booking system reads, so a slot a
// secretary opens is bookable by a patient immediately. That is the point of
// the feature, and the reason the writes are scoped this tightly.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const secretary = await requireSecretary(request, admin)
    if (!secretary) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const doctorId = new URL(request.url).searchParams.get('doctor_id')
    if (!doctorId) return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })
    if (!(await worksForDoctor(admin, secretary.id, doctorId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // listGrantedLocations already carries working_days, working_hours and the
    // appointment duration, so the schedule screen needs nothing further.
    return NextResponse.json({ locations: await listGrantedLocations(admin, secretary.id, doctorId) })
  } catch (err) {
    console.error('secretary/schedule GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — working days, hours and slot length for one granted workplace.
//
// Takes a doctor_location_id rather than a location, because the schedule
// belongs to the doctor-at-that-place, and confirms that exact row was granted
// to this secretary before writing.
export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const secretary = await requireSecretary(request, admin)
    if (!secretary) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const doctorId = typeof body.doctor_id === 'string' ? body.doctor_id : ''
    const doctorLocationId = typeof body.doctor_location_id === 'string' ? body.doctor_location_id : ''
    if (!doctorId || !doctorLocationId) {
      return NextResponse.json({ error: 'doctor_id and doctor_location_id are required' }, { status: 400 })
    }

    if (!(await worksForDoctor(admin, secretary.id, doctorId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // The grant is checked on the workplace row itself, so a secretary cannot
    // edit a schedule at a location this doctor never gave them.
    const granted = await listGrantedLocations(admin, secretary.id, doctorId)
    const target = granted.find((g) => g.doctor_location_id === doctorLocationId)
    if (!target) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (Array.isArray(body.working_days)) {
      const days = body.working_days
        .filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
      patch.working_days = [...new Set(days)].sort()
    }

    // Shape checked rather than passed through: { "1": { start, end } } with
    // HH:MM times, so a malformed object cannot corrupt the availability the
    // booking system computes from it.
    if (body.working_hours && typeof body.working_hours === 'object') {
      const clean: Record<string, { start: string; end: string }> = {}
      const time = /^([01]\d|2[0-3]):[0-5]\d$/
      for (const [day, value] of Object.entries(body.working_hours as Record<string, unknown>)) {
        if (!/^[0-6]$/.test(day)) continue
        const v = value as { start?: unknown; end?: unknown }
        if (typeof v?.start !== 'string' || typeof v?.end !== 'string') continue
        if (!time.test(v.start) || !time.test(v.end) || v.start >= v.end) continue
        clean[day] = { start: v.start, end: v.end }
      }
      patch.working_hours = clean
    }

    if (Number.isInteger(body.appointment_duration)) {
      const d = body.appointment_duration as number
      if (d >= 5 && d <= 240) patch.appointment_duration = d
    }

    const { error } = await admin
      .from('doctor_locations').update(patch).eq('id', doctorLocationId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditSecretary(admin, {
      secretaryId: secretary.id,
      doctorId,
      action: 'schedule_changed',
      entity: 'doctor_location',
      entityId: doctorLocationId,
      detail: { location: target.name, ...patch },
    })

    return NextResponse.json({ locations: await listGrantedLocations(admin, secretary.id, doctorId) })
  } catch (err) {
    console.error('secretary/schedule PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
