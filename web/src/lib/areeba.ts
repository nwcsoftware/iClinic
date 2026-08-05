// ---------------------------------------------------------------------------
// Areeba card payments.
//
// Areeba's e-commerce gateway is Mastercard Payment Gateway Services (MPGS),
// hosted at epayment.areeba.com. Two calls matter:
//
//   POST .../merchant/{MID}/session      create a checkout session
//   GET  .../merchant/{MID}/order/{id}   ask the gateway what actually happened
//
// The second one is the whole safety model. We NEVER activate a subscription
// because the browser came back to a success URL — anyone can type that URL.
// We activate only after this server asks the gateway directly and sees
// CAPTURED. That also makes reconciliation trivial: re-ask about any order we
// never resolved.
//
// Set AREEBA_SIMULATE=1 in local dev to exercise the whole flow without
// credentials. It refuses to run in production.
// ---------------------------------------------------------------------------

export type AreebaCard = {
  brand: string | null
  last4: string | null
  exp_month: number | null
  exp_year: number | null
}

export type OrderOutcome = {
  // paid      — money captured, safe to activate
  // failed    — the gateway rejected it, never retry this order
  // pending   — still in flight, ask again later
  // not_found — the payer never got far enough to create an order
  state: 'paid' | 'failed' | 'pending' | 'not_found'
  gateway_status: string | null
  amount: number | null
  currency: string | null
  card: AreebaCard | null
  raw: unknown
}

const BASE = process.env.AREEBA_BASE_URL ?? 'https://epayment.areeba.com'
const VERSION = process.env.AREEBA_API_VERSION ?? '100'
const MID = process.env.AREEBA_MERCHANT_ID ?? ''
const PASSWORD = process.env.AREEBA_API_PASSWORD ?? ''

// Dev-only. Never allowed to run in production, whatever the env says.
export function simulating(): boolean {
  return process.env.AREEBA_SIMULATE === '1' && process.env.NODE_ENV !== 'production'
}

export function areebaConfigured(): boolean {
  return simulating() || Boolean(MID && PASSWORD)
}

// A TEST merchant id from Areeba is prefixed "TEST", e.g. TEST799700711.
export function areebaIsTestMerchant(): boolean {
  return simulating() || MID.toUpperCase().startsWith('TEST')
}

function authHeader(): string {
  return `Basic ${Buffer.from(`merchant.${MID}:${PASSWORD}`).toString('base64')}`
}

function url(path: string): string {
  return `${BASE}/api/rest/version/${VERSION}/merchant/${MID}${path}`
}

// ---------------------------------------------------------------------------
// 1. Create a checkout session. Returns the id Checkout.js needs.
// ---------------------------------------------------------------------------
export async function createCheckoutSession(input: {
  orderId: string
  amount: number
  currency?: string
  description: string
  returnUrl: string
}): Promise<{ sessionId: string; successIndicator: string | null }> {
  if (simulating()) {
    return { sessionId: `SIMSESSION${input.orderId}`, successIndicator: 'simulated' }
  }
  if (!areebaConfigured()) throw new Error('Areeba is not configured')

  const res = await fetch(url('/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      apiOperation: 'CREATE_CHECKOUT_SESSION',
      interaction: {
        operation: 'PURCHASE',
        returnUrl: input.returnUrl,
        merchant: { name: 'iClinic' },
      },
      order: {
        id: input.orderId,
        amount: Number(input.amount.toFixed(2)),
        currency: input.currency ?? 'USD',
        description: input.description,
      },
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.result !== 'SUCCESS' || !body.session?.id) {
    const reason = body?.error?.explanation ?? body?.result ?? `HTTP ${res.status}`
    throw new Error(`Areeba session failed: ${reason}`)
  }

  return { sessionId: body.session.id, successIndicator: body.successIndicator ?? null }
}

// ---------------------------------------------------------------------------
// 2. Ask the gateway what happened. This is the only thing we trust.
// ---------------------------------------------------------------------------
export async function retrieveOrder(
  orderId: string,
  // Dev-only: lets the simulator page exercise the decline path. Ignored
  // entirely unless AREEBA_SIMULATE is on, which cannot happen in production.
  simulateOutcome?: 'paid' | 'failed',
): Promise<OrderOutcome> {
  if (simulating()) {
    const failed = simulateOutcome === 'failed'
    return {
      state: failed ? 'failed' : 'paid',
      gateway_status: failed ? 'DECLINED' : 'CAPTURED',
      amount: null,
      currency: 'USD',
      card: failed ? null : { brand: 'VISA', last4: '2346', exp_month: 12, exp_year: 2030 },
      raw: { simulated: true, orderId },
    }
  }
  if (!areebaConfigured()) throw new Error('Areeba is not configured')

  const res = await fetch(url(`/order/${encodeURIComponent(orderId)}`), {
    headers: { Authorization: authHeader() },
  })

  // The gateway has no such order: the payer abandoned before paying.
  if (res.status === 404) {
    return { state: 'not_found', gateway_status: null, amount: null, currency: null, card: null, raw: null }
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Areeba order lookup failed: HTTP ${res.status}`)

  const status = String(body.status ?? '').toUpperCase()
  return {
    state: mapStatus(status),
    gateway_status: status || null,
    amount: typeof body.amount === 'number' ? body.amount : null,
    currency: body.currency ?? null,
    card: extractCard(body),
    raw: body,
  }
}

// We use interaction.operation = PURCHASE, so a real payment lands on CAPTURED.
// AUTHORIZED means the money is only reserved — deliberately NOT treated as
// paid, because granting access for an uncaptured authorization gives away the
// product for free if the capture later fails.
function mapStatus(status: string): OrderOutcome['state'] {
  if (status === 'CAPTURED') return 'paid'
  if (['FAILED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'VOIDED'].includes(status)) return 'failed'
  return 'pending'
}

// MPGS returns the card masked, e.g. "512345xxxxxx2346" — only the last four
// digits are real, which is exactly what we are allowed to keep.
function extractCard(body: Record<string, unknown>): AreebaCard | null {
  const sof = (body.sourceOfFunds ?? {}) as Record<string, unknown>
  const provided = (sof.provided ?? {}) as Record<string, unknown>
  const card = provided.card as Record<string, unknown> | undefined
  if (!card) return null

  const masked = typeof card.number === 'string' ? card.number : ''
  const digits = masked.replace(/[^0-9]/g, '')
  const last4 = digits.length >= 4 ? digits.slice(-4) : null
  const expiry = (card.expiry ?? {}) as Record<string, unknown>

  return {
    brand: typeof card.brand === 'string' ? card.brand : null,
    last4,
    exp_month: expiry.month ? Number(expiry.month) : null,
    exp_year: expiry.year ? 2000 + Number(expiry.year) : null,
  }
}

// The hosted payment page URL Checkout.js is loaded from.
export function checkoutJsUrl(): string {
  return `${BASE}/static/checkout/checkout.min.js`
}
