import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient()

    const update: Record<string, unknown> = {
      payment_status: body.payment_status,
      updated_at: new Date().toISOString(),
    }
    if (body.paid_at) update.paid_at = body.paid_at
    if (body.discount_amount !== undefined) {
      update.discount_amount = body.discount_amount
      update.discount_reason = body.discount_reason ?? null
    }

    const { data, error } = await admin
      .from('appointment_pricing')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
