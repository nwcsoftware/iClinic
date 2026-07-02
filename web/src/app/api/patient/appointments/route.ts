import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

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

    const { data: appts, error } = await admin
      .from('appointments')
      .select('id, doctor_id, appointment_date, start_time, status, reason')
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const doctorIds = [...new Set((appts ?? []).map((a) => a.doctor_id))]
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

    const appointments = (appts ?? []).map((a) => ({
      ...a,
      doctor_name: names.get(a.doctor_id)?.full_name ?? 'Doctor',
      specialty_name: names.get(a.doctor_id)?.specialty_name ?? null,
    }))

    return NextResponse.json({ appointments })
  } catch (err) {
    console.error('patient/appointments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
