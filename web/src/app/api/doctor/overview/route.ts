import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// GET /api/doctor/overview — the doctor's day + week at a glance:
// today's appointments (with patient names), per-day counts for the next
// 7 days, and headline stats.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    const start = ymd(today)
    const endDate = new Date(today); endDate.setDate(today.getDate() + 6)
    const end = ymd(endDate)

    const [{ data: weekAppts }, { data: allAppts }] = await Promise.all([
      admin.from('appointments')
        .select('id, patient_id, appointment_date, start_time, status, reason')
        .eq('doctor_id', doctor.id)
        .gte('appointment_date', start)
        .lte('appointment_date', end)
        .neq('status', 'cancelled')
        .order('appointment_date').order('start_time'),
      admin.from('appointments')
        .select('patient_id')
        .eq('doctor_id', doctor.id)
        .neq('status', 'cancelled'),
    ])

    // Patient names for today's list
    const todays = (weekAppts ?? []).filter((a) => a.appointment_date === start)
    const patientIds = [...new Set(todays.map((a) => a.patient_id))]
    const names = new Map<string, string>()
    if (patientIds.length > 0) {
      const { data: pts } = await admin.from('patients').select('id, full_name').in('id', patientIds)
      for (const p of pts ?? []) names.set(p.id, p.full_name)
    }

    // Per-day counts for the next 7 days
    const days: { date: string; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i)
      const key = ymd(d)
      days.push({ date: key, count: (weekAppts ?? []).filter((a) => a.appointment_date === key).length })
    }

    return NextResponse.json({
      today: todays.map((a) => ({
        id: a.id,
        start_time: a.start_time,
        status: a.status,
        reason: a.reason,
        patient_name: names.get(a.patient_id) ?? 'Patient',
      })),
      days,
      stats: {
        total_patients: new Set((allAppts ?? []).map((a) => a.patient_id)).size,
        week_visits: (weekAppts ?? []).length,
        today_visits: todays.length,
      },
    })
  } catch (err) {
    console.error('doctor/overview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
