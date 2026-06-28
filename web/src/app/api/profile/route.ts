import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient()

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.full_name) update.full_name = body.full_name
    if (body.specialty !== undefined) update.specialty = body.specialty || null
    if (body.phone !== undefined) update.phone = body.phone || null

    const { data, error } = await admin
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
