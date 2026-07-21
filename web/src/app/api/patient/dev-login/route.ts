import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// DEMO passwordless login.
// Mints a real Supabase session for the given email using the service-role key,
// so users can sign in with just an email — no code. Enabled in development,
// and in production ONLY while ALLOW_DEMO_LOGIN=true is set (demo phase).
// Before real launch: remove ALLOW_DEMO_LOGIN and switch to the emailed
// 6-digit code flow (Supabase "Magic Link" template must include {{ .Token }}).
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }
  try {
    const { email } = await request.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Ensure the auth user exists (ignore "already registered").
    const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }

    // Generate a one-time OTP for that user, then verify it server-side to get a session.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const otp = link?.properties?.email_otp
    if (linkErr || !otp) {
      return NextResponse.json({ error: linkErr?.message ?? 'Could not create login' }, { status: 400 })
    }

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (verifyErr || !verified.session) {
      return NextResponse.json({ error: verifyErr?.message ?? 'Login failed' }, { status: 400 })
    }

    return NextResponse.json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    })
  } catch (err) {
    console.error('dev-login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
