import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAndApply } from '@/lib/billing-checkout'
import { simulating } from '@/lib/areeba'

// Where Areeba sends the payer after the card form.
//
// Landing here proves NOTHING — anyone can type this URL. The subscription is
// extended only because the code below asks the gateway directly what happened
// to this order. If the doctor closes the browser before reaching this page,
// the reconcile job resolves the same order later and they still get their time.
export default async function PayReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; sim?: string }>
}) {
  const { order, sim } = await searchParams
  if (!order) return <Result ok={false} title="Missing order" body="No payment reference was provided." />

  const admin = createAdminClient()

  // The sim hint only does anything when AREEBA_SIMULATE is on, which is
  // impossible in production.
  const hint = simulating() && (sim === 'paid' || sim === 'failed') ? sim : undefined

  let state: string
  let months: number | undefined
  let periodEnd: string | undefined
  try {
    const r = await verifyAndApply(admin, order, hint)
    state = r.state
    months = r.months
    periodEnd = r.period_end
  } catch {
    state = 'error'
  }

  if (state === 'paid') {
    const until = periodEnd
      ? new Date(periodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
      : null
    return (
      <Result
        ok
        title="Payment received"
        body={until
          ? `Your subscription is active until ${until}. You can close this page and return to the app.`
          : 'Your subscription is active. You can close this page and return to the app.'}
        note={months ? `${months} month${months === 1 ? '' : 's'} added` : undefined}
      />
    )
  }

  if (state === 'failed' || state === 'abandoned') {
    return (
      <Result ok={false} title="Payment not completed"
        body="Your card was not charged. You can try again from the app, or pay by Whish or OMT instead." />
    )
  }

  if (state === 'unknown_order') {
    return <Result ok={false} title="Unknown payment" body="We could not find this payment reference." />
  }

  // pending / error — do not guess. Say so honestly.
  return (
    <Result ok={false} title="Still confirming"
      body="The gateway has not confirmed this payment yet. If money left your account, your subscription will activate automatically within a few minutes. you do not need to pay again." />
  )
}

function Result({ ok, title, body, note }: { ok: boolean; title: string; body: string; note?: string }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F6FA', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28,
        boxShadow: '0 10px 40px rgba(16,28,61,0.10)', textAlign: 'center',
      }}>
        <div style={{
          width: 62, height: 62, borderRadius: 31, margin: '0 auto 16px',
          background: ok ? '#E6F7F1' : '#FDEDED',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, color: ok ? '#0E9F6E' : '#DC2626', fontWeight: 700,
        }}>{ok ? '✓' : '!'}</div>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0D1526', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#5B6577', lineHeight: 1.55, margin: '10px 0 0' }}>{body}</p>
        {note ? (
          <p style={{
            display: 'inline-block', marginTop: 16, background: '#DCF1ED', color: '#0F766E',
            padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700,
          }}>{note}</p>
        ) : null}
      </div>
    </main>
  )
}
