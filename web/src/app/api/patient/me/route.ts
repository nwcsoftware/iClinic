import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// GET   /api/patient/me  -> the patient's own record, including medical profile
// PATCH /api/patient/me  -> update contact details and/or medical profile
// Served via the service role so it does not depend on client-side RLS.

const FIELDS =
  'id, full_name, mobile_number, email, date_of_birth, gender, allergies, chronic_conditions, blood_type, medical_notes, medical_reviewed_at'

// Columns added by migration 0008. Selected separately so the app keeps
// working before that migration is applied.
const BASE_FIELDS = 'id, full_name, mobile_number, email, date_of_birth, gender'

const BLOOD_TYPES = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])

// Free-text lists a patient types themselves: trim, drop blanks, de-duplicate
// case-insensitively, and cap both the entry length and the list size so a
// runaway client cannot write unbounded data.
function cleanList(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const value = raw.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= 30) break
  }
  return out
}

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rich = await admin
      .from('patients').select(FIELDS).eq('user_id', user.id).maybeSingle()

    if (!rich.error) return NextResponse.json({ patient: rich.data ?? null, medical_enabled: true })

    const base = await admin
      .from('patients').select(BASE_FIELDS).eq('user_id', user.id).maybeSingle()
    return NextResponse.json({ patient: base.data ?? null, medical_enabled: false })
  } catch (err) {
    console.error('patient/me GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim()
    }
    if (typeof body.mobile_number === 'string' && body.mobile_number.trim()) {
      updates.mobile_number = body.mobile_number.trim()
    }

    const allergies = cleanList(body.allergies)
    if (allergies) updates.allergies = allergies

    const conditions = cleanList(body.chronic_conditions)
    if (conditions) updates.chronic_conditions = conditions

    if (body.blood_type === null || body.blood_type === '') {
      updates.blood_type = null
    } else if (typeof body.blood_type === 'string') {
      const bt = body.blood_type.trim().toUpperCase()
      if (!BLOOD_TYPES.has(bt)) {
        return NextResponse.json({ error: 'Invalid blood type' }, { status: 400 })
      }
      updates.blood_type = bt
    }

    if (typeof body.medical_notes === 'string') {
      updates.medical_notes = body.medical_notes.trim().slice(0, 2000) || null
    }

    // The patient has looked at this section — used to stop prompting them.
    if (body.mark_reviewed === true) updates.medical_reviewed_at = new Date().toISOString()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data: patient, error } = await admin
      .from('patients')
      .update(updates)
      .eq('user_id', user.id)
      .select(FIELDS)
      .maybeSingle()

    if (error) {
      // Migration 0008 not applied yet: retry with just the contact fields so
      // editing a name or phone number still works.
      const contactOnly: Record<string, unknown> = {}
      if (updates.full_name) contactOnly.full_name = updates.full_name
      if (updates.mobile_number) contactOnly.mobile_number = updates.mobile_number
      if (Object.keys(contactOnly).length === 0) {
        return NextResponse.json({ error: 'Medical profile is not enabled yet' }, { status: 503 })
      }
      contactOnly.updated_at = updates.updated_at
      const retry = await admin
        .from('patients').update(contactOnly).eq('user_id', user.id)
        .select(BASE_FIELDS).maybeSingle()
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 400 })
      return NextResponse.json({ patient: retry.data, medical_enabled: false })
    }

    if (!patient) return NextResponse.json({ error: 'No patient profile' }, { status: 404 })
    return NextResponse.json({ patient, medical_enabled: true })
  } catch (err) {
    console.error('patient/me PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
