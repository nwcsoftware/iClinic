import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSubscribedDoctor } from '@/lib/doctor-auth'

const RICH = 'id, full_name, mobile_number, email, date_of_birth, gender, address, allergies, chronic_conditions, blood_type, medical_notes, medical_reviewed_at'
const BASE = 'id, full_name, mobile_number, email, date_of_birth, gender, address'

// GET /api/doctor/patients/:id
//
// The full picture of one patient: contact details, what they have declared
// medically, every visit with this doctor, and what has already been
// prescribed. A doctor may only open a patient they have actually seen — the
// appointment check below is the authorization, not the UI.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const { doctor, access } = await requireSubscribedDoctor(request, admin)
    if (!doctor) {
      return access
        ? NextResponse.json({ error: 'Subscription required', subscription_required: true }, { status: 402 })
        : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization: this doctor must have at least one appointment with them.
    const { data: visits } = await admin
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status, reason, notes')
      .eq('doctor_id', doctor.id)
      .eq('patient_id', id)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(100)

    if (!visits || visits.length === 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const rich = await admin.from('patients').select(RICH).eq('id', id).maybeSingle()
    const patient = rich.error
      ? (await admin.from('patients').select(BASE).eq('id', id).maybeSingle()).data
      : rich.data
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

    // What has been prescribed to them, by any doctor in this clinic.
    const { data: rx } = await admin
      .from('prescriptions')
      .select(`
        id, created_at, appointment_id, diagnosis_note, notes, doctor_id,
        prescription_items ( id, medication_name, dosage, frequency, times_of_day,
                             duration, route, notes, sort_order, starts_on, ends_on )
      `)
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(30)

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const nowMs = today.getTime()

    return NextResponse.json({
      patient,
      medical_enabled: !rich.error,
      visits: (visits ?? []).map((v) => ({
        ...v,
        is_past: new Date(`${v.appointment_date}T${v.start_time}`).getTime() < nowMs,
      })),
      stats: {
        total_visits: visits.length,
        first_visit: visits[visits.length - 1]?.appointment_date ?? null,
        last_visit: visits[0]?.appointment_date ?? null,
      },
      prescriptions: (rx ?? []).map((r) => {
        const items = [...((r.prescription_items as RxItem[]) ?? [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        return {
          id: r.id,
          created_at: r.created_at,
          appointment_id: r.appointment_id,
          diagnosis_note: r.diagnosis_note,
          notes: r.notes,
          mine: r.doctor_id === doctor.id,
          active: items.some((i) => !i.ends_on || i.ends_on >= todayStr),
          items,
        }
      }),
    })
  } catch (err) {
    console.error('doctor/patients/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type RxItem = {
  id: string; medication_name: string; dosage: string | null; frequency: string | null
  times_of_day: string[] | null; duration: string | null; route: string | null
  notes: string | null; sort_order: number | null; starts_on: string | null; ends_on: string | null
}
