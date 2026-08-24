import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor } from '@/lib/doctor-auth'
import { looksLikeGoogleMapsUrl, resolveGoogleMapsLink } from '@/lib/google-maps-link'
import { insideLebanon, geocode } from '@/lib/locations'

// POST /api/doctor/locations/resolve
//
// Turns whatever the doctor gave us into a coordinate they can confirm on a map.
// Resolving is deliberately separate from saving: nothing is written until the
// doctor has seen the pin and pressed Confirm.
//
//   { mode: 'google_maps_link', url }
//   { mode: 'current_location', latitude, longitude }
//   { mode: 'address_search',   query }
//   { mode: 'map_picker',       latitude, longitude }
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    // Not subscription-gated: setting up a workplace is part of onboarding,
    // and a lapsed doctor still needs their existing details to resolve.
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const mode = body.mode

    if (mode === 'google_maps_link') {
      const url = typeof body.url === 'string' ? body.url.trim() : ''
      if (!url) return NextResponse.json({ error: 'Paste a Google Maps link' }, { status: 400 })
      if (!looksLikeGoogleMapsUrl(url)) {
        return NextResponse.json(
          { error: "That does not look like a Google Maps link. Open your clinic in Google Maps, tap Share, and copy the link." },
          { status: 400 },
        )
      }

      const parsed = await resolveGoogleMapsLink(url)
      if (parsed.latitude == null || parsed.longitude == null) {
        // Keep the URL so it can be saved alongside a hand-placed pin.
        return NextResponse.json({
          resolved: false,
          google_maps_url: parsed.resolvedUrl,
          name: parsed.name,
          reason: 'We could not read a position from that link. Place the pin on the map instead — it takes a second.',
        })
      }

      // Reverse geocode for a readable address; the coordinates stand alone
      // without it, so a failure here is not an error.
      const address = await reverseGeocode(parsed.latitude, parsed.longitude)

      return NextResponse.json({
        resolved: true,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        name: parsed.name ?? address?.name ?? null,
        formatted_address: address?.formatted ?? null,
        city: address?.city ?? null,
        governorate: address?.governorate ?? null,
        google_maps_url: parsed.resolvedUrl,
        location_source: 'google_maps_link',
        // 'approximate' means we read the map's camera centre, not the place
        // marker — worth telling the doctor so they check the pin.
        precision: parsed.precision,
        outside_lebanon: !insideLebanon(parsed.latitude, parsed.longitude),
      })
    }

    if (mode === 'current_location' || mode === 'map_picker') {
      const lat = Number(body.latitude)
      const lng = Number(body.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)
        || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return NextResponse.json({ error: 'Those coordinates are not valid' }, { status: 400 })
      }
      const address = await reverseGeocode(lat, lng)
      return NextResponse.json({
        resolved: true,
        latitude: lat,
        longitude: lng,
        name: address?.name ?? null,
        formatted_address: address?.formatted ?? null,
        city: address?.city ?? null,
        governorate: address?.governorate ?? null,
        location_source: mode,
        precision: 'exact',
        outside_lebanon: !insideLebanon(lat, lng),
      })
    }

    if (mode === 'address_search') {
      const query = typeof body.query === 'string' ? body.query.trim() : ''
      if (query.length < 3) {
        return NextResponse.json({ error: 'Type at least a few characters' }, { status: 400 })
      }
      const hit = await geocode({ address: query, city: null })
      if (!hit) {
        return NextResponse.json({
          resolved: false,
          reason: 'No match in Lebanon for that address. Try the clinic name plus the city, or place the pin yourself.',
        })
      }
      const address = await reverseGeocode(hit.latitude, hit.longitude)
      return NextResponse.json({
        resolved: true,
        latitude: hit.latitude,
        longitude: hit.longitude,
        name: address?.name ?? null,
        formatted_address: address?.formatted ?? query,
        city: address?.city ?? null,
        governorate: address?.governorate ?? null,
        location_source: 'address_search',
        precision: 'approximate',
        outside_lebanon: false,
      })
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 })
  } catch (err) {
    console.error('locations/resolve error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type ReverseHit = {
  name: string | null
  formatted: string | null
  city: string | null
  governorate: string | null
}

// Nominatim reverse lookup. Best-effort — a missing address never blocks
// saving, because the coordinates are what actually matter.
async function reverseGeocode(lat: number, lng: number): Promise<ReverseHit | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('format', 'json')
    url.searchParams.set('zoom', '18')
    url.searchParams.set('accept-language', 'en')

    const res = await fetch(url, {
      headers: { 'User-Agent': 'iClinic/1.0 (healthcare booking; Lebanon)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const body = await res.json()
    const a = body?.address ?? {}

    return {
      // A hospital or clinic at this exact point, if OSM knows of one.
      name: body?.name || a.hospital || a.clinic || a.healthcare || null,
      formatted: body?.display_name ?? null,
      city: a.city || a.town || a.village || a.suburb || a.municipality || null,
      governorate: a.state || a.region || a.county || null,
    }
  } catch {
    return null
  }
}
