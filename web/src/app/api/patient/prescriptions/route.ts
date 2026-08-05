import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// GET /api/patient/prescriptions   (Bearer auth)
// Everything a doctor has prescribed to this patient, newest first, with each
// medicine's instructions. Split into active vs finished by ends_on so the
// patient sees what they should be taking right now.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: patient } = await admin
      .from('patients').select('id').eq('user_id', user.id).maybeSingle()
    if (!patient) return NextResponse.json({ prescriptions: [] })

    const { data, error } = await admin
      .from('prescriptions')
      .select(`
        id, prescription_number, diagnosis_note, notes, valid_until, created_at,
        appointment_id, doctor_id,
        prescription_items (
          id, medication_name, dosage, frequency, times_of_day, duration,
          route, notes, sort_order, starts_on, ends_on
        )
      `)
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Prescriptions not enabled yet (migration 0008) — degrade quietly.
    if (error) return NextResponse.json({ prescriptions: [], enabled: false })

    const rows = (data ?? []) as unknown as RxRow[]

    // Doctor names in one query rather than per prescription.
    const doctorIds = [...new Set(rows.map((r) => r.doctor_id).filter(Boolean))]
    const names = new Map<string, string>()
    if (doctorIds.length > 0) {
      const { data: docs } = await admin
        .from('profiles').select('id, full_name').in('id', doctorIds)
      for (const d of docs ?? []) names.set(d.id as string, d.full_name as string)
    }

    const today = new Date().toISOString().slice(0, 10)

    const prescriptions = rows.map((r) => {
      const items = [...(r.prescription_items ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      // Active while any medicine on it is still running. A medicine with no
      // end date is treated as ongoing until the doctor says otherwise.
      const active = items.some((i) => !i.ends_on || i.ends_on >= today)
      return {
        id: r.id,
        prescription_number: r.prescription_number,
        diagnosis_note: r.diagnosis_note,
        notes: r.notes,
        created_at: r.created_at,
        valid_until: r.valid_until,
        doctor_name: names.get(r.doctor_id) ?? 'Your doctor',
        active,
        items,
      }
    })

    return NextResponse.json({ prescriptions, enabled: true })
  } catch (err) {
    console.error('patient/prescriptions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type RxItem = {
  id: string; medication_name: string; dosage: string | null; frequency: string | null
  times_of_day: string[] | null; duration: string | null; route: string | null
  notes: string | null; sort_order: number | null; starts_on: string | null; ends_on: string | null
}
type RxRow = {
  id: string; prescription_number: string | null; diagnosis_note: string | null
  notes: string | null; valid_until: string | null; created_at: string
  appointment_id: string | null; doctor_id: string
  prescription_items: RxItem[] | null
}
