import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Derives a stable 4-digit code from email + timestamp using HMAC-SHA256.
// No code storage needed — recomputable at verify time from the same inputs.
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

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 })
    }

    const admin = createAdminClient()

    // Check lockout
    const { data: existing } = await admin
      .from('otp_sessions')
      .select('locked_until')
      .eq('email', email)
      .maybeSingle()

    if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
      const msLeft = new Date(existing.locked_until).getTime() - Date.now()
      const minutesLeft = Math.ceil(msLeft / 60000)
      return NextResponse.json({
        error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
        locked: true,
        locked_until: existing.locked_until,
      }, { status: 429 })
    }

    const sentAt = new Date().toISOString()
    const otpCode = deriveOtp(email, sentAt)

    // Send via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Your Clinic System login code',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#fff;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-block;background:#2563eb;border-radius:12px;padding:12px 20px;">
                <span style="color:#fff;font-size:20px;font-weight:bold;">Clinic System</span>
              </div>
            </div>
            <h2 style="color:#1e293b;margin-bottom:8px;">Your login code</h2>
            <p style="color:#475569;margin-bottom:24px;">Enter this 4-digit code to sign in. It expires in 5 minutes.</p>
            <div style="background:#f1f5f9;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
              <span style="font-size:52px;font-weight:bold;letter-spacing:14px;color:#1e40af;font-family:monospace;">${otpCode}</span>
            </div>
            <p style="color:#94a3b8;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>
          </div>
        `,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}))
      console.error('Resend error:', err)
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
    }

    // Record send time and reset attempts
    await admin.from('otp_sessions').upsert({
      email,
      attempts: 0,
      locked_until: null,
      sent_at: sentAt,
      updated_at: sentAt,
    }, { onConflict: 'email' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send-otp error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
