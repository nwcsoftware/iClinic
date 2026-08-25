import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'
import { getAccess } from '@/lib/doctor-auth'

// GET /api/me — who is this session?
//
// Replaces the pair of calls the app used to make after signing in:
// /api/doctor/me, and then /api/patient/init once that came back empty. Those
// ran one after the other and each re-validated the same token with Supabase
// Auth, so a patient paid for two HTTP round trips and four Supabase round
// trips to learn something one request can answer.
//
// Here the token is validated once and the two lookups that decide the answer
// run together. Both are reads, so running them concurrently is safe — the
// patient row is only ever written further down, after we know the user is not
// a doctor.
//
// /api/doctor/me and /api/patient/init are unchanged and still used elsewhere:
// profile setup posts a name and mobile number to init, which this never does.

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: prof }, { data: linked }] = await Promise.all([
      admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      admin.from('patients').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    // --- Doctor ---------------------------------------------------------
    if (prof && prof.role === 'doctor' && prof.is_active) {
      const doctor = {
        id: prof.id as string,
        full_name: prof.full_name as string,
        specialty: (prof.specialty ?? null) as string | null,
        specialty_id: (prof.specialty_id ?? null) as string | null,
        avatar_url: (prof.avatar_url ?? null) as string | null,
        is_active: prof.is_active as boolean,
      }

      // The specialty name and the access check do not depend on each other.
      const [spec, access] = await Promise.all([
        doctor.specialty_id
          ? admin.from('specialties').select('name').eq('id', doctor.specialty_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getAccess(admin, doctor.id),
      ])

      return NextResponse.json({
        kind: 'doctor',
        doctor: {
          ...doctor,
          specialty_name: (spec?.data as { name?: string } | null)?.name ?? doctor.specialty,
          rating: (prof as { rating?: number | null }).rating ?? null,
          review_count: (prof as { review_count?: number | null }).review_count ?? null,
        },
        access,
      })
    }

    // --- Patient already linked (the common case: no further work) -------
    if (linked) return NextResponse.json({ kind: 'patient', patient: linked })

    // --- Patient with an unclaimed row under the same email --------------
    if (user.email) {
      const { data: byEmail } = await admin
        .from('patients').select('*').eq('email', user.email).is('user_id', null).maybeSingle()
      if (byEmail) {
        const { data: claimed } = await admin
          .from('patients')
          .update({ user_id: user.id, is_email_verified: true, updated_at: new Date().toISOString() })
          .eq('id', byEmail.id).select().single()
        return NextResponse.json({ kind: 'patient', patient: claimed })
      }
    }

    // --- Brand new: the app collects a name and mobile number first ------
    return NextResponse.json({ kind: 'patient', patient: null, needs_profile: true })
  } catch (err) {
    console.error('me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
