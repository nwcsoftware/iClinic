// ---------------------------------------------------------------------------
// Paddle Billing.
//
// Paddle is a Merchant of Record: it is the legal seller, so it accepts Visa,
// Mastercard, Amex, Apple Pay and Google Pay worldwide, handles VAT/sales tax
// and chargebacks, and then pays us out. Crucially for Lebanon, Paddle works
// on an EXCLUSION list (28 sanctioned countries; Lebanon is not one) and pays
// out by wire OR Payoneer, which does cover Lebanon.
//
// Unlike a raw gateway, Paddle owns the recurring billing: it charges the card
// every month, retries failures and handles dunning. We never compute a renewal
// date ourselves — we mirror whatever the webhook tells us.
//
// The doctor is identified by custom_data.doctor_id, which Paddle copies from
// the checkout to the subscription and onto every future renewal transaction.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'crypto'
import type { BillingEvent, NormalizedCard } from './billing'

const SANDBOX = (process.env.PADDLE_ENV ?? 'sandbox').toLowerCase() !== 'live'

const API = SANDBOX ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'

export function paddleConfigured(): boolean {
  return Boolean(process.env.PADDLE_API_KEY && process.env.PADDLE_PRICE_ID_MONTHLY)
}

export function paddleIsSandbox(): boolean {
  return SANDBOX
}

async function paddleFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = body?.error?.detail ?? body?.error?.code ?? `HTTP ${res.status}`
    throw new Error(`Paddle: ${detail}`)
  }
  return body
}

// The price the doctor is subscribing to. Paddle owns the amount — we only
// choose which price, so a tampered client still cannot change what is charged.
function priceIdFor(plan: string | undefined): string {
  if (plan === 'm12' && process.env.PADDLE_PRICE_ID_YEARLY) return process.env.PADDLE_PRICE_ID_YEARLY
  return process.env.PADDLE_PRICE_ID_MONTHLY!
}

// Creates a transaction and returns Paddle's hosted checkout URL.
// Requires a default payment link to be set in Paddle > Checkout > Settings.
export async function createCheckout(input: {
  doctorId: string
  email: string | null
  plan?: string
}): Promise<string | null> {
  const body: Record<string, unknown> = {
    items: [{ price_id: priceIdFor(input.plan), quantity: 1 }],
    // Copied by Paddle onto the subscription and every renewal, which is how
    // a webhook two months from now still knows which doctor it belongs to.
    custom_data: { doctor_id: input.doctorId },
    collection_mode: 'automatic',
  }
  if (input.email) body.customer = { email: input.email }

  const res = await paddleFetch('/transactions', { method: 'POST', body: JSON.stringify(body) })
  return res?.data?.checkout?.url ?? null
}

// Paddle-hosted page where the doctor can change their card or cancel.
export async function createPortal(customerId: string | null): Promise<string | null> {
  if (!customerId) return null
  const res = await paddleFetch(`/customers/${customerId}/portal-sessions`, { method: 'POST', body: '{}' })
  return res?.data?.urls?.general?.overview ?? null
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await paddleFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    // Never cut someone off mid-period they already paid for.
    body: JSON.stringify({ effective_from: 'next_billing_period' }),
  })
}

export async function resumeSubscription(subscriptionId: string): Promise<void> {
  // Paddle expresses "don't cancel after all" as clearing the scheduled change.
  await paddleFetch(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduled_change: null }),
  })
}

// ---------------------------------------------------------------------------
// Webhook verification.
//
// Paddle-Signature is "ts=<unix>;h1=<hex>". The signed payload is
// "<ts>:<raw body>" — the body must be the EXACT bytes received, so the route
// reads it with request.text() and never JSON round-trips it first.
// ---------------------------------------------------------------------------
const MAX_AGE_SECONDS = 60 * 5

export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret || !header) return false

  let ts = ''
  let h1 = ''
  for (const part of header.split(';')) {
    const [k, v] = part.split('=')
    if (k === 'ts') ts = v
    if (k === 'h1') h1 = v
  }
  if (!ts || !h1) return false

  // Reject replays of an old capture.
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(h1)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Map Paddle's event zoo onto the small set our billing code acts on.
export function parseEvent(rawBody: string): BillingEvent | null {
  let payload: PaddlePayload
  try { payload = JSON.parse(rawBody) } catch { return null }

  const type = payload.event_type ?? ''
  const data = payload.data ?? {}
  const eventId = payload.event_id ?? `${type}-${payload.occurred_at ?? Date.now()}`

  const doctorId =
    (data.custom_data?.doctor_id as string | undefined)
    ?? (data.subscription?.custom_data?.doctor_id as string | undefined)
    ?? null

  const base = {
    id: eventId,
    doctor_id: doctorId,
    raw: payload as unknown,
    invoice_url: null as string | null,
    receipt_url: null as string | null,
    failure_reason: null as string | null,
    currency: (data.currency_code as string) ?? (data.details?.totals?.currency_code as string) ?? 'USD',
    card: extractCard(data),
    subscription_id: (data.subscription_id as string) ?? (type.startsWith('subscription.') ? (data.id as string) : null) ?? null,
    customer_id: (data.customer_id as string) ?? null,
  }

  switch (type) {
    case 'subscription.activated':
    case 'subscription.created':
    case 'subscription.resumed':
      return { ...base, type: 'subscription_activated', period_end: nextBilled(data), amount_usd: null }

    case 'subscription.updated':
      // A scheduled cancellation arrives as an update carrying scheduled_change.
      if (data.scheduled_change?.action === 'cancel') {
        return { ...base, type: 'subscription_canceled', period_end: nextBilled(data), amount_usd: null }
      }
      return { ...base, type: 'subscription_activated', period_end: nextBilled(data), amount_usd: null }

    case 'subscription.canceled':
      return { ...base, type: 'subscription_canceled', period_end: nextBilled(data), amount_usd: null }

    case 'transaction.completed':
    case 'transaction.paid':
      return {
        ...base,
        type: 'payment_succeeded',
        period_end: billingPeriodEnd(data),
        amount_usd: money(data),
        invoice_url: (data.invoice_url as string) ?? null,
      }

    case 'transaction.payment_failed':
    case 'transaction.past_due':
      return {
        ...base,
        type: 'payment_failed',
        period_end: null,
        amount_usd: money(data),
        failure_reason: firstDeclineReason(data),
      }

    default:
      // Recorded for audit, applied as a no-op.
      return { ...base, type: 'unknown', period_end: null, amount_usd: null }
  }
}

function nextBilled(data: PaddleData): string | null {
  return (data.next_billed_at as string)
    ?? (data.current_billing_period?.ends_at as string)
    ?? null
}

function billingPeriodEnd(data: PaddleData): string | null {
  return (data.billing_period?.ends_at as string) ?? null
}

function money(data: PaddleData): number | null {
  // Paddle reports amounts in the currency's smallest unit, as a string.
  const raw = data.details?.totals?.total ?? data.details?.totals?.grand_total
  if (typeof raw !== 'string') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n / 100 : null
}

function firstDeclineReason(data: PaddleData): string | null {
  const p = data.payments?.[0]
  return (p?.error_code as string) ?? null
}

function extractCard(data: PaddleData): NormalizedCard | null {
  const method = data.payments?.[0]?.method_details ?? data.payment_method
  const card = method?.card
  if (!card) return null
  const last4 = typeof card.last4 === 'string' && /^[0-9]{4}$/.test(card.last4) ? card.last4 : null
  return {
    brand: (card.type as string) ?? null,
    last4,
    exp_month: typeof card.expiry_month === 'number' ? card.expiry_month : null,
    exp_year: typeof card.expiry_year === 'number' ? card.expiry_year : null,
  }
}

// Loose shapes — Paddle sends far more than we read.
type PaddleCard = { type?: string; last4?: string; expiry_month?: number; expiry_year?: number }
type PaddleData = {
  id?: string
  subscription_id?: string
  customer_id?: string
  currency_code?: string
  invoice_url?: string
  next_billed_at?: string
  custom_data?: Record<string, unknown>
  subscription?: { custom_data?: Record<string, unknown> }
  scheduled_change?: { action?: string }
  current_billing_period?: { ends_at?: string }
  billing_period?: { ends_at?: string }
  details?: { totals?: { total?: string; grand_total?: string; currency_code?: string } }
  payments?: { error_code?: string; method_details?: { card?: PaddleCard } }[]
  payment_method?: { card?: PaddleCard }
}
type PaddlePayload = { event_id?: string; event_type?: string; occurred_at?: string; data?: PaddleData }
