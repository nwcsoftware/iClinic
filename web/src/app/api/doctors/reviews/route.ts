import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/doctors/reviews?doctor_id=...  — public.
// The reviews patients left for a doctor, plus the star breakdown.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctor_id')
    if (!doctorId) return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('doctor_reviews')
      .select('id, rating, comment, created_at, patients(full_name)')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false })
      .limit(50)

    // Reviews not enabled yet (migration 0005 not applied) — say so quietly.
    if (error) return NextResponse.json({ reviews: [], average: null, count: 0, breakdown: {} })

    // Supabase types an embedded relation as an array; it is one row here.
    type Row = {
      id: string; rating: number; comment: string | null; created_at: string
      patients?: { full_name: string } | { full_name: string }[] | null
    }
    const rows = (data ?? []) as unknown as Row[]

    // Show a first name only — reviews are public, full names are not needed.
    const reviews = rows.map((r) => {
      const p = Array.isArray(r.patients) ? r.patients[0] : r.patients
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        author: (p?.full_name ?? 'Patient').trim().split(/\s+/)[0],
      }
    })

    const count = reviews.length
    const average = count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : null

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of reviews) breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1

    return NextResponse.json({ reviews, average, count, breakdown })
  } catch (err) {
    console.error('doctors/reviews error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
