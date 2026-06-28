import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'doctor') {
      return NextResponse.json({ error: 'Only doctors can create prescriptions' }, { status: 403 })
    }

    const body = await request.json()
    const { patient_id, appointment_id, diagnosis_note, notes, valid_until, items } = body

    if (!patient_id) return NextResponse.json({ error: 'patient_id is required' }, { status: 400 })

    const admin = createAdminClient()

    const prefix = 'RX'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
    const prescription_number = `${prefix}-${date}-${suffix}`

    const { data: rx, error: rxError } = await admin.from('prescriptions').insert({
      prescription_number,
      doctor_id: user.id,
      patient_id,
      appointment_id: appointment_id ?? null,
      diagnosis_note: diagnosis_note ?? null,
      notes: notes ?? null,
      valid_until: valid_until ?? null,
      is_printed: false,
    }).select().single()

    if (rxError) return NextResponse.json({ error: rxError.message }, { status: 400 })

    if (items && items.length > 0) {
      const { error: itemsError } = await admin.from('prescription_items').insert(
        items.map((item: {
          medication_name: string
          dosage?: string
          frequency?: string
          duration?: string
          route?: string
          notes?: string
          sort_order: number
        }, idx: number) => ({
          prescription_id: rx.id,
          medication_name: item.medication_name,
          dosage: item.dosage ?? null,
          frequency: item.frequency ?? null,
          duration: item.duration ?? null,
          route: item.route ?? null,
          notes: item.notes ?? null,
          sort_order: item.sort_order ?? idx,
        }))
      )
      if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    return NextResponse.json({ prescription_id: rx.id, prescription_number: rx.prescription_number }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
