import { Platform } from 'react-native'

// ---------------------------------------------------------------------------
// Whether this build may sell anything, or point at somewhere that sells.
//
// Apple's App Review Guideline 3.1.1 says an app that unlocks features must do
// it through in-app purchase, and — the part that catches people out — that an
// app "may not include buttons, external links, or other calls to action that
// direct customers to purchasing mechanisms other than IAP". A "Subscribe"
// button that opens iclinic.health is exactly the thing that names.
//
// Guideline 3.1.3(a), Multiplatform Services, is what makes the rest of this
// work: an app MAY let someone use a subscription bought elsewhere. Reading
// the subscription and unlocking the doctor tools is fine. Selling it, showing
// its price, or pointing at where to buy it is not.
//
// So on iOS the app is a reader: it reports whether access is active and
// unlocks accordingly, and says nothing about money. Everywhere else — Android
// and the web — the full billing flow stays exactly as it was.
//
// This is deliberately one constant rather than a check scattered through the
// screens, so there is a single place to look when the rules change, and no
// way for a new payment surface to be added without meeting it.
// ---------------------------------------------------------------------------

export const CAN_SELL_IN_APP = Platform.OS !== 'ios'

/**
 * Guideline 3.1.3(a) again: honouring a purchase made elsewhere is allowed on
 * every platform, so this is always true. Named separately from the constant
 * above so the distinction is legible at the call site: one asks "may I sell",
 * the other "may I unlock".
 */
export const CAN_HONOUR_EXISTING_SUBSCRIPTION = true
