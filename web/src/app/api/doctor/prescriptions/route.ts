import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

// POST /api/doctor/prescriptions
// Body: {
//   appointment_id,
//   diagnosis_note?, notes?, valid_until?,
//   items: [{ medication_name, dosage?, frequency?, times_of_day?[],
//             duration?, duration_days?, route?, notes? }]
// }
//
// Writing a prescription re-uses the existing prescriptions /
// prescription_items tables the staff portal already reads, so a prescription
// written on the phone is the same record the clinic prints.
//
// Re-submitting for the same appointment REPLACES that prescription rather
// than adding a second one — a doctor correcting a dose should not leave the
// patient looking at two conflicting lists.

const ROUTES = new Set(['oral', 'topical', 'injection', 'inhaled', 'drops', 'other'])
const MAX_ITEMS = 20

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const appointmentId = typeof body.appointment_id === 'string' ? body.appointment_id : ''
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointment_id is required' }, { status: 400 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'At least one medication is required' }, { status: 400 })
    }
    if (rawItems.length > MAX_ITEMS) {
      return NextResponse.json({ error: `At most ${MAX_ITEMS} medications` }, { status: 400 })
    }

    // The visit must be this doctor's — that is the authorization.
    const { data: appt } = await admin
      .from('appointments')
      .select('id, patient_id, doctor_id, appointment_date')
      .eq('id', appointmentId)
      .eq('doctor_id', doctor.id)
      .maybeSingle()
    if (!appt) return NextResponse.json({ error: 'Visit not found' }, { status: 404 })

    const startsOn = new Date().toISOString().slice(0, 10)

    type NewItem = {
      medication_name: string; dosage: string | null; frequency: string | null
      times_of_day: string[]; duration: string | null; route: string | null
      notes: string | null; sort_order: number; starts_on: string; ends_on: string | null
    }

    const items: NewItem[] = rawItems.map((raw: Record<string, unknown>, i: number) => {
      const name = typeof raw.medication_name === 'string' ? raw.medication_name.trim().slice(0, 200) : ''
      if (!name) throw new BadRequest(`Medication ${i + 1} needs a name`)

      const days = Number(raw.duration_days)
      const hasDays = Number.isFinite(days) && days > 0 && days <= 365
      let endsOn: string | null = null
      if (hasDays) {
        const d = new Date()
        d.setDate(d.getDate() + Math.round(days) - 1)
        endsOn = d.toISOString().slice(0, 10)
      }

      const route = typeof raw.route === 'string' && ROUTES.has(raw.route) ? raw.route : null

      return {
        medication_name: name,
        dosage: str(raw.dosage, 120),
        frequency: str(raw.frequency, 120),
        times_of_day: cleanTimes(raw.times_of_day),
        duration: str(raw.duration, 120) ?? (hasDays ? `${Math.round(days)} days` : null),
        route,
        notes: str(raw.notes, 500),
        sort_order: i,
        starts_on: startsOn,
        ends_on: endsOn,
      }
    })

    // Replace any prescription this doctor already wrote for this visit.
    const { data: existing } = await admin
      .from('prescriptions')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('doctor_id', doctor.id)
      .maybeSingle()

    if (existing) {
      await admin.from('prescription_items').delete().eq('prescription_id', existing.id)
      await admin.from('prescriptions').delete().eq('id', existing.id)
    }

    const { data: rx, error: rxErr } = await admin
      .from('prescriptions')
      .insert({
        prescription_number: `RX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        appointment_id: appointmentId,
        doctor_id: doctor.id,
        patient_id: appt.patient_id,
        diagnosis_note: str(body.diagnosis_note, 1000),
        notes: str(body.notes, 1000),
        valid_until: typeof body.valid_until === 'string' && body.valid_until ? body.valid_until : null,
      })
      .select('id, prescription_number, created_at')
      .single()

    if (rxErr) {
      if (rxErr.code === '42703' || rxErr.code === 'PGRST204') {
        return NextResponse.json({ error: 'Prescriptions are not enabled yet' }, { status: 503 })
      }
      return NextResponse.json({ error: rxErr.message }, { status: 400 })
    }

    const { error: itemErr } = await admin
      .from('prescription_items')
      .insert(items.map((it) => ({ ...it, prescription_id: rx.id })))

    if (itemErr) {
      // Never leave a prescription with no medicines on it.
      await admin.from('prescriptions').delete().eq('id', rx.id)
      return NextResponse.json({ error: itemErr.message }, { status: 400 })
    }

    return NextResponse.json({ prescription: { ...rx, items } }, { status: 201 })
  } catch (err) {
    if (err instanceof BadRequest) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('doctor/prescriptions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

class BadRequest extends Error {}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

// "08:00", "after lunch" — both are legitimate instructions.
function cleanTimes(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const raw of v) {
    if (typeof raw !== 'string') continue
    const t = raw.trim().slice(0, 40)
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 8) break
  }
  return out
}
