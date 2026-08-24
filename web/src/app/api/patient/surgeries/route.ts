import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// GET    /api/patient/surgeries        — my surgical history
// POST   /api/patient/surgeries        — add a procedure
// PATCH  /api/patient/surgeries        — edit one
// DELETE /api/patient/surgeries?id=    — remove one
//
// Structured entries rather than one free-text note: a doctor scanning before
// a consultation needs "appendectomy, 2019, AUBMC" as fields, not a paragraph.

const SELECT = 'id, procedure_name, surgery_date, hospital_or_clinic, surgeon_name, notes, created_at'

async function patientId(admin: ReturnType<typeof createAdminClient>, request: Request) {
  const user = await getBearerUser(request, admin)
  if (!user) return null
  const { data } = await admin.from('patients').select('id').eq('user_id', user.id).maybeSingle()
  return (data?.id as string) ?? null
}

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const pid = await patientId(admin, request)
    if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await admin
      .from('patient_surgeries')
      .select(SELECT)
      .eq('patient_id', pid)
      .order('surgery_date', { ascending: false, nullsFirst: false })

    // Migration 0009 not applied yet.
    if (error) return NextResponse.json({ surgeries: [], enabled: false })
    return NextResponse.json({ surgeries: data ?? [], enabled: true })
  } catch (err) {
    console.error('patient/surgeries GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const pid = await patientId(admin, request)
    if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const name = str(body.procedure_name, 200)
    if (!name) return NextResponse.json({ error: 'What was the procedure?' }, { status: 400 })

    const { data, error } = await admin
      .from('patient_surgeries')
      .insert({
        patient_id: pid,
        procedure_name: name,
        surgery_date: date(body.surgery_date),
        hospital_or_clinic: str(body.hospital_or_clinic, 200),
        surgeon_name: str(body.surgeon_name, 200),
        notes: str(body.notes, 1000),
      })
      .select(SELECT)
      .single()

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Surgical history is not enabled yet' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ surgery: data }, { status: 201 })
  } catch (err) {
    console.error('patient/surgeries POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = createAdminClient()
    const pid = await patientId(admin, request)
    if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('procedure_name' in body) {
      const n = str(body.procedure_name, 200)
      if (!n) return NextResponse.json({ error: 'What was the procedure?' }, { status: 400 })
      patch.procedure_name = n
    }
    if ('surgery_date' in body) patch.surgery_date = date(body.surgery_date)
    if ('hospital_or_clinic' in body) patch.hospital_or_clinic = str(body.hospital_or_clinic, 200)
    if ('surgeon_name' in body) patch.surgeon_name = str(body.surgeon_name, 200)
    if ('notes' in body) patch.notes = str(body.notes, 1000)

    // .eq('patient_id') is the authorization.
    const { data, error } = await admin
      .from('patient_surgeries')
      .update(patch)
      .eq('id', id)
      .eq('patient_id', pid)
      .select(SELECT)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ surgery: data })
  } catch (err) {
    console.error('patient/surgeries PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = createAdminClient()
    const pid = await patientId(admin, request)
    if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await admin
      .from('patient_surgeries').delete().eq('id', id).eq('patient_id', pid)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('patient/surgeries DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function date(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}
