import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// Called right after a patient logs in on mobile.
// Ensures the auth user is linked to a `patients` row:
//   1. already linked      -> return it
//   2. existing unlinked patient with the same email -> claim/link it
//   3. otherwise           -> create one (needs full_name + mobile_number)
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { full_name, mobile_number } = body as { full_name?: string; mobile_number?: string }

    // 1. Already linked
    const { data: linked } = await admin
      .from('patients').select('*').eq('user_id', user.id).maybeSingle()
    if (linked) return NextResponse.json({ patient: linked })

    // 2. Claim an existing patient by email
    if (user.email) {
      const { data: byEmail } = await admin
        .from('patients').select('*').eq('email', user.email).is('user_id', null).maybeSingle()
      if (byEmail) {
        const { data: claimed } = await admin
          .from('patients')
          .update({ user_id: user.id, is_email_verified: true, updated_at: new Date().toISOString() })
          .eq('id', byEmail.id).select().single()
        return NextResponse.json({ patient: claimed })
      }
    }

    // 3. Create a new patient — requires name + mobile
    if (!full_name || !mobile_number) {
      return NextResponse.json({ patient: null, needs_profile: true })
    }

    const { data: created, error } = await admin
      .from('patients')
      .insert({
        full_name,
        mobile_number,
        email: user.email ?? null,
        user_id: user.id,
        is_email_verified: !!user.email,
      })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ patient: created })
  } catch (err) {
    console.error('patient/init error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
