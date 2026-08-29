import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireSecretary, worksForDoctor, mayUseLocation, listGrantedLocations,
  auditSecretary, SECRETARY_STATUSES, type SecretaryStatus,
} from '@/lib/secretary-auth'

// ---------------------------------------------------------------------------
// Appointments, as a secretary is allowed to see them.
//
// Read through secretary_appointments, a view whose projection has no reason,
// no notes, no diagnosis, no treatment, no doctor notes and no follow-up, and
// carries only the patient's name, phone and blood type. The medical columns
// are not filtered out here; they are not in the view at all, so no mistake in
// this file can leak one.
//
// Every request is scoped twice: to a doctor this secretary works for, and to
// a location that doctor granted them. Both are checked against the database,
// never taken from the request.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const secretary = await requireSecretary(request, admin)
    if (!secretary) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const doctorId = params.get('doctor_id')
    if (!doctorId) return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })

    if (!(await worksForDoctor(admin, secretary.id, doctorId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // The locations this secretary may see for this doctor. An appointment at
    // any other location is not filtered from the results — it is never asked
    // for, because the query is restricted to these ids.
    const granted = await listGrantedLocations(admin, secretary.id, doctorId)
    const allowedLocationIds = granted.map((g) => g.location_id)
    if (allowedLocationIds.length === 0) {
      return NextResponse.json({ appointments: [], locations: [] })
    }

    const wantedLocation = params.get('location_id')
    if (wantedLocation && !allowedLocationIds.includes(wantedLocation)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let q = admin
      .from('secretary_appointments')
      .select('*')
      .eq('doctor_id', doctorId)
      .in('location_id', wantedLocation ? [wantedLocation] : allowedLocationIds)

    const from = params.get('from')
    const to = params.get('to')
    const on = params.get('date')
    if (on) q = q.eq('appointment_date', on)
    if (from) q = q.gte('appointment_date', from)
    if (to) q = q.lte('appointment_date', to)

    const status = params.get('status')
    if (status && (SECRETARY_STATUSES as readonly string[]).includes(status)) {
      q = q.eq('status', status)
    }

    const search = params.get('q')?.trim()
    if (search) q = q.ilike('patient_name', `%${search}%`)

    const { data, error } = await q
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(300)

    // Migration 0011 not applied: the view does not exist yet.
    if (error) return NextResponse.json({ appointments: [], locations: granted, enabled: false })

    return NextResponse.json({ appointments: data ?? [], locations: granted, enabled: true })
  } catch (err) {
    console.error('secretary/appointments GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — administrative status only.
//
// A secretary saying someone turned up is a fact about attendance, not about
// their health, so it changes `status` and nothing else. No consultation
// record is written and no medical column is touched, which is why the update
// names its one column explicitly instead of spreading a request body.
export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const secretary = await requireSecretary(request, admin)
    if (!secretary) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    const status = body.status as SecretaryStatus
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!(SECRETARY_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'That is not a status a secretary can set' }, { status: 400 })
    }

    // Which doctor and location does this appointment actually belong to?
    // Asked of the database rather than trusted from the request, so a
    // guessed id cannot be paired with a doctor the secretary does work for.
    const { data: appt } = await admin
      .from('appointments').select('id, doctor_id, location_id, status').eq('id', id).maybeSingle()
    if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!(await worksForDoctor(admin, secretary.id, appt.doctor_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!(await mayUseLocation(admin, secretary.id, appt.doctor_id, appt.location_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditSecretary(admin, {
      secretaryId: secretary.id,
      doctorId: appt.doctor_id,
      action: 'appointment_status_changed',
      entity: 'appointment',
      entityId: id,
      detail: { from: appt.status, to: status },
    })

    return NextResponse.json({ id, status })
  } catch (err) {
    console.error('secretary/appointments PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
