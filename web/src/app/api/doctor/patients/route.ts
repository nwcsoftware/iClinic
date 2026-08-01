import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

// GET /api/doctor/patients — everyone this doctor has seen or will see,
// with visit counts and the next/last visit date.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: appts } = await admin
      .from('appointments')
      .select('patient_id, appointment_date, status')
      .eq('doctor_id', doctor.id)
      .neq('status', 'cancelled')
      .order('appointment_date', { ascending: false })

    const byPatient = new Map<string, { visits: number; last_visit: string }>()
    for (const a of appts ?? []) {
      const cur = byPatient.get(a.patient_id)
      if (cur) cur.visits += 1
      else byPatient.set(a.patient_id, { visits: 1, last_visit: a.appointment_date })
    }

    if (byPatient.size === 0) return NextResponse.json({ patients: [] })

    const { data: pts } = await admin
      .from('patients')
      .select('id, full_name, mobile_number, email, gender, date_of_birth')
      .in('id', [...byPatient.keys()])

    const patients = (pts ?? [])
      .map((p) => ({ ...p, ...byPatient.get(p.id)! }))
      .sort((a, b) => b.last_visit.localeCompare(a.last_visit))

    return NextResponse.json({ patients })
  } catch (err) {
    console.error('doctor/patients error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
