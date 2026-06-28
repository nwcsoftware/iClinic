import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'doctor') {
      return NextResponse.json({ error: 'Only doctors can create appointments' }, { status: 403 })
    }

    const body = await request.json()
    const { patient_id, appointment_date, start_time, end_time, reason, notes, base_price, currency } = body

    if (!patient_id || !appointment_date || !start_time) {
      return NextResponse.json({ error: 'patient_id, appointment_date, and start_time are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: appt, error: apptError } = await admin.from('appointments').insert({
      doctor_id: user.id,
      patient_id,
      created_by: user.id,
      appointment_date,
      start_time,
      end_time: end_time ?? null,
      status: 'scheduled',
      reason: reason ?? null,
      notes: notes ?? null,
    }).select().single()

    if (apptError) return NextResponse.json({ error: apptError.message }, { status: 400 })

    // Create pricing record
    const price = parseFloat(base_price) || 0
    await admin.from('appointment_pricing').insert({
      appointment_id: appt.id,
      doctor_id: user.id,
      base_price: price,
      discount_amount: 0,
      net_amount: price,
      payment_status: 'pending',
      currency: currency ?? 'SAR',
    })

    return NextResponse.json(appt, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
