import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingProvider, safeCard, type BillingEvent } from '@/lib/billing'

// POST /api/webhooks/billing/:provider
//
// Providers retry until they get a 2xx, so this has to be safe to run twice.
// billing_webhook_events has UNIQUE (provider, event_id): the insert below is
// the lock. If it conflicts we have already handled this event and return 200
// without touching anything.
//
// The body is read raw because signature verification runs over the exact bytes.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: routeProvider } = await params

  try {
    const provider = getBillingProvider()

    // A webhook aimed at a provider we are not configured for is not ours.
    if (routeProvider.toLowerCase() !== provider.name) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
    }

    const raw = await request.text()
    const event = await provider.verifyWebhook(raw, request.headers)
    if (!event) {
      // Bad signature, or no webhooks configured for this provider.
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error: claimErr } = await admin
      .from('billing_webhook_events')
      .insert({
        provider: provider.name,
        event_id: event.id,
        event_type: event.type,
        doctor_id: event.doctor_id,
        payload: event.raw as never,
      })

    // 23505 = already recorded. A retry of something we finished; nothing to do.
    if (claimErr) {
      if (claimErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      return NextResponse.json({ error: claimErr.message }, { status: 500 })
    }

    let applyError: string | null = null
    if (!event.doctor_id) {
      // Nothing to attach it to. Recorded above for inspection; do not ask the
      // provider to retry, because a retry cannot fix an unmapped account.
      applyError = 'No doctor_id on event'
    } else {
      try {
        await applyEvent(admin, event, provider.name)
      } catch (e) {
        applyError = e instanceof Error ? e.message : 'Failed to apply event'
      }
    }

    await admin
      .from('billing_webhook_events')
      .update({ processed_at: new Date().toISOString(), error: applyError })
      .eq('provider', provider.name)
      .eq('event_id', event.id)

    return NextResponse.json({ ok: true, applied: !applyError })
  } catch (err) {
    console.error('billing webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

type Admin = ReturnType<typeof createAdminClient>

async function applyEvent(admin: Admin, event: BillingEvent, providerName: string) {
  const doctorId = event.doctor_id as string
  const card = safeCard(event.card)
  const now = new Date().toISOString()

  const cardFields = card
    ? {
        card_brand: card.brand,
        card_last4: card.last4,
        card_exp_month: card.exp_month,
        card_exp_year: card.exp_year,
      }
    : {}

  // provider records which processor last wrote this row.
  const sub: Record<string, unknown> = { updated_at: now, provider: providerName, ...cardFields }

  // Keep the processor's own ids so we can cancel or open its portal later.
  if (event.subscription_id) sub.provider_subscription_id = event.subscription_id
  if (event.customer_id) sub.provider_customer_id = event.customer_id

  switch (event.type) {
    case 'payment_succeeded':
      sub.status = 'active'
      sub.last_payment_at = now
      sub.last_payment_status = 'paid'
      if (event.period_end) {
        sub.current_period_start = now
        sub.current_period_end = event.period_end
      }
      break
    case 'payment_failed':
      sub.status = 'past_due'
      sub.last_payment_at = now
      sub.last_payment_status = 'failed'
      break
    case 'subscription_activated':
      sub.status = 'active'
      sub.cancel_at_period_end = false
      if (event.period_end) sub.current_period_end = event.period_end
      break
    case 'subscription_canceled':
      sub.cancel_at_period_end = true
      break
    case 'card_updated':
      break
    default:
      return // nothing actionable
  }

  const { error: subErr } = await admin
    .from('doctor_subscriptions')
    .update(sub)
    .eq('doctor_id', doctorId)
  if (subErr) throw new Error(subErr.message)

  // Ledger row for anything involving money.
  if (event.type === 'payment_succeeded' || event.type === 'payment_failed') {
    const { error: payErr } = await admin
      .from('subscription_payments')
      .insert({
        doctor_id: doctorId,
        amount_usd: event.amount_usd ?? 0,
        currency: event.currency ?? 'USD',
        method: 'card',
        status: event.type === 'payment_succeeded' ? 'paid' : 'failed',
        period_end: event.period_end,
        invoice_url: event.invoice_url,
        receipt_url: event.receipt_url,
        failure_reason: event.failure_reason,
        card_brand: card?.brand ?? null,
        card_last4: card?.last4 ?? null,
        provider: providerName,
        provider_event_id: event.id,
      })
    // 23505 means the ledger already has it — harmless on a partial retry.
    if (payErr && payErr.code !== '23505') throw new Error(payErr.message)
  }
}
