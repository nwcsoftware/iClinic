import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

const ALLOWED = ['in_progress', 'completed', 'no_show'] as const

// POST /api/doctor/appointments/:id/status   { status }
// Lets a doctor move a visit through its states. Marking a no-show also stops
// that patient from leaving a review for a visit they never attended.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const status = body.status as (typeof ALLOWED)[number]
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${ALLOWED.join(', ')}` }, { status: 400 })
    }

    const { data, error } = await admin
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('doctor_id', doctor.id)   // a doctor can only touch their own visits
      .select('id, status')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

    return NextResponse.json({ appointment: data })
  } catch (err) {
    console.error('doctor appointment status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
