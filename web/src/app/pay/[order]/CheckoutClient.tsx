'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    Checkout?: {
      configure: (opts: Record<string, unknown>) => void
      showPaymentPage: () => void
    }
  }
}

const btn: React.CSSProperties = {
  display: 'block', width: '100%', padding: '15px 16px', borderRadius: 12,
  border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer',
  background: '#0F766E', color: '#fff', marginBottom: 10,
}

export default function CheckoutClient({
  orderId, sessionId, scriptUrl, simulate,
}: {
  orderId: string
  sessionId: string | null
  scriptUrl: string
  simulate: boolean
}) {
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (simulate || !sessionId) return

    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    // Areeba's Checkout.js calls these globals on completion. We deliberately
    // do nothing useful here beyond navigating — the real decision is made by
    // the server when it queries the gateway on the return page.
    script.onload = () => {
      try {
        window.Checkout?.configure({ session: { id: sessionId } })
        setReady(true)
      } catch {
        setError('Could not start the card form. Please try again.')
      }
    }
    script.onerror = () => setError('Could not reach the payment gateway.')
    document.body.appendChild(script)
    return () => { script.remove() }
  }, [scriptUrl, sessionId, simulate])

  // ---- Simulator: exercise the whole flow before credentials arrive --------
  if (simulate) {
    return (
      <>
        <p style={{
          background: '#EAEEFC', color: '#2748B8', padding: '10px 12px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, margin: '0 0 16px',
        }}>
          Simulator — Areeba credentials are not set. Choose an outcome to test.
        </p>
        <a href={`/pay/return?order=${encodeURIComponent(orderId)}&sim=paid`} style={{ ...btn, textAlign: 'center', textDecoration: 'none' }}>
          Simulate successful payment
        </a>
        <a href={`/pay/return?order=${encodeURIComponent(orderId)}&sim=failed`}
          style={{ ...btn, background: '#fff', color: '#DC2626', border: '1.5px solid #F3D2D2', textAlign: 'center', textDecoration: 'none' }}>
          Simulate declined card
        </a>
      </>
    )
  }

  if (!sessionId) return <Err msg="This payment was not set up correctly. Please start again from the app." />
  if (error) return <Err msg={error} />

  return (
    <button style={{ ...btn, opacity: ready ? 1 : 0.6 }} disabled={!ready}
      onClick={() => window.Checkout?.showPaymentPage()}>
      {ready ? 'Pay by card' : 'Loading secure form…'}
    </button>
  )
}

function Err({ msg }: { msg: string }) {
  return (
    <p style={{
      background: '#FDEDED', color: '#B91C1C', padding: '11px 12px', borderRadius: 10,
      fontSize: 13.5, fontWeight: 600, margin: 0,
    }}>{msg}</p>
  )
}
