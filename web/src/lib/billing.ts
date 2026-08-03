// ---------------------------------------------------------------------------
// Billing providers.
//
// Everything the billing page shows lives in OUR database. A provider only has
// two jobs: send the doctor somewhere to pay, and tell us what happened via a
// webhook. That keeps the whole UI provider-agnostic — adding Paddle, Stripe or
// a regional gateway later means writing one adapter below and setting
// BILLING_PROVIDER, with no change to the page or the API routes.
//
// We never see or store a card number. Providers return brand/last4/expiry only.
// ---------------------------------------------------------------------------

export type BillingCapabilities = {
  provider: string
  // A hosted page exists where the doctor can pay by card.
  can_pay_by_card: boolean
  // The provider hosts a portal where the doctor can swap the card themselves.
  can_self_serve: boolean
  // Cancelling takes effect through the provider rather than our own flag.
  cancel_via_provider: boolean
}

export type NormalizedCard = {
  brand: string | null
  last4: string | null
  exp_month: number | null
  exp_year: number | null
}

// One shape for every provider's events, so the webhook route never branches
// on which processor sent it.
export type BillingEvent = {
  id: string
  type:
    | 'subscription_activated'
    | 'subscription_canceled'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'card_updated'
    | 'unknown'
  doctor_id: string | null
  period_end: string | null
  amount_usd: number | null
  currency: string | null
  invoice_url: string | null
  receipt_url: string | null
  failure_reason: string | null
  card: NormalizedCard | null
  raw: unknown
}

export interface BillingProvider {
  readonly name: string
  capabilities(): BillingCapabilities
  /** Where to send the doctor to pay. null when there is nothing hosted. */
  createCheckoutUrl(input: { doctorId: string; email: string | null }): Promise<string | null>
  /** Provider-hosted page to change the card. null when unsupported. */
  createPortalUrl(input: { doctorId: string; customerId: string | null }): Promise<string | null>
  /** Verify the signature and normalize. null means reject the request. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<BillingEvent | null>
}

// ---------------------------------------------------------------------------
// Manual — Whish / OMT / bank transfer / cash, activated by an admin.
// This is the live provider today. BILLING_CHECKOUT_URL is optional: set it to
// any hosted payment link and the "Pay by card" button lights up immediately.
// ---------------------------------------------------------------------------
class ManualProvider implements BillingProvider {
  readonly name = 'manual'

  capabilities(): BillingCapabilities {
    return {
      provider: this.name,
      can_pay_by_card: Boolean(process.env.BILLING_CHECKOUT_URL),
      can_self_serve: false,
      cancel_via_provider: false,
    }
  }

  async createCheckoutUrl(): Promise<string | null> {
    return process.env.BILLING_CHECKOUT_URL ?? null
  }

  async createPortalUrl(): Promise<string | null> {
    return null
  }

  async verifyWebhook(): Promise<BillingEvent | null> {
    // No provider, no webhooks. Payments arrive via /api/admin/subscription.
    return null
  }
}

const PROVIDERS: Record<string, BillingProvider> = {
  manual: new ManualProvider(),
}

export function getBillingProvider(): BillingProvider {
  const name = (process.env.BILLING_PROVIDER ?? 'manual').toLowerCase()
  return PROVIDERS[name] ?? PROVIDERS.manual
}

// Card metadata is the only part of a payment method we are ever allowed to
// keep. Anything longer than four digits is dropped rather than stored.
export function safeCard(input: Partial<NormalizedCard> | null | undefined): NormalizedCard | null {
  if (!input) return null
  const last4 = typeof input.last4 === 'string' && /^[0-9]{4}$/.test(input.last4) ? input.last4 : null
  return {
    brand: input.brand ?? null,
    last4,
    exp_month: typeof input.exp_month === 'number' ? input.exp_month : null,
    exp_year: typeof input.exp_year === 'number' ? input.exp_year : null,
  }
}
