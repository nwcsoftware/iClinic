import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAvailableSlots } from '@/lib/slots'

// GET /api/patient/slots?doctor_id=...&date=YYYY-MM-DD
// Returns the bookable start times for a doctor on a date.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctor_id')
    const date = searchParams.get('date')
    if (!doctorId || !date) {
      return NextResponse.json({ error: 'doctor_id and date are required' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const admin = createAdminClient()
    const slots = await computeAvailableSlots(admin, doctorId, date)
    return NextResponse.json({ slots })
  } catch (err) {
    console.error('slots error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
