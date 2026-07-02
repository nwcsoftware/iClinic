import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// LOCAL-TESTING ONLY passwordless login.
// Mints a real Supabase session for the given email using the service-role key,
// so you can sign in without waiting for an emailed OTP code. Disabled in
// production. For the real product, use the emailed 6-digit code flow
// (needs the Supabase "Magic Link" email template to include {{ .Token }}).
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
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
