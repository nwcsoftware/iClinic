import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// POST /api/patient/reviews   (Bearer auth)
// Body: { appointment_id, rating (1-5), comment? }
//
// A rating can only come from a visit that actually happened: the appointment
// must belong to this patient, be in the past, and not be cancelled or a
// no-show. The UNIQUE constraint on appointment_id means one review per visit;
// submitting again edits the existing one.
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const appointmentId = typeof body.appointment_id === 'string' ? body.appointment_id : ''
    const rating = Number(body.rating)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : null

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointment_id is required' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be a whole number from 1 to 5' }, { status: 400 })
    }

    const { data: patient } = await admin
      .from('patients').select('id').eq('user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'No patient profile' }, { status: 400 })

    const { data: appt } = await admin
      .from('appointments')
      .select('id, doctor_id, patient_id, appointment_date, start_time, status')
      .eq('id', appointmentId)
      .maybeSingle()

    if (!appt || appt.patient_id !== patient.id) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    if (appt.status === 'cancelled' || appt.status === 'no_show') {
      return NextResponse.json({ error: 'This visit cannot be reviewed' }, { status: 400 })
    }
    const visitAt = new Date(`${appt.appointment_date}T${appt.start_time}`)
    if (visitAt.getTime() > Date.now()) {
      return NextResponse.json({ error: 'You can review after your visit' }, { status: 400 })
    }

    const { data: review, error } = await admin
      .from('doctor_reviews')
      .upsert({
        doctor_id: appt.doctor_id,
        patient_id: patient.id,
        appointment_id: appt.id,
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'appointment_id' })
      .select('id, rating, comment, created_at')
      .single()

    if (error) {
      // PostgREST reports a missing table as PGRST205, Postgres as 42P01.
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Reviews are not enabled yet' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ review }, { status: 201 })
  } catch (err) {
    console.error('patient/reviews error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
