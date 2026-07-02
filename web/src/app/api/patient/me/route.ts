import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// GET  /api/patient/me    -> the patient's own record
// PATCH /api/patient/me   -> update full_name / mobile_number
// Served via the service role so it does not depend on client-side RLS.

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: patient } = await admin
      .from('patients')
      .select('id, full_name, mobile_number, email, date_of_birth, gender')
      .eq('user_id', user.id).maybeSingle()

    return NextResponse.json({ patient: patient ?? null })
  } catch (err) {
    console.error('patient/me GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, string> = {}
    if (typeof body.full_name === 'string' && body.full_name.trim()) updates.full_name = body.full_name.trim()
    if (typeof body.mobile_number === 'string' && body.mobile_number.trim()) updates.mobile_number = body.mobile_number.trim()
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data: patient, error } = await admin
      .from('patients')
      .update(updates)
      .eq('user_id', user.id)
      .select('id, full_name, mobile_number, email, date_of_birth, gender')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!patient) return NextResponse.json({ error: 'No patient profile' }, { status: 404 })
    return NextResponse.json({ patient })
  } catch (err) {
    console.error('patient/me PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
