import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'
import { locationColumns, loadWorkplaces, pickWorkplaceForDate } from '@/lib/locations'

// GET /api/patient/appointments   (Bearer auth)
// The patient's appointments with doctor name + specialty, newest first.
// Served via the service role so it does not depend on client-side RLS.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: patient } = await admin
      .from('patients').select('id').eq('user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ appointments: [] })

    // The location is joined in so a patient can see where a visit will be.
    // Migrations 0009/0010 add those columns; until they are applied the query
    // falls back to the appointment on its own rather than erroring.
    // Selecting a column list built at runtime costs the generated row types,
    // so the shape is asserted once here rather than at every use site.
    type ApptRow = {
      id: string
      doctor_id: string
      appointment_date: string
      start_time: string
      status: string
      reason: string | null
      healthcare_locations?: Record<string, unknown> | null
    }

    const read = async (withLocation: boolean) => {
      const { data, error } = await admin
        .from('appointments')
        .select(
          withLocation
            ? `id, doctor_id, appointment_date, start_time, status, reason, healthcare_locations ( ${locationColumns()} )`
            : 'id, doctor_id, appointment_date, start_time, status, reason',
        )
        .eq('patient_id', patient.id)
        .order('appointment_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(100)
      return { rows: (data ?? []) as unknown as ApptRow[], error }
    }

    let { rows: appts, error } = await read(true)
    if (error) ({ rows: appts, error } = await read(false))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const doctorIds = [...new Set(appts.map((a) => a.doctor_id))]
    const names = new Map<string, { full_name: string; specialty_name: string | null }>()
    if (doctorIds.length > 0) {
      const { data: docs } = await admin
        .from('public_doctors').select('id, full_name, specialty_name')
        .in('id', doctorIds)
      for (const d of docs ?? []) names.set(d.id, { full_name: d.full_name, specialty_name: d.specialty_name })
      // Doctors deactivated since booking won't be in the public view — fetch names directly.
      const missing = doctorIds.filter((id) => !names.has(id))
      if (missing.length > 0) {
        const { data: profs } = await admin.from('profiles').select('id, full_name, specialty').in('id', missing)
        for (const p of profs ?? []) names.set(p.id, { full_name: p.full_name, specialty_name: p.specialty })
      }
    }

    // Which of these visits has the patient already rated?
    const reviews = new Map<string, { rating: number; comment: string | null }>()
    const apptIds = appts.map((a) => a.id)
    if (apptIds.length > 0) {
      const { data: rows, error: revErr } = await admin
        .from('doctor_reviews')
        .select('appointment_id, rating, comment')
        .in('appointment_id', apptIds)
      // Reviews not enabled yet -> nothing to merge, everything else still works.
      if (!revErr) {
        for (const r of rows ?? []) reviews.set(r.appointment_id, { rating: r.rating, comment: r.comment })
      }
    }

    // Bookings made before appointments carried a location have none stored.
    // Rather than telling the patient the place is unknown when the doctor has
    // in fact set their workplaces, the schedule is consulted for that date.
    // A stored location always wins: the doctor may have changed their days
    // since, and where the visit was booked is what was agreed.
    const needsFallback = appts.some((a) => !a.healthcare_locations)
    const workplaces = needsFallback
      ? await loadWorkplaces(admin, doctorIds)
      : new Map()

    const now = Date.now()
    const appointments = appts.map((a) => {
      const review = reviews.get(a.id) ?? null
      const isPast = new Date(`${a.appointment_date}T${a.start_time}`).getTime() <= now
      // Flatten the join: the app wants `location`, not `healthcare_locations`.
      const { healthcare_locations: place, ...rest } = a
      return {
        ...rest,
        location: place ?? pickWorkplaceForDate(workplaces.get(a.doctor_id), a.appointment_date),
        doctor_name: names.get(a.doctor_id)?.full_name ?? 'Doctor',
        specialty_name: names.get(a.doctor_id)?.specialty_name ?? null,
        my_rating: review?.rating ?? null,
        my_comment: review?.comment ?? null,
        // Only a visit that actually happened can be rated.
        can_review: isPast && a.status !== 'cancelled' && a.status !== 'no_show',
      }
    })

    return NextResponse.json({ appointments })
  } catch (err) {
    console.error('patient/appointments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
