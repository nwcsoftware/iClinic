import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor } from '@/lib/doctor-auth'
import { PLANS, getPlan } from '@/lib/billing'

// POST /api/doctor/payment-claim   (Bearer auth, NOT subscription-gated)
// Body: { plan: 'm1'|'m3'|'m12', method: 'whish'|'omt'|'bank_transfer'|'cash', reference?, note? }
//
// With Whish and OMT the money arrives outside the app, so the doctor has to
// tell us. This records the claim as a PENDING payment against their account —
// it grants nothing on its own. An admin approves it, which is what actually
// extends the subscription.
//
// Before this existed the only channel was a WhatsApp message that had to be
// matched to an account by hand.

const METHODS = new Set(['whish', 'omt', 'bank_transfer', 'cash', 'other'])

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    // Deliberately not requireSubscribedDoctor: a lapsed doctor is exactly who
    // needs to report a payment.
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))

    const plan = getPlan(body.plan ?? 'm1')
    if (!plan) {
      return NextResponse.json({ error: `plan must be one of: ${Object.keys(PLANS).join(', ')}` }, { status: 400 })
    }

    const method = typeof body.method === 'string' && METHODS.has(body.method) ? body.method : null
    if (!method) {
      return NextResponse.json({ error: `method must be one of: ${[...METHODS].join(', ')}` }, { status: 400 })
    }

    const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0, 120) : ''
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

    // A doctor re-sending the same receipt must not create a second claim.
    const eventId = reference
      ? `claim:${doctor.id}:${method}:${reference.toLowerCase()}`
      : `claim:${doctor.id}:${method}:${Date.now()}`

    const { data: claim, error } = await admin
      .from('subscription_payments')
      .insert({
        doctor_id: doctor.id,
        amount_usd: plan.amount_usd,
        currency: 'USD',
        method,
        status: 'pending',
        months: plan.months,
        reference: reference || null,
        description: `Reported by doctor — ${plan.label}`,
        failure_reason: note,
        // 'claim' keeps these out of the Areeba reconcile job, which only ever
        // re-reads its own pending rows.
        provider: 'claim',
        provider_event_id: eventId,
      })
      .select('id, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, claim }, { status: 201 })
  } catch (err) {
    console.error('doctor/payment-claim error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
