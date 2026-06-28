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
      return NextResponse.json({ error: 'Only doctors can create patients' }, { status: 403 })
    }

    const body = await request.json()
    const {
      full_name, mobile_number, date_of_birth, gender, email, address, notes,
      registration_lat, registration_lng, registration_location,
    } = body

    if (!full_name || !mobile_number) {
      return NextResponse.json({ error: 'full_name and mobile_number are required' }, { status: 400 })
    }

    const { ip } = getRequestMeta(request)
    const admin = createAdminClient()

    const { data, error } = await admin.from('patients').insert({
      full_name,
      mobile_number,
      date_of_birth: date_of_birth ?? null,
      gender: gender ?? null,
      email: email ?? null,
      address: address ?? null,
      notes: notes ?? null,
      created_by: user.id,
      registration_ip: ip,
      registration_lat: registration_lat ?? null,
      registration_lng: registration_lng ?? null,
      registration_location: registration_location ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
