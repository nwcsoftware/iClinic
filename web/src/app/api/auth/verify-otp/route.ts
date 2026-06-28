import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function deriveOtp(email: string, sentAt: string): string {
  // Normalize to epoch ms so the derivation is independent of timestamp string
  // formatting. send-otp passes a JS ISO string ("…Z") while verify-otp reads the
  // value back from a Postgres timestamptz column ("…+00:00"); both must hash to
  // the same input or a correct code would never match.
  const ts = new Date(sentAt).getTime()
  const hmac = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
  hmac.update(`${email}:${ts}`)
  const num = parseInt(hmac.digest('hex').slice(0, 8), 16)
  return String(num % 10000).padStart(4, '0')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(request: Request) {
  try {
    const { email, token } = await request.json()
    if (!email || !token) return NextResponse.json({ error: 'Email and token required' }, { status: 400 })

    const admin = createAdminClient()

    // Load session state
    const { data: otpSession } = await admin
      .from('otp_sessions')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    // Check lockout
    if (otpSession?.locked_until && new Date(otpSession.locked_until) > new Date()) {
      const msLeft = new Date(otpSession.locked_until).getTime() - Date.now()
      const minutesLeft = Math.ceil(msLeft / 60000)
      return NextResponse.json({
        error: `Account locked. Try again in ${minutesLeft} minute(s).`,
        locked: true,
        locked_until: otpSession.locked_until,
      }, { status: 429 })
    }

    // Check 5-minute expiry
    if (!otpSession?.sent_at) {
      return NextResponse.json({ error: 'No active code. Please request a new one.', expired: true }, { status: 401 })
    }
    const age = Date.now() - new Date(otpSession.sent_at).getTime()
    if (age > 300_000) {
      return NextResponse.json({ error: 'Code has expired. Please request a new one.', expired: true }, { status: 401 })
    }

    // Recompute expected code and compare
    const expected = deriveOtp(email, otpSession.sent_at)
    const correct = safeEqual(token.trim(), expected)

    if (!correct) {
      const newAttempts = (otpSession?.attempts ?? 0) + 1
      const lockedUntil = newAttempts >= 3
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : null

      await admin.from('otp_sessions').upsert({
        email,
        attempts: newAttempts,
        locked_until: lockedUntil,
        sent_at: otpSession.sent_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })

      if (lockedUntil) {
        return NextResponse.json({
          error: 'Account locked for 30 minutes due to too many failed attempts.',
          locked: true,
          locked_until: lockedUntil,
        }, { status: 429 })
      }

      const remaining = 3 - newAttempts
      return NextResponse.json({
        error: `Invalid code. ${remaining} attempt(s) remaining.`,
        attempts_remaining: remaining,
      }, { status: 401 })
    }

    // Code is correct — create a real session via Supabase magic link exchange
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError || !linkData?.properties?.email_otp) {
      console.error('generateLink error:', linkError)
      return NextResponse.json({ error: 'Failed to create session.' }, { status: 500 })
    }

    const supabase = await createClient()
    const { error: sessionError } = await supabase.auth.verifyOtp({
      email,
      token: linkData.properties.email_otp,
      type: 'email',
    })

    if (sessionError) {
      console.error('verifyOtp error:', sessionError)
      return NextResponse.json({ error: 'Failed to establish session.' }, { status: 500 })
    }

    // Reset attempts on success
    await admin.from('otp_sessions').upsert({
      email,
      attempts: 0,
      locked_until: null,
      sent_at: otpSession.sent_at,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('verify-otp error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
