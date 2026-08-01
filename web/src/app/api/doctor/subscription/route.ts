import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor, getAccess } from '@/lib/doctor-auth'

// GET /api/doctor/subscription — the doctor's own billing status, their recent
// payments, and how to pay. Not gated: this is the page they land on when
// their subscription lapses.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const access = await getAccess(admin, doctor.id)

    const { data: payments } = await admin
      .from('subscription_payments')
      .select('amount_usd, currency, method, reference, period_end, created_at')
      .eq('doctor_id', doctor.id)
      .order('created_at', { ascending: false })
      .limit(12)

    // Local payment details live in env so they can change without a deploy.
    const instructions = {
      whish: process.env.PAY_WHISH_NUMBER ?? null,
      omt: process.env.PAY_OMT_NAME ?? null,
      bank: process.env.PAY_BANK_DETAILS ?? null,
      contact: process.env.PAY_CONTACT ?? null,
      note: process.env.PAY_NOTE
        ?? 'After paying, send us the receipt and your account will be activated within 24 hours.',
    }

    // Present only when a hosted card checkout is configured.
    const checkout_url = process.env.BILLING_CHECKOUT_URL ?? null

    return NextResponse.json({
      access,
      payments: payments ?? [],
      instructions,
      checkout_url,
    })
  } catch (err) {
    console.error('doctor/subscription error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
