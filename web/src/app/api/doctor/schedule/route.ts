import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

// GET  /api/doctor/schedule — weekly availability + upcoming time-off days
// POST /api/doctor/schedule — update one weekday:
//   { weekday: 0-6, is_active?: boolean, start_time?: "HH:MM", end_time?: "HH:MM" }
//   Creates the weekday row (09:00-17:00 default) if it doesn't exist yet.

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const [{ data: availability }, { data: timeOff }] = await Promise.all([
      admin.from('doctor_availability')
        .select('id, weekday, start_time, end_time, slot_minutes, is_active')
        .eq('doctor_id', doctor.id)
        .order('weekday'),
      admin.from('doctor_time_off')
        .select('id, off_date, reason')
        .eq('doctor_id', doctor.id)
        .gte('off_date', today)
        .order('off_date'),
    ])

    return NextResponse.json({ availability: availability ?? [], time_off: timeOff ?? [] })
  } catch (err) {
    console.error('doctor/schedule GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const HHMM = /^\d{2}:\d{2}$/

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const weekday = Number(body.weekday)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return NextResponse.json({ error: 'weekday must be 0-6' }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.start_time === 'string' && HHMM.test(body.start_time)) updates.start_time = body.start_time
    if (typeof body.end_time === 'string' && HHMM.test(body.end_time)) updates.end_time = body.end_time
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    if (updates.start_time && updates.end_time && String(updates.start_time) >= String(updates.end_time)) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('doctor_availability')
      .select('id')
      .eq('doctor_id', doctor.id)
      .eq('weekday', weekday)

    if (existing && existing.length > 0) {
      const { error } = await admin
        .from('doctor_availability')
        .update(updates)
        .eq('doctor_id', doctor.id)
        .eq('weekday', weekday)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      const { error } = await admin.from('doctor_availability').insert({
        doctor_id: doctor.id,
        weekday,
        start_time: (updates.start_time as string) ?? '09:00',
        end_time: (updates.end_time as string) ?? '17:00',
        slot_minutes: 30,
        is_active: (updates.is_active as boolean) ?? true,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('doctor/schedule POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
