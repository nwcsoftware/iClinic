import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSecretary, listDoctors, listGrantedLocations } from '@/lib/secretary-auth'

// GET /api/secretary/me
//
// Who am I, and whose practice may I work on? Returns only the doctors that
// have an active link to this secretary, so a secretary who was removed sees
// the doctor disappear on their next load rather than keeping a stale menu.
//
// ?doctor_id= also returns that doctor's granted locations, which saves the
// dashboard a second request on first paint.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const secretary = await requireSecretary(request, admin)
    if (!secretary) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const doctors = await listDoctors(admin, secretary.id)

    const asked = new URL(request.url).searchParams.get('doctor_id')
    // A doctor id that is not on the list is not an error to explain, it is
    // simply not one of theirs, so it falls back to the first.
    const active = doctors.find((d) => d.doctor_id === asked) ?? doctors[0] ?? null

    return NextResponse.json({
      secretary: { id: secretary.id, full_name: secretary.full_name, phone: secretary.phone },
      doctors,
      active_doctor_id: active?.doctor_id ?? null,
      locations: active ? await listGrantedLocations(admin, secretary.id, active.doctor_id) : [],
    })
  } catch (err) {
    console.error('secretary/me error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
