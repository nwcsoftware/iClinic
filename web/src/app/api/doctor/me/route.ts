import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor } from '@/lib/doctor-auth'

// GET /api/doctor/me — is this session a doctor? Returns the profile if so.
// The mobile app calls this after login to decide patient vs doctor mode.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ doctor: null })

    let rating: number | null = null
    let review_count: number | null = null
    const { data: pub } = await admin
      .from('public_doctors').select('*').eq('id', doctor.id).maybeSingle()
    if (pub) {
      rating = (pub as { rating?: number | null }).rating ?? null
      review_count = (pub as { review_count?: number | null }).review_count ?? null
    }
    const specialty_name = (pub as { specialty_name?: string | null } | null)?.specialty_name ?? doctor.specialty

    return NextResponse.json({ doctor: { ...doctor, specialty_name, rating, review_count } })
  } catch (err) {
    console.error('doctor/me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
