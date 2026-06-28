import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestMeta } from '@/lib/request-meta'

export async function POST(request: Request) {
  try {
    const { email, password, full_name, specialty, phone } = await request.json()

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'email, password, and full_name are required' }, { status: 400 })
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
      role: 'doctor',
      full_name,
      specialty: specialty ?? null,
      phone: phone ?? null,
      created_from_ip: ip,
      created_from_device: device,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(auth.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Doctor registered', user_id: auth.user.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
