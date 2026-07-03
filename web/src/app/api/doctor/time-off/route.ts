import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor } from '@/lib/doctor-auth'

// POST /api/doctor/time-off  { date: "YYYY-MM-DD" }
// Toggles a specific day off/on: if the date is already blocked it becomes
// available again, otherwise it's blocked (patients can't book it).
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const date = typeof body.date === 'string' ? body.date : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('doctor_time_off')
      .select('id')
      .eq('doctor_id', doctor.id)
      .eq('off_date', date)
      .maybeSingle()

    if (existing) {
      const { error } = await admin.from('doctor_time_off').delete().eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ off: false })
    }

    const { error } = await admin.from('doctor_time_off').insert({
      doctor_id: doctor.id,
      off_date: date,
      reason: 'Set unavailable from the app',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ off: true })
  } catch (err) {
    console.error('doctor/time-off error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
