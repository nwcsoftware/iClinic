import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor, getAccess } from '@/lib/doctor-auth'

// GET /api/doctor/me — is this session a doctor? Returns the profile if so,
// plus subscription access so the app knows whether to show the paywall.
// Deliberately NOT subscription-gated: an unpaid doctor must still get here.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ doctor: null })

    let rating: number | null = null
    let review_count: number | null = null
    // public_doctors hides unsubscribed doctors, so read the profile directly.
    const { data: prof } = await admin
      .from('profiles').select('*').eq('id', doctor.id).maybeSingle()
    if (prof) {
      rating = (prof as { rating?: number | null }).rating ?? null
      review_count = (prof as { review_count?: number | null }).review_count ?? null
    }

    let specialty_name = doctor.specialty
    if (doctor.specialty_id) {
      const { data: spec } = await admin
        .from('specialties').select('name').eq('id', doctor.specialty_id).maybeSingle()
      if (spec?.name) specialty_name = spec.name
    }

    const access = await getAccess(admin, doctor.id)

    return NextResponse.json({
      doctor: { ...doctor, specialty_name, rating, review_count },
      access,
    })
  } catch (err) {
    console.error('doctor/me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
