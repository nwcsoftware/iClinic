// ---------------------------------------------------------------------------
// Who is legally behind iClinic.
//
// Payment providers check this: Paddle requires a sole trader's legal name in
// the Terms, and Whish reviews the site before approving a merchant. These come
// from env rather than being hard-coded so nothing here is invented — and if
// the legal name is missing the pages say so loudly rather than shipping a
// silent placeholder into a provider's review.
// ---------------------------------------------------------------------------

export const org = {
  product: 'iClinic',
  /** The person or company legally providing the service. */
  legalName: process.env.LEGAL_NAME ?? '',
  email: process.env.LEGAL_EMAIL ?? 'jadchamy2001@gmail.com',
  phone: process.env.LEGAL_PHONE ?? '',
  /** City/country is enough; a full street address is not required. */
  location: process.env.LEGAL_LOCATION ?? 'Lebanon',
  priceUsd: 9.99,
}

/** False when something a reviewer will look for is still missing. */
export function legalReady(): boolean {
  return Boolean(org.legalName && org.email)
}

export function missingLegalFields(): string[] {
  const missing: string[] = []
  if (!org.legalName) missing.push('LEGAL_NAME')
  if (!org.email) missing.push('LEGAL_EMAIL')
  if (!org.phone) missing.push('LEGAL_PHONE')
  return missing
}

/** Shown as the "last updated" date on each policy. */
export const LAST_UPDATED = '12 August 2026'
