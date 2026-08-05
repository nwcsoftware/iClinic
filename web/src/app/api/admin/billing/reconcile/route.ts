import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcilePending } from '@/lib/billing-checkout'

// Same guard style as /api/admin/subscription.
function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_API_KEY ?? ''
  if (expected.length < 16) return false
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// POST /api/admin/billing/reconcile   (Bearer ADMIN_API_KEY)
//
// Re-asks Areeba about every payment we started but never resolved. This is the
// answer to "the doctor paid and nothing happened": a lost browser redirect,
// a closed tab or a dropped connection can no longer strand a payment, because
// the gateway is the source of truth and we re-read it.
//
// Run it on a schedule (every 10-15 minutes is plenty).
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const admin = createAdminClient()
    const summary = await reconcilePending(admin)
    return NextResponse.json(summary)
  } catch (err) {
    console.error('billing reconcile error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
