import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin billing control — how you activate a doctor who paid by Whish, OMT,
// bank transfer or cash.
//
//   GET  /api/admin/subscription                 -> every doctor + their status
//   POST /api/admin/subscription                 -> record a payment and extend
//        { email | doctor_id, months?, amount_usd?, method?, reference?, note? }
//
// Authenticated with the ADMIN_API_KEY env var, sent as:
//        Authorization: Bearer <ADMIN_API_KEY>

function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY
  if (!expected || expected.length < 16) return false // refuse weak/unset keys
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const { data: doctors } = await admin
      .from('profiles')
      .select('id, full_name, specialty, is_active')
      .eq('role', 'doctor')
      .order('full_name')

    const { data: subs } = await admin
      .from('doctor_subscriptions')
      .select('doctor_id, status, plan, price_usd, current_period_end, trial_end, provider')

    const byDoctor = new Map((subs ?? []).map((s) => [s.doctor_id, s]))
    const now = Date.now()

    const rows = (doctors ?? []).map((d) => {
      const s = byDoctor.get(d.id)
      const end = s ? new Date(s.current_period_end).getTime() : 0
      return {
        doctor_id: d.id,
        full_name: d.full_name,
        specialty: d.specialty,
        is_active: d.is_active,
        status: s?.status ?? 'none',
        provider: s?.provider ?? null,
        current_period_end: s?.current_period_end ?? null,
        days_left: s ? Math.max(0, Math.ceil((end - now) / 86_400_000)) : 0,
        visible_to_patients:
          !!s && ['trialing', 'active', 'past_due'].includes(s.status) && end > now && d.is_active,
      }
    })

    // Payments doctors have reported but nobody has approved yet. This is the
    // queue you work through after money lands in Whish or OMT.
    const { data: claims } = await admin
      .from('subscription_payments')
      .select('id, doctor_id, amount_usd, method, reference, months, description, failure_reason, created_at')
      .eq('provider', 'claim')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)

    const nameById = new Map(rows.map((r) => [r.doctor_id, r.full_name]))

    return NextResponse.json({
      doctors: rows,
      claims: (claims ?? []).map((c) => ({
        ...c,
        doctor_name: nameById.get(c.doctor_id as string) ?? 'Unknown doctor',
        // failure_reason doubles as the doctor's free-text note on a claim.
        note: c.failure_reason,
      })),
      summary: {
        total: rows.length,
        visible: rows.filter((r) => r.visible_to_patients).length,
        expiring_7d: rows.filter((r) => r.visible_to_patients && r.days_left <= 7).length,
        lapsed: rows.filter((r) => !r.visible_to_patients).length,
        pending_claims: (claims ?? []).length,
      },
    })
  } catch (err) {
    console.error('admin/subscription GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const admin = createAdminClient()
    const body = await request.json().catch(() => ({}))

    // Approving a doctor-reported payment: take the doctor, months, amount,
    // method and reference straight off the claim so nothing is retyped.
    let claimId: string | null = null
    if (typeof body.claim_id === 'string' && body.claim_id) {
      const { data: claim } = await admin
        .from('subscription_payments')
        .select('id, doctor_id, amount_usd, method, reference, months, status, provider')
        .eq('id', body.claim_id)
        .maybeSingle()

      if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      if (claim.provider !== 'claim') {
        return NextResponse.json({ error: 'Not a doctor-reported payment' }, { status: 400 })
      }
      if (claim.status !== 'pending') {
        return NextResponse.json({ ok: true, already_handled: true, status: claim.status })
      }

      // Reject: mark it failed and change nothing about their access.
      if (body.reject === true) {
        await admin
          .from('subscription_payments')
          .update({ status: 'failed', failure_reason: typeof body.note === 'string' ? body.note : 'Rejected by admin' })
          .eq('id', claim.id)
          .eq('status', 'pending')
        return NextResponse.json({ ok: true, rejected: true })
      }

      claimId = claim.id as string
      body.doctor_id = claim.doctor_id
      body.months = body.months ?? claim.months ?? 1
      body.amount_usd = body.amount_usd ?? claim.amount_usd
      body.method = body.method ?? claim.method
      body.reference = body.reference ?? claim.reference
    }

    // Resolve the doctor by id or by login email.
    let doctorId: string | null = typeof body.doctor_id === 'string' ? body.doctor_id : null
    if (!doctorId && typeof body.email === 'string') {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const user = list?.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase())
      if (user) doctorId = user.id
    }
    if (!doctorId) return NextResponse.json({ error: 'doctor_id or email required' }, { status: 400 })

    const { data: profile } = await admin
      .from('profiles').select('id, role').eq('id', doctorId).maybeSingle()
    if (!profile || profile.role !== 'doctor') {
      return NextResponse.json({ error: 'Not a doctor account' }, { status: 400 })
    }

    const months = Number.isFinite(Number(body.months)) ? Math.max(1, Math.min(24, Number(body.months))) : 1
    const amount = Number.isFinite(Number(body.amount_usd)) ? Number(body.amount_usd) : 9.99 * months
    const method = typeof body.method === 'string' ? body.method : 'manual'
    const reference = typeof body.reference === 'string' ? body.reference : null

    // Renew from the later of now / current end, so paying early never loses days.
    const { data: existing } = await admin
      .from('doctor_subscriptions')
      .select('current_period_end')
      .eq('doctor_id', doctorId)
      .maybeSingle()

    const base = existing && new Date(existing.current_period_end) > new Date()
      ? new Date(existing.current_period_end)
      : new Date()
    const periodEnd = new Date(base)
    periodEnd.setMonth(periodEnd.getMonth() + months)

    const { error: upErr } = await admin
      .from('doctor_subscriptions')
      .upsert({
        doctor_id: doctorId,
        status: 'active',
        plan: months >= 12 ? 'yearly' : 'monthly',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        provider: 'manual',
        notes: typeof body.note === 'string' ? body.note : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'doctor_id' })
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    // Same receipt twice is a no-op thanks to the unique provider_event_id.
    const { error: payErr } = await admin.from('subscription_payments').insert({
      doctor_id: doctorId,
      amount_usd: amount,
      method,
      reference,
      period_start: base.toISOString(),
      period_end: periodEnd.toISOString(),
      provider: 'manual',
      provider_event_id: reference ? `manual:${doctorId}:${reference}` : null,
    })
    if (payErr && payErr.code !== '23505') {
      return NextResponse.json({ error: payErr.message }, { status: 400 })
    }

    // Close the claim last, so a failure above leaves it in the queue rather
    // than silently marking it paid.
    if (claimId) {
      await admin
        .from('subscription_payments')
        .update({ status: 'paid', period_start: base.toISOString(), period_end: periodEnd.toISOString() })
        .eq('id', claimId)
        .eq('status', 'pending')
    }

    return NextResponse.json({
      ok: true,
      doctor_id: doctorId,
      claim_approved: claimId ?? undefined,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      months_added: months,
      duplicate_payment_ignored: payErr?.code === '23505',
    })
  } catch (err) {
    console.error('admin/subscription POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
