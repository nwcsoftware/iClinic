import { createAdminClient } from '@/lib/supabase/admin'
import { checkoutJsUrl, simulating, areebaIsTestMerchant } from '@/lib/areeba'
import CheckoutClient from './CheckoutClient'

// The hosted card page. The doctor's app opens this URL; Areeba's Checkout.js
// renders the card form here so card details never touch our servers.
export default async function PayPage({ params }: { params: Promise<{ order: string }> }) {
  const { order } = await params
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('subscription_payments')
    .select('amount_usd, currency, description, status, session_id')
    .eq('provider_event_id', order)
    .maybeSingle()

  if (!row) return <Shell title="Payment not found" body="This payment link is not valid." />
  if (row.status === 'paid') return <Shell title="Already paid" body="This payment has already been completed." />
  if (row.status === 'failed') return <Shell title="Payment closed" body="This payment attempt is no longer valid. Start a new one from the app." />

  const amount = `${Number(row.amount_usd).toFixed(2)} ${row.currency ?? 'USD'}`

  return (
    <Shell title="Complete your payment" body={`${row.description ?? 'iClinic subscription'} — ${amount}`}>
      {areebaIsTestMerchant() ? (
        <p style={{
          background: '#FEF6E7', color: '#B45309', padding: '10px 12px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, margin: '0 0 18px',
        }}>
          Test mode — no real money will move.
        </p>
      ) : null}

      <CheckoutClient
        orderId={order}
        sessionId={row.session_id as string | null}
        scriptUrl={checkoutJsUrl()}
        simulate={simulating()}
      />
    </Shell>
  )
}

function Shell({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F6FA', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 28,
        boxShadow: '0 10px 40px rgba(16,28,61,0.10)',
      }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0D1526', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#5B6577', lineHeight: 1.5, margin: '8px 0 20px' }}>{body}</p>
        {children}
      </div>
    </main>
  )
}
