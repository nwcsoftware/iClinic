import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerDoctor, getAccess } from '@/lib/doctor-auth'
import { getBillingProvider, PLANS, getPlan } from '@/lib/billing'
import { areebaConfigured, areebaIsTestMerchant } from '@/lib/areeba'
import { startCardCheckout } from '@/lib/billing-checkout'

// Columns added by migration 0006. Selected separately so the page keeps
// working before that migration is applied.
const RICH_SUB = 'card_brand, card_last4, card_exp_month, card_exp_year, billing_email, last_payment_at, last_payment_status'
const BASE_SUB = 'status, plan, price_usd, provider, current_period_start, current_period_end, trial_end, cancel_at_period_end, provider_customer_id'

const RICH_PAY = 'status, description, invoice_url, receipt_url, card_brand, card_last4, failure_reason'
const BASE_PAY = 'id, amount_usd, currency, method, reference, period_start, period_end, created_at'

type SubRow = Record<string, unknown>

// GET /api/doctor/billing — everything the billing page renders: the plan, the
// saved card, the next charge and the full payment history.
// Not gated by subscription: a lapsed doctor must still be able to pay.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const access = await getAccess(admin, doctor.id)
    const provider = getBillingProvider()

    // Try the full row; fall back to the 0004 columns if 0006 has not been run.
    let details_enabled = true
    let sub: SubRow | null = null

    const rich = await admin
      .from('doctor_subscriptions')
      .select(`${BASE_SUB}, ${RICH_SUB}`)
      .eq('doctor_id', doctor.id)
      .maybeSingle()

    if (rich.error) {
      details_enabled = false
      const base = await admin
        .from('doctor_subscriptions')
        .select(BASE_SUB)
        .eq('doctor_id', doctor.id)
        .maybeSingle()
      sub = (base.data as SubRow) ?? null
    } else {
      sub = (rich.data as SubRow) ?? null
    }

    const richPayments = await admin
      .from('subscription_payments')
      .select(`${BASE_PAY}, ${RICH_PAY}`)
      .eq('doctor_id', doctor.id)
      .order('created_at', { ascending: false })
      .limit(24)

    const payments = richPayments.error
      ? (await admin
          .from('subscription_payments')
          .select(BASE_PAY)
          .eq('doctor_id', doctor.id)
          .order('created_at', { ascending: false })
          .limit(24)).data ?? []
      : richPayments.data ?? []

    const card = sub?.card_last4
      ? {
          brand: (sub.card_brand as string) ?? null,
          last4: sub.card_last4 as string,
          exp_month: (sub.card_exp_month as number) ?? null,
          exp_year: (sub.card_exp_year as number) ?? null,
        }
      : null

    // Only promise a charge we are actually going to make.
    const willRenew = Boolean(sub)
      && (sub!.status === 'active' || sub!.status === 'trialing')
      && sub!.cancel_at_period_end !== true
    const next_charge = willRenew
      ? { amount_usd: Number(sub!.price_usd ?? access.price_usd), date: sub!.current_period_end as string }
      : null

    return NextResponse.json({
      access,
      subscription: sub
        ? {
            status: sub.status,
            plan: sub.plan,
            price_usd: Number(sub.price_usd ?? access.price_usd),
            provider: sub.provider,
            current_period_start: sub.current_period_start ?? null,
            current_period_end: sub.current_period_end ?? null,
            trial_end: sub.trial_end ?? null,
            cancel_at_period_end: sub.cancel_at_period_end === true,
            billing_email: (sub.billing_email as string) ?? null,
            last_payment_at: (sub.last_payment_at as string) ?? null,
            last_payment_status: (sub.last_payment_status as string) ?? null,
          }
        : null,
      card,
      next_charge,
      payments,
      capabilities: {
        ...provider.capabilities(),
        // Areeba is its own rail: cards via MPGS, verified server-side.
        can_pay_by_card: areebaConfigured() || provider.capabilities().can_pay_by_card,
        card_provider: areebaConfigured() ? 'areeba' : null,
        test_mode: areebaConfigured() ? areebaIsTestMerchant() : false,
      },
      plans: Object.values(PLANS),
      instructions: {
        whish: process.env.PAY_WHISH_NUMBER ?? null,
        omt: process.env.PAY_OMT_NAME ?? null,
        bank: process.env.PAY_BANK_DETAILS ?? null,
        contact: process.env.PAY_CONTACT ?? null,
        note: process.env.PAY_NOTE
          ?? 'After paying, send us the receipt and your account will be activated within 24 hours.',
      },
      // False until migration 0006 is applied — the page hides the card block.
      details_enabled,
    })
  } catch (err) {
    console.error('doctor/billing error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const ACTIONS = ['checkout', 'portal', 'cancel', 'resume'] as const
type Action = (typeof ACTIONS)[number]

// POST /api/doctor/billing   { action }
//
// checkout / portal  → a URL to send the doctor to (null when unconfigured)
// cancel / resume    → toggles auto-renew. Cancelling never cuts access short:
//                      the subscription simply stops renewing, and access ends
//                      naturally when current_period_end passes.
export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    const doctor = await getBearerDoctor(request, admin)
    if (!doctor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const action = body.action as Action
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 })
    }

    const provider = getBillingProvider()

    if (action === 'checkout') {
      // Areeba takes priority when configured: it is the real card rail.
      if (areebaConfigured()) {
        // The plan key is the only thing the client chooses. The price comes
        // from the server table, so a tampered request cannot buy a year for $1.
        const plan = getPlan(body.plan ?? 'm1')
        if (!plan) {
          return NextResponse.json(
            { error: `plan must be one of: ${Object.keys(PLANS).join(', ')}` }, { status: 400 },
          )
        }
        const origin = process.env.PUBLIC_WEB_URL ?? new URL(request.url).origin
        const { payUrl, orderId } = await startCardCheckout(admin, doctor.id, plan, origin)
        return NextResponse.json({ url: payUrl, order_id: orderId })
      }

      const { data: sub } = await admin
        .from('doctor_subscriptions')
        .select('billing_email')
        .eq('doctor_id', doctor.id)
        .maybeSingle()

      const url = await provider.createCheckoutUrl({
        doctorId: doctor.id,
        email: (sub?.billing_email as string) ?? null,
      })
      return NextResponse.json({ url })
    }

    if (action === 'portal') {
      const { data: sub } = await admin
        .from('doctor_subscriptions')
        .select('provider_customer_id')
        .eq('doctor_id', doctor.id)
        .maybeSingle()

      const url = await provider.createPortalUrl({
        doctorId: doctor.id,
        customerId: (sub?.provider_customer_id as string) ?? null,
      })
      return NextResponse.json({ url })
    }

    const { data, error } = await admin
      .from('doctor_subscriptions')
      .update({
        cancel_at_period_end: action === 'cancel',
        updated_at: new Date().toISOString(),
      })
      .eq('doctor_id', doctor.id)
      .select('cancel_at_period_end, current_period_end')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: 'No subscription found' }, { status: 404 })

    return NextResponse.json({ subscription: data })
  } catch (err) {
    console.error('doctor/billing action error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
