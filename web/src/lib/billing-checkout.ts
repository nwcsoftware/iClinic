import type { SupabaseClient } from '@supabase/supabase-js'
import { createCheckoutSession, retrieveOrder } from './areeba'
import type { Plan } from './billing'

// How long a started-but-never-finished payment stays open before we stop
// asking the gateway about it.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000

export type StartResult = { orderId: string; sessionId: string; payUrl: string }

// Begin a card purchase: record the attempt as 'pending', then ask Areeba for
// a checkout session. The row exists BEFORE the payer sees a card form, so a
// payment can never happen without a row here waiting to be reconciled.
export async function startCardCheckout(
  admin: SupabaseClient,
  doctorId: string,
  plan: Plan,
  origin: string,
): Promise<StartResult> {
  const orderId = `ICL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const { error } = await admin.from('subscription_payments').insert({
    doctor_id: doctorId,
    amount_usd: plan.amount_usd,
    currency: 'USD',
    method: 'card',
    status: 'pending',
    months: plan.months,
    provider: 'areeba',
    provider_event_id: orderId,
    description: `iClinic ${plan.label}`,
  })
  if (error) throw new Error(error.message)

  const { sessionId } = await createCheckoutSession({
    orderId,
    amount: plan.amount_usd,
    currency: 'USD',
    description: `iClinic ${plan.label}`,
    returnUrl: `${origin}/pay/return?order=${encodeURIComponent(orderId)}`,
  })

  await admin
    .from('subscription_payments')
    .update({ session_id: sessionId })
    .eq('provider_event_id', orderId)

  return { orderId, sessionId, payUrl: `${origin}/pay/${encodeURIComponent(orderId)}` }
}

export type VerifyResult = {
  state: 'paid' | 'failed' | 'pending' | 'abandoned' | 'unknown_order'
  already_applied: boolean
  months?: number
  period_end?: string
}

// The only path that grants access. Safe to call any number of times, from the
// return page or the reconcile job.
export async function verifyAndApply(
  admin: SupabaseClient,
  orderId: string,
  simulateOutcome?: 'paid' | 'failed',
): Promise<VerifyResult> {
  const { data: row } = await admin
    .from('subscription_payments')
    .select('id, doctor_id, amount_usd, months, status, created_at')
    .eq('provider_event_id', orderId)
    .maybeSingle()

  if (!row) return { state: 'unknown_order', already_applied: false }
  if (row.status === 'paid') return { state: 'paid', already_applied: true }
  if (row.status === 'failed') return { state: 'failed', already_applied: true }

  const outcome = await retrieveOrder(orderId, simulateOutcome)

  // Payer never completed. Give up once it is clearly stale.
  if (outcome.state === 'not_found' || outcome.state === 'pending') {
    const age = Date.now() - new Date(row.created_at as string).getTime()
    if (outcome.state === 'not_found' && age > ABANDON_AFTER_MS) {
      await admin
        .from('subscription_payments')
        .update({ status: 'failed', failure_reason: 'Abandoned before payment' })
        .eq('id', row.id)
        .eq('status', 'pending')
      return { state: 'abandoned', already_applied: false }
    }
    return { state: 'pending', already_applied: false }
  }

  if (outcome.state === 'failed') {
    await admin
      .from('subscription_payments')
      .update({
        status: 'failed',
        failure_reason: outcome.gateway_status ?? 'Declined',
        card_brand: outcome.card?.brand ?? null,
        card_last4: outcome.card?.last4 ?? null,
      })
      .eq('id', row.id)
      .eq('status', 'pending')
    return { state: 'failed', already_applied: false }
  }

  // ---- Captured. Claim the row first. -------------------------------------
  // The .eq('status','pending') makes this a compare-and-swap: if two verifies
  // race (return page + reconcile job), exactly one flips the row and only that
  // one extends the subscription. Without it, a doctor could get double time.
  const { data: claimed } = await admin
    .from('subscription_payments')
    .update({
      status: 'paid',
      card_brand: outcome.card?.brand ?? null,
      card_last4: outcome.card?.last4 ?? null,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (!claimed) return { state: 'paid', already_applied: true }

  const months = Number(row.months ?? 1)
  const periodEnd = await extendSubscription(admin, row.doctor_id as string, months, outcome.card)

  await admin
    .from('subscription_payments')
    .update({ period_end: periodEnd })
    .eq('id', row.id)

  return { state: 'paid', already_applied: false, months, period_end: periodEnd }
}

// Extend from whichever is later: now, or the end of the period they already
// have. Paying early must never shorten a subscription.
async function extendSubscription(
  admin: SupabaseClient,
  doctorId: string,
  months: number,
  card: { brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null } | null,
): Promise<string> {
  const { data: sub } = await admin
    .from('doctor_subscriptions')
    .select('current_period_end')
    .eq('doctor_id', doctorId)
    .maybeSingle()

  const now = Date.now()
  const currentEnd = sub?.current_period_end ? new Date(sub.current_period_end as string).getTime() : 0
  const base = new Date(Math.max(now, currentEnd))
  base.setMonth(base.getMonth() + months)
  const periodEnd = base.toISOString()

  const patch: Record<string, unknown> = {
    status: 'active',
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    provider: 'areeba',
    last_payment_at: new Date().toISOString(),
    last_payment_status: 'paid',
    updated_at: new Date().toISOString(),
  }
  if (card) {
    patch.card_brand = card.brand
    patch.card_last4 = card.last4
    patch.card_exp_month = card.exp_month
    patch.card_exp_year = card.exp_year
  }

  // A doctor with no row yet (billing enabled after they signed up) gets one.
  const { data: updated } = await admin
    .from('doctor_subscriptions')
    .update(patch)
    .eq('doctor_id', doctorId)
    .select('doctor_id')
    .maybeSingle()

  if (!updated) {
    await admin.from('doctor_subscriptions').insert({
      doctor_id: doctorId,
      current_period_start: new Date().toISOString(),
      ...patch,
    })
  }

  return periodEnd
}

// Re-ask the gateway about every payment we started but never resolved.
// This is what makes a dropped redirect harmless.
export async function reconcilePending(
  admin: SupabaseClient,
  limit = 50,
): Promise<{ checked: number; resolved: number; results: Record<string, number> }> {
  const { data: pending } = await admin
    .from('subscription_payments')
    .select('provider_event_id')
    .eq('status', 'pending')
    .eq('provider', 'areeba')
    .order('created_at', { ascending: true })
    .limit(limit)

  const results: Record<string, number> = {}
  let resolved = 0

  for (const p of pending ?? []) {
    const orderId = p.provider_event_id as string
    if (!orderId) continue
    try {
      const r = await verifyAndApply(admin, orderId)
      results[r.state] = (results[r.state] ?? 0) + 1
      if (r.state === 'paid' || r.state === 'failed' || r.state === 'abandoned') resolved++
    } catch {
      results.error = (results.error ?? 0) + 1
    }
  }

  return { checked: pending?.length ?? 0, resolved, results }
}
