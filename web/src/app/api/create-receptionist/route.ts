import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestMeta } from '@/lib/request-meta'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'doctor') {
      return NextResponse.json({ error: 'Only doctors can create assistants' }, { status: 403 })
    }

    const { full_name, email, password, phone } = await request.json()
    if (!full_name || !email || !password) {
      return NextResponse.json({ error: 'full_name, email, and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const { ip, device } = getRequestMeta(request)
    const admin = createAdminClient()

    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const { error: profileError } = await admin.from('profiles').insert({
      id: auth.user.id,
      role: 'receptionist',
      full_name,
      phone: phone ?? null,
      created_by: user.id,
      created_from_ip: ip,
      created_from_device: device,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(auth.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Auto-assign the creating doctor to this receptionist
    await admin.from('receptionist_doctor_assignments').insert({
      receptionist_id: auth.user.id,
      doctor_id: user.id,
      assigned_by: user.id,
      is_active: true,
    })

    return NextResponse.json({ message: 'Assistant created', user_id: auth.user.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
