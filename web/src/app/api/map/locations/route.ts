import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/map/locations — public. Everything the Lebanon healthcare map draws.
//
// Optional filters:
//   ?type=hospital|clinic|private_clinic|medical_center
//   ?specialty=<slug>   only places with a doctor of that speciality
//   ?q=<text>           name, city, doctor name or speciality
//
// Returns locations WITH their doctors attached, because the map's bottom sheet
// needs both the moment a marker is tapped — a second round trip there would be
// visible as a stall in the animation.
//
// Only doctors visible in public_doctors are included, so an unsubscribed or
// deactivated doctor disappears from the map exactly as they do everywhere else.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const specialty = searchParams.get('specialty')
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()

    let query = admin
      .from('healthcare_locations')
      .select('id, name, type, address, city, governorate, latitude, longitude, phone, is_verified')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(500)

    if (type) query = query.eq('type', type)

    const { data: locations, error } = await query
    // Migration 0009 not applied yet.
    if (error) return NextResponse.json({ locations: [], enabled: false })

    const rows = locations ?? []
    if (rows.length === 0) return NextResponse.json({ locations: [], enabled: true })

    // Who works where. One query rather than one per location.
    const { data: links } = await admin
      .from('doctor_locations')
      .select('doctor_id, location_id, working_days, is_primary')
      .in('location_id', rows.map((l) => l.id as string))

    const doctorIds = [...new Set((links ?? []).map((l) => l.doctor_id as string))]

    // public_doctors already encodes "active and subscribed", so filtering
    // through it is what keeps lapsed doctors off the map.
    const visible = new Map<string, PublicDoctor>()
    if (doctorIds.length > 0) {
      const { data: docs } = await admin
        .from('public_doctors')
        .select('id, full_name, display_name, specialty, specialty_slug, specialty_name, avatar_url, rating, review_count')
        .in('id', doctorIds)
      for (const d of docs ?? []) visible.set(d.id as string, d as PublicDoctor)
    }

    const byLocation = new Map<string, LocationDoctor[]>()
    for (const link of links ?? []) {
      const doc = visible.get(link.doctor_id as string)
      if (!doc) continue
      const list = byLocation.get(link.location_id as string) ?? []
      list.push({
        id: doc.id,
        full_name: doc.display_name ?? doc.full_name,
        specialty: doc.specialty_name ?? doc.specialty ?? null,
        specialty_slug: doc.specialty_slug ?? null,
        avatar_url: doc.avatar_url ?? null,
        rating: doc.rating ?? null,
        review_count: doc.review_count ?? null,
        working_days: (link.working_days as number[]) ?? [],
        is_primary: link.is_primary === true,
      })
      byLocation.set(link.location_id as string, list)
    }

    let result = rows.map((l) => ({
      ...l,
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
      doctors: byLocation.get(l.id as string) ?? [],
      doctor_count: (byLocation.get(l.id as string) ?? []).length,
    }))

    if (specialty) {
      result = result.filter((l) => l.doctors.some((d) => d.specialty_slug === specialty))
    }

    // Text search spans the place and the doctors inside it, so "cardiology"
    // returns the hospitals that have a cardiologist.
    if (q) {
      result = result.filter((l) =>
        `${l.name} ${l.city ?? ''} ${l.governorate ?? ''} ${l.address ?? ''}`.toLowerCase().includes(q)
        || l.doctors.some((d) => `${d.full_name} ${d.specialty ?? ''}`.toLowerCase().includes(q)),
      )
    }

    return NextResponse.json({ locations: result, enabled: true })
  } catch (err) {
    console.error('map/locations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type PublicDoctor = {
  id: string; full_name: string; display_name: string | null
  specialty: string | null; specialty_slug: string | null; specialty_name: string | null
  avatar_url: string | null; rating: number | null; review_count: number | null
}

type LocationDoctor = {
  id: string; full_name: string; specialty: string | null; specialty_slug: string | null
  avatar_url: string | null; rating: number | null; review_count: number | null
  working_days: number[]; is_primary: boolean
}
