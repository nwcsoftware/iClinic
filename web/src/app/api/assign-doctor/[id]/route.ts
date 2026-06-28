import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify the assignment belongs to this doctor's receptionist
    const { data: assignment } = await admin
      .from('receptionist_doctor_assignments')
      .select('assigned_by, receptionist_id')
      .eq('id', id)
      .single()

    if (!assignment || assignment.assigned_by !== user.id) {
      return NextResponse.json({ error: 'Not authorized to remove this assignment' }, { status: 403 })
    }

    await admin.from('receptionist_doctor_assignments').update({ is_active: false }).eq('id', id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
