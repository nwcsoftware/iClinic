import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'
import { getRequestMeta } from '@/lib/request-meta'
import { computeAvailableSlots } from '@/lib/slots'
import { resolveVisitLocation } from '@/lib/locations'

// POST /api/patient/book   (Bearer auth)
// Body: { doctor_id, date (YYYY-MM-DD), start_time (HH:MM), reason?, triage_session_id? }
// Validates the slot server-side, then creates the appointment + pricing row
// as a patient-sourced booking.
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { doctor_id, date, start_time, reason } = body as {
      doctor_id?: string; date?: string; start_time?: string; reason?: string
    }
    if (!doctor_id || !date || !start_time) {
      return NextResponse.json({ error: 'doctor_id, date, and start_time are required' }, { status: 400 })
    }

    // The patient must have a linked record (created by /api/patient/init).
    const { data: patient } = await admin
      .from('patients').select('id').eq('user_id', user.id).maybeSingle()
    if (!patient) {
      return NextResponse.json({ error: 'No patient profile. Complete your profile first.', needs_profile: true }, { status: 400 })
    }

    // public_doctors already filters to active doctors with a live subscription,
    // so a lapsed doctor cannot receive new bookings.
    const { data: doctor } = await admin
      .from('public_doctors').select('id').eq('id', doctor_id).maybeSingle()
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not available' }, { status: 400 })
    }

    // Re-validate the slot against live availability (prevents double-booking
    // and bookings outside the doctor's hours).
    const open = await computeAvailableSlots(admin, doctor_id, date)
    if (!open.includes(start_time.slice(0, 5))) {
      return NextResponse.json({ error: 'That time is no longer available. Please pick another slot.' }, { status: 409 })
    }

    const { ip } = getRequestMeta(request)

    // Where the visit happens is decided here, not sent by the client, so the
    // stored location always matches the doctor's actual schedule for that day.
    const visitLocation = await resolveVisitLocation(admin, doctor_id, date)

    const row: Record<string, unknown> = {
      doctor_id,
      patient_id: patient.id,
      created_by: null,
      booking_source: 'patient_app',
      appointment_date: date,
      start_time,
      status: 'scheduled',
      reason: reason ?? null,
    }
    if (visitLocation) row.location_id = visitLocation.id

    let { data: appt, error: apptError } = await admin
      .from('appointments').insert(row).select().single()

    // Migration 0009 not applied yet: book without the location rather than
    // refusing the booking outright.
    if (apptError && (apptError.code === '42703' || apptError.code === 'PGRST204')) {
      delete row.location_id
      ;({ data: appt, error: apptError } = await admin
        .from('appointments').insert(row).select().single())
    }

    if (apptError) {
      // Unique-slot constraint (migration 0003): someone booked this slot first.
      if (apptError.code === '23505') {
        return NextResponse.json({ error: 'That time was just taken. Please pick another slot.' }, { status: 409 })
      }
      return NextResponse.json({ error: apptError.message }, { status: 400 })
    }

    // Pricing row (price to be set by clinic staff; starts at 0 / pending).
    await admin.from('appointment_pricing').insert({
      appointment_id: appt.id,
      doctor_id,
      base_price: 0,
      discount_amount: 0,
      net_amount: 0,
      payment_status: 'pending',
      currency: 'SAR',
    })

    void ip
    return NextResponse.json({ appointment: appt, location: visitLocation }, { status: 201 })
  } catch (err) {
    console.error('book error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
