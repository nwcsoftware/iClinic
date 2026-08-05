import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

// GET /api/doctor/visits?scope=past|upcoming   (default past)
//
// The doctor's own visits with patient names, and whether each one already has
// a prescription — that flag is what drives the "Prescribe" vs "View
// prescription" action in the app.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scope = new URL(request.url).searchParams.get('scope') ?? 'past'
    const today = new Date().toISOString().slice(0, 10)

    let q = admin
      .from('appointments')
      .select('id, patient_id, appointment_date, start_time, end_time, status, reason')
      .eq('doctor_id', doctor.id)

    q = scope === 'upcoming'
      ? q.gte('appointment_date', today).order('appointment_date', { ascending: true })
      : q.lte('appointment_date', today).order('appointment_date', { ascending: false })

    const { data: visits, error } = await q.order('start_time', { ascending: false }).limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const rows = visits ?? []
    if (rows.length === 0) return NextResponse.json({ visits: [] })

    const patientIds = [...new Set(rows.map((v) => v.patient_id as string))]
    const { data: patients } = await admin
      .from('patients').select('id, full_name, mobile_number').in('id', patientIds)
    const byId = new Map((patients ?? []).map((p) => [p.id as string, p]))

    // Which of these visits already have a prescription.
    const { data: rx } = await admin
      .from('prescriptions')
      .select('id, appointment_id')
      .eq('doctor_id', doctor.id)
      .in('appointment_id', rows.map((v) => v.id as string))
    const rxByAppt = new Map((rx ?? []).map((r) => [r.appointment_id as string, r.id as string]))

    const nowMs = Date.now()

    return NextResponse.json({
      visits: rows.map((v) => {
        const p = byId.get(v.patient_id as string)
        return {
          id: v.id,
          patient_id: v.patient_id,
          patient_name: p?.full_name ?? 'Patient',
          patient_mobile: p?.mobile_number ?? null,
          appointment_date: v.appointment_date,
          start_time: v.start_time,
          status: v.status,
          reason: v.reason,
          is_past: new Date(`${v.appointment_date}T${v.start_time}`).getTime() < nowMs,
          prescription_id: rxByAppt.get(v.id as string) ?? null,
        }
      }),
    })
  } catch (err) {
    console.error('doctor/visits error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
