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
      return NextResponse.json({ error: 'Only doctors can assign themselves to assistants' }, { status: 403 })
    }

    const { receptionist_id, doctor_id } = await request.json()
    if (!receptionist_id || !doctor_id) {
      return NextResponse.json({ error: 'receptionist_id and doctor_id are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check the receptionist belongs to this doctor
    const { data: rec } = await admin.from('profiles').select('created_by').eq('id', receptionist_id).single()
    if (!rec || rec.created_by !== user.id) {
      return NextResponse.json({ error: 'You can only assign doctors to your own assistants' }, { status: 403 })
    }

    // Upsert the assignment
    const { data, error } = await admin.from('receptionist_doctor_assignments').upsert({
      receptionist_id,
      doctor_id,
      assigned_by: user.id,
      is_active: true,
    }, { onConflict: 'receptionist_id,doctor_id' }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
