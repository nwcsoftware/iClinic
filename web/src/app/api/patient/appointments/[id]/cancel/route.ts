import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// POST /api/patient/appointments/:id/cancel   (Bearer auth)
// Lets a patient cancel their own upcoming appointment.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: patient } = await admin
      .from('patients').select('id').eq('user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ error: 'No patient profile' }, { status: 400 })

    const { data: appt } = await admin
      .from('appointments')
      .select('id, patient_id, status')
      .eq('id', id).maybeSingle()

    if (!appt || appt.patient_id !== patient.id) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    if (appt.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled appointments can be cancelled' }, { status: 400 })
    }

    const { data: updated, error } = await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_reason: 'Cancelled by patient',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ appointment: updated })
  } catch (err) {
    console.error('cancel error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
